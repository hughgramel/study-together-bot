import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsCategory,
  CommandEvent,
  SessionEvent,
  AchievementEvent,
  DailyAnalytics,
  UserCohort,
  AnalyticsConfig,
} from './analytics.types';

/**
 * AnalyticsService - Tracks user behavior and feature usage
 *
 * Design principles:
 * 1. Non-blocking: Analytics failures should never crash the bot
 * 2. Efficient: Batch writes to minimize Firebase costs
 * 3. Privacy-first: Only track anonymized, aggregate data
 * 4. Actionable: Every metric should inform a decision
 *
 * Cost optimization:
 * - Events are batched (default: 10 events or 5 seconds)
 * - Daily aggregates reduce storage (1 doc/user/day vs 100+ events)
 * - Raw events auto-delete after 7 days
 * - Sampling supported for high-volume bots
 */
export class AnalyticsService {
  private db: Firestore;
  private config: AnalyticsConfig;
  private eventBatch: AnalyticsEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(db: Firestore) {
    this.db = db;

    // Default configuration
    this.config = {
      enabled: true,
      trackCommands: true,
      trackSessions: true,
      trackAchievements: true,
      trackSocial: true,
      sampleRate: 1.0,
      rawEventRetentionDays: 7,
      aggregateRetentionDays: 90,
      batchSize: 10,
      batchTimeoutMs: 5000,
      anonymizeUserIds: false,
      excludedCommands: [],
      updatedAt: Timestamp.now(),
    };

    // Load config from Firestore on initialization
    this.loadConfig().catch((err) => {
      console.error('[Analytics] Failed to load config:', err.message);
    });
  }

  /**
   * Load analytics configuration from Firestore
   */
  private async loadConfig(): Promise<void> {
    try {
      const doc = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('config')
        .doc('settings')
        .get();

      if (doc.exists) {
        this.config = { ...this.config, ...doc.data() } as AnalyticsConfig;
      }
    } catch (error) {
      // Fail silently - use default config
      console.error('[Analytics] Config load error:', error);
    }
  }

  /**
   * Check if event should be tracked based on sampling rate
   */
  private shouldTrack(): boolean {
    if (!this.config.enabled) return false;
    if (this.config.sampleRate >= 1.0) return true;
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Get today's date string in YYYY-MM-DD format
   */
  private getTodayDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Hash user ID for privacy (if enabled)
   */
  private hashUserId(userId: string): string {
    if (!this.config.anonymizeUserIds) return userId;
    // Simple hash - replace with crypto.createHash for production
    return `user_${userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)}`;
  }

  /**
   * Add event to batch and flush if needed
   */
  private async addEventToBatch(event: AnalyticsEvent): Promise<void> {
    if (!this.shouldTrack()) return;

    this.eventBatch.push(event);

    // Flush if batch size reached
    if (this.eventBatch.length >= this.config.batchSize) {
      await this.flushBatch();
      return;
    }

    // Set timeout to flush batch if not already set
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch().catch((err) => {
          console.error('[Analytics] Batch flush error:', err.message);
        });
      }, this.config.batchTimeoutMs);
    }
  }

  /**
   * Flush event batch to Firestore
   */
  private async flushBatch(): Promise<void> {
    if (this.eventBatch.length === 0) return;

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const events = [...this.eventBatch];
    this.eventBatch = [];

    try {
      const batch = this.db.batch();
      const today = this.getTodayDateString();

      // Write raw events (for detailed analysis)
      events.forEach((event) => {
        const eventRef = this.db
          .collection('discord-data')
          .doc('analytics')
          .collection('events')
          .doc(today)
          .collection('raw')
          .doc(); // Auto-generated ID

        batch.set(eventRef, event);
      });

      // Update daily aggregates
      await this.updateDailyAggregates(events, today);

      // Commit batch
      await batch.commit();
    } catch (error) {
      // Fail silently - analytics should never crash the bot
      console.error('[Analytics] Batch write error:', error);
    }
  }

  /**
   * Update daily aggregate statistics
   */
  private async updateDailyAggregates(
    events: AnalyticsEvent[],
    date: string
  ): Promise<void> {
    try {
      // Group events by user
      const eventsByUser = new Map<string, AnalyticsEvent[]>();
      events.forEach((event) => {
        const userId = this.hashUserId(event.userId);
        if (!eventsByUser.has(userId)) {
          eventsByUser.set(userId, []);
        }
        eventsByUser.get(userId)!.push(event);
      });

      // Update each user's daily aggregate
      const batch = this.db.batch();

      for (const [userId, userEvents] of eventsByUser.entries()) {
        const aggregateRef = this.db
          .collection('discord-data')
          .doc('analytics')
          .collection('daily')
          .doc(`${userId}_${date}`);

        // Calculate aggregate updates
        const updates = this.calculateDailyUpdates(userEvents);

        batch.set(aggregateRef, updates, { merge: true });
      }

      await batch.commit();
    } catch (error) {
      console.error('[Analytics] Aggregate update error:', error);
    }
  }

  /**
   * Calculate daily aggregate updates from events
   */
  private calculateDailyUpdates(events: AnalyticsEvent[]): Partial<DailyAnalytics> {
    const updates: any = {
      updatedAt: Timestamp.now(),
    };

    // Count commands
    const commandEvents = events.filter((e) =>
      [AnalyticsEventType.COMMAND_EXECUTED, AnalyticsEventType.COMMAND_ERROR].includes(
        e.eventType
      )
    ) as CommandEvent[];

    if (commandEvents.length > 0) {
      updates.commandsExecuted = FieldValue.increment(
        commandEvents.filter((e) => e.metadata.success).length
      );
      updates.commandsFailed = FieldValue.increment(
        commandEvents.filter((e) => !e.metadata.success).length
      );

      // Command breakdown
      const breakdown: Record<string, number> = {};
      commandEvents.forEach((e) => {
        const cmd = e.metadata.commandName;
        breakdown[cmd] = (breakdown[cmd] || 0) + 1;
      });

      Object.entries(breakdown).forEach(([cmd, count]) => {
        updates[`commandBreakdown.${cmd}`] = FieldValue.increment(count);
      });

      // Average response time (weighted average)
      const totalResponseTime = commandEvents.reduce(
        (sum, e) => sum + e.metadata.responseTimeMs,
        0
      );
      updates.averageResponseTimeMs = totalResponseTime / commandEvents.length;
    }

    // Session events
    const sessionEvents = events.filter((e) =>
      [
        AnalyticsEventType.SESSION_STARTED,
        AnalyticsEventType.SESSION_ENDED,
        AnalyticsEventType.SESSION_CANCELLED,
      ].includes(e.eventType)
    ) as SessionEvent[];

    sessionEvents.forEach((e) => {
      if (e.eventType === AnalyticsEventType.SESSION_STARTED) {
        updates.sessionsStarted = FieldValue.increment(1);
      } else if (e.eventType === AnalyticsEventType.SESSION_ENDED) {
        updates.sessionsCompleted = FieldValue.increment(1);
        if (e.metadata.duration) {
          updates.totalSessionDuration = FieldValue.increment(e.metadata.duration);
        }
        if (e.metadata.xpGained) {
          updates.totalXpGained = FieldValue.increment(e.metadata.xpGained);
        }
      } else if (e.eventType === AnalyticsEventType.SESSION_CANCELLED) {
        updates.sessionsCancelled = FieldValue.increment(1);
      }
    });

    // Feature usage flags
    events.forEach((e) => {
      if (e.eventType === AnalyticsEventType.LEADERBOARD_VIEWED) {
        updates.viewedLeaderboard = true;
      } else if (e.eventType === AnalyticsEventType.STATS_VIEWED) {
        updates.viewedStats = true;
      } else if (e.eventType === AnalyticsEventType.FEED_VIEWED) {
        updates.viewedFeed = true;
      } else if (e.eventType === AnalyticsEventType.GOAL_SET) {
        updates.setGoal = true;
      } else if (e.eventType === AnalyticsEventType.GOAL_COMPLETED) {
        updates.completedGoal = true;
      } else if (e.eventType === AnalyticsEventType.REACTION_GIVEN) {
        updates.gaveReaction = true;
      }
    });

    // Achievements
    const achievementEvents = events.filter((e) =>
      [AnalyticsEventType.ACHIEVEMENT_UNLOCKED, AnalyticsEventType.LEVEL_UP].includes(
        e.eventType
      )
    ) as AchievementEvent[];

    achievementEvents.forEach((e) => {
      if (e.eventType === AnalyticsEventType.ACHIEVEMENT_UNLOCKED) {
        updates.achievementsUnlocked = FieldValue.increment(1);
      } else if (e.eventType === AnalyticsEventType.LEVEL_UP) {
        updates.levelsGained = FieldValue.increment(1);
      }
    });

    // First/last active timestamps
    if (events.length > 0) {
      const timestamps = events.map((e) => e.timestamp.toMillis());
      const firstTimestamp = Timestamp.fromMillis(Math.min(...timestamps));
      const lastTimestamp = Timestamp.fromMillis(Math.max(...timestamps));

      updates.firstActiveAt = firstTimestamp;
      updates.lastActiveAt = lastTimestamp;
    }

    return updates;
  }

  // ==================== PUBLIC TRACKING METHODS ====================

  /**
   * Track command execution
   */
  async trackCommand(
    userId: string,
    serverId: string,
    commandName: string,
    success: boolean,
    responseTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    if (!this.config.trackCommands) return;
    if (this.config.excludedCommands.includes(commandName)) return;

    const event: CommandEvent = {
      eventType: success
        ? AnalyticsEventType.COMMAND_EXECUTED
        : AnalyticsEventType.COMMAND_ERROR,
      category: AnalyticsCategory.COMMAND,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        commandName,
        success,
        responseTimeMs,
        errorMessage,
      },
    };

    await this.addEventToBatch(event);

    // Track user cohort on first command
    await this.ensureUserCohort(userId, serverId);
  }

  /**
   * Track session lifecycle events
   */
  async trackSessionStart(
    userId: string,
    serverId: string,
    activity: string,
    intensity?: number
  ): Promise<void> {
    if (!this.config.trackSessions) return;

    const event: SessionEvent = {
      eventType: AnalyticsEventType.SESSION_STARTED,
      category: AnalyticsCategory.SESSION,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        activity,
        intensity,
      },
    };

    await this.addEventToBatch(event);
  }

  async trackSessionEnd(
    userId: string,
    serverId: string,
    sessionId: string,
    duration: number,
    xpGained: number,
    intensity?: number
  ): Promise<void> {
    if (!this.config.trackSessions) return;

    const event: SessionEvent = {
      eventType: AnalyticsEventType.SESSION_ENDED,
      category: AnalyticsCategory.SESSION,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        sessionId,
        duration,
        xpGained,
        intensity,
      },
    };

    await this.addEventToBatch(event);
  }

  async trackSessionCancelled(userId: string, serverId: string): Promise<void> {
    if (!this.config.trackSessions) return;

    const event: SessionEvent = {
      eventType: AnalyticsEventType.SESSION_CANCELLED,
      category: AnalyticsCategory.SESSION,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {},
    };

    await this.addEventToBatch(event);
  }

  async trackSessionPaused(userId: string, serverId: string): Promise<void> {
    if (!this.config.trackSessions) return;

    const event: SessionEvent = {
      eventType: AnalyticsEventType.SESSION_PAUSED,
      category: AnalyticsCategory.SESSION,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {},
    };

    await this.addEventToBatch(event);
  }

  async trackSessionResumed(userId: string, serverId: string): Promise<void> {
    if (!this.config.trackSessions) return;

    const event: SessionEvent = {
      eventType: AnalyticsEventType.SESSION_RESUMED,
      category: AnalyticsCategory.SESSION,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {},
    };

    await this.addEventToBatch(event);
  }

  /**
   * Track achievement unlocks
   */
  async trackAchievementUnlock(
    userId: string,
    serverId: string,
    achievementId: string,
    achievementName: string,
    xpReward: number
  ): Promise<void> {
    if (!this.config.trackAchievements) return;

    const event: AchievementEvent = {
      eventType: AnalyticsEventType.ACHIEVEMENT_UNLOCKED,
      category: AnalyticsCategory.ACHIEVEMENT,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        achievementId,
        achievementName,
        xpReward,
      },
    };

    await this.addEventToBatch(event);
  }

  /**
   * Track level ups
   */
  async trackLevelUp(
    userId: string,
    serverId: string,
    oldLevel: number,
    newLevel: number
  ): Promise<void> {
    if (!this.config.trackAchievements) return;

    const event: AchievementEvent = {
      eventType: AnalyticsEventType.LEVEL_UP,
      category: AnalyticsCategory.ACHIEVEMENT,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        oldLevel,
        newLevel,
      },
    };

    await this.addEventToBatch(event);
  }

  /**
   * Track feature usage (leaderboards, stats, etc.)
   */
  async trackFeatureUsage(
    userId: string,
    serverId: string,
    featureName: string
  ): Promise<void> {
    const eventTypeMap: Record<string, AnalyticsEventType> = {
      leaderboard: AnalyticsEventType.LEADERBOARD_VIEWED,
      stats: AnalyticsEventType.STATS_VIEWED,
      feed: AnalyticsEventType.FEED_VIEWED,
    };

    const eventType = eventTypeMap[featureName];
    if (!eventType) return;

    const event: AnalyticsEvent = {
      eventType,
      category: AnalyticsCategory.COMMAND,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        featureName,
      },
    };

    await this.addEventToBatch(event);
  }

  /**
   * Track goal events
   */
  async trackGoalSet(userId: string, serverId: string, difficulty: string): Promise<void> {
    const event: AnalyticsEvent = {
      eventType: AnalyticsEventType.GOAL_SET,
      category: AnalyticsCategory.GOAL,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        difficulty,
      },
    };

    await this.addEventToBatch(event);
  }

  async trackGoalCompleted(
    userId: string,
    serverId: string,
    difficulty: string,
    xpGained: number
  ): Promise<void> {
    const event: AnalyticsEvent = {
      eventType: AnalyticsEventType.GOAL_COMPLETED,
      category: AnalyticsCategory.GOAL,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {
        difficulty,
        xpGained,
      },
    };

    await this.addEventToBatch(event);
  }

  /**
   * Track social interactions
   */
  async trackReactionGiven(userId: string, serverId: string): Promise<void> {
    if (!this.config.trackSocial) return;

    const event: AnalyticsEvent = {
      eventType: AnalyticsEventType.REACTION_GIVEN,
      category: AnalyticsCategory.SOCIAL,
      userId: this.hashUserId(userId),
      serverId,
      timestamp: Timestamp.now(),
      metadata: {},
    };

    await this.addEventToBatch(event);
  }

  /**
   * Ensure user cohort exists (for retention tracking)
   */
  private async ensureUserCohort(userId: string, serverId: string): Promise<void> {
    try {
      const hashedUserId = this.hashUserId(userId);
      const cohortRef = this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('cohorts')
        .doc(hashedUserId);

      const doc = await cohortRef.get();
      if (!doc.exists) {
        const now = Timestamp.now();
        const date = this.getTodayDateString();
        const cohortWeek = this.getISOWeek(now.toDate());
        const cohortMonth = date.substring(0, 7); // YYYY-MM

        const cohort: UserCohort = {
          userId: hashedUserId,
          username: 'Anonymous', // Don't store actual username for privacy
          firstSeenAt: now,
          firstSeenDate: date,
          cohortWeek,
          cohortMonth,
          serverId,
        };

        await cohortRef.set(cohort);
      }
    } catch (error) {
      console.error('[Analytics] Cohort creation error:', error);
    }
  }

  /**
   * Get ISO week string (YYYY-Wxx)
   */
  private getISOWeek(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  /**
   * Force flush any pending events (call on bot shutdown)
   */
  async flush(): Promise<void> {
    await this.flushBatch();
  }

  /**
   * Update analytics configuration
   */
  async updateConfig(updates: Partial<AnalyticsConfig>): Promise<void> {
    this.config = { ...this.config, ...updates, updatedAt: Timestamp.now() };

    await this.db
      .collection('discord-data')
      .doc('analytics')
      .collection('config')
      .doc('settings')
      .set(this.config, { merge: true });
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }
}
