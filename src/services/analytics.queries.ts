import { Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  DailyAnalytics,
  CommandHealth,
  FeatureUsage,
  RetentionMetrics,
  SessionFunnel,
  UserCohort,
} from './analytics.types';

/**
 * AnalyticsQueries - Pre-built queries for common analytics questions
 *
 * This service provides ready-to-use queries for analyzing your bot's usage.
 * All queries are optimized for Firestore and minimize read costs.
 */
export class AnalyticsQueries {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Get date string for N days ago
   */
  private getDateNDaysAgo(n: number): string {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date.toISOString().split('T')[0];
  }

  /**
   * Get today's date string
   */
  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  // ==================== COMMAND ANALYTICS ====================

  /**
   * Get command usage for the last N days
   *
   * @param days - Number of days to look back (default: 7)
   * @returns Map of command name -> execution count
   */
  async getCommandUsage(days: number = 7): Promise<Map<string, number>> {
    const startDate = this.getDateNDaysAgo(days);
    const commandCounts = new Map<string, number>();

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAnalytics;
        if (data.commandBreakdown) {
          Object.entries(data.commandBreakdown).forEach(([cmd, count]) => {
            commandCounts.set(cmd, (commandCounts.get(cmd) || 0) + count);
          });
        }
      });
    } catch (error) {
      console.error('[Analytics] Command usage query error:', error);
    }

    return commandCounts;
  }

  /**
   * Get top N most-used commands
   *
   * @param limit - Number of commands to return (default: 5)
   * @param days - Number of days to look back (default: 7)
   * @returns Array of [commandName, count] sorted by count descending
   */
  async getTopCommands(
    limit: number = 5,
    days: number = 7
  ): Promise<Array<[string, number]>> {
    const commandUsage = await this.getCommandUsage(days);

    return Array.from(commandUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Get least-used commands (potential candidates for removal)
   *
   * @param limit - Number of commands to return (default: 5)
   * @param days - Number of days to look back (default: 30)
   * @returns Array of [commandName, count] sorted by count ascending
   */
  async getLeastUsedCommands(
    limit: number = 5,
    days: number = 30
  ): Promise<Array<[string, number]>> {
    const commandUsage = await this.getCommandUsage(days);

    return Array.from(commandUsage.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit);
  }

  /**
   * Get command health metrics
   *
   * @param days - Number of days to analyze (default: 7)
   * @returns Array of CommandHealth objects
   */
  async getCommandHealth(days: number = 7): Promise<CommandHealth[]> {
    const startDate = this.getDateNDaysAgo(days);
    const commandStats = new Map<
      string,
      {
        executions: number;
        successes: number;
        errors: number;
        totalResponseTime: number;
        count: number;
      }
    >();

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAnalytics;
        if (data.commandBreakdown) {
          Object.entries(data.commandBreakdown).forEach(([cmd, count]) => {
            const stats = commandStats.get(cmd) || {
              executions: 0,
              successes: 0,
              errors: 0,
              totalResponseTime: 0,
              count: 0,
            };

            stats.executions += count;
            stats.successes += data.commandsExecuted || 0;
            stats.errors += data.commandsFailed || 0;
            stats.totalResponseTime += data.averageResponseTimeMs || 0;
            stats.count += 1;

            commandStats.set(cmd, stats);
          });
        }
      });

      // Convert to CommandHealth objects
      return Array.from(commandStats.entries()).map(([cmd, stats]) => ({
        commandName: cmd,
        totalExecutions: stats.executions,
        executionsToday: 0, // Would need separate query
        executionsThisWeek: stats.executions,
        executionsThisMonth: 0, // Would need separate query
        successCount: stats.successes,
        errorCount: stats.errors,
        successRate: stats.executions > 0 ? stats.successes / stats.executions : 1,
        averageResponseTimeMs: stats.count > 0 ? stats.totalResponseTime / stats.count : 0,
        slowestResponseTimeMs: 0, // Would need raw event query
        uniqueUsers: 0, // Would need separate query
        activeUsers: 0, // Would need separate query
        isUnderutilized: stats.executions < 10,
        isErrorProne: stats.executions > 0 && stats.successes / stats.executions < 0.9,
        isSlow: stats.count > 0 && stats.totalResponseTime / stats.count > 3000,
        lastUsedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }));
    } catch (error) {
      console.error('[Analytics] Command health query error:', error);
      return [];
    }
  }

  // ==================== USER RETENTION ====================

  /**
   * Get Daily Active Users (DAU)
   *
   * @param date - Date string (YYYY-MM-DD), defaults to today
   * @returns Number of unique users active on that date
   */
  async getDAU(date?: string): Promise<number> {
    const targetDate = date || this.getTodayDateString();

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '==', targetDate)
        .get();

      return snapshot.size; // Each doc represents one user
    } catch (error) {
      console.error('[Analytics] DAU query error:', error);
      return 0;
    }
  }

  /**
   * Get Weekly Active Users (WAU) - last 7 days
   *
   * @returns Number of unique users active in last 7 days
   */
  async getWAU(): Promise<number> {
    const startDate = this.getDateNDaysAgo(7);

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      // Get unique user IDs
      const userIds = new Set<string>();
      snapshot.forEach((doc) => {
        const userId = doc.id.split('_')[0]; // Extract userId from doc ID (userId_date)
        userIds.add(userId);
      });

      return userIds.size;
    } catch (error) {
      console.error('[Analytics] WAU query error:', error);
      return 0;
    }
  }

  /**
   * Get Monthly Active Users (MAU) - last 30 days
   *
   * @returns Number of unique users active in last 30 days
   */
  async getMAU(): Promise<number> {
    const startDate = this.getDateNDaysAgo(30);

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      // Get unique user IDs
      const userIds = new Set<string>();
      snapshot.forEach((doc) => {
        const userId = doc.id.split('_')[0];
        userIds.add(userId);
      });

      return userIds.size;
    } catch (error) {
      console.error('[Analytics] MAU query error:', error);
      return 0;
    }
  }

  /**
   * Get retention rate for a specific cohort
   *
   * @param cohortDate - Date when users first joined (YYYY-MM-DD)
   * @param checkDate - Date to check retention (YYYY-MM-DD)
   * @returns Retention rate (0-1)
   */
  async getCohortRetention(cohortDate: string, checkDate: string): Promise<number> {
    try {
      // Get cohort size
      const cohortSnapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('cohorts')
        .where('firstSeenDate', '==', cohortDate)
        .get();

      const cohortSize = cohortSnapshot.size;
      if (cohortSize === 0) return 0;

      // Get active users from that cohort on check date
      const cohortUserIds = new Set<string>();
      cohortSnapshot.forEach((doc) => {
        cohortUserIds.add(doc.id);
      });

      const activeSnapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '==', checkDate)
        .get();

      let activeFromCohort = 0;
      activeSnapshot.forEach((doc) => {
        const userId = doc.id.split('_')[0];
        if (cohortUserIds.has(userId)) {
          activeFromCohort++;
        }
      });

      return activeFromCohort / cohortSize;
    } catch (error) {
      console.error('[Analytics] Cohort retention query error:', error);
      return 0;
    }
  }

  /**
   * Get new users count for a date range
   *
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD), defaults to today
   * @returns Number of new users
   */
  async getNewUsers(startDate: string, endDate?: string): Promise<number> {
    const targetEndDate = endDate || this.getTodayDateString();

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('cohorts')
        .where('firstSeenDate', '>=', startDate)
        .where('firstSeenDate', '<=', targetEndDate)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error('[Analytics] New users query error:', error);
      return 0;
    }
  }

  // ==================== SESSION ANALYTICS ====================

  /**
   * Get session funnel metrics
   *
   * @param days - Number of days to analyze (default: 7)
   * @returns SessionFunnel object
   */
  async getSessionFunnel(days: number = 7): Promise<SessionFunnel> {
    const startDate = this.getDateNDaysAgo(days);
    let sessionsStarted = 0;
    let sessionsCompleted = 0;
    let sessionsCancelled = 0;
    let totalDuration = 0;
    let totalXp = 0;

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAnalytics;
        sessionsStarted += data.sessionsStarted || 0;
        sessionsCompleted += data.sessionsCompleted || 0;
        sessionsCancelled += data.sessionsCancelled || 0;
        totalDuration += data.totalSessionDuration || 0;
        totalXp += data.totalXpGained || 0;
      });

      return {
        date: this.getTodayDateString(),
        sessionsStarted,
        sessionsPaused: 0, // Would need separate tracking
        sessionsResumed: 0, // Would need separate tracking
        sessionsCompleted,
        sessionsCancelled,
        completionRate: sessionsStarted > 0 ? sessionsCompleted / sessionsStarted : 0,
        cancellationRate: sessionsStarted > 0 ? sessionsCancelled / sessionsStarted : 0,
        pauseRate: 0,
        averageDuration: sessionsCompleted > 0 ? totalDuration / sessionsCompleted : 0,
        averageXpPerSession: sessionsCompleted > 0 ? totalXp / sessionsCompleted : 0,
        updatedAt: Timestamp.now(),
      };
    } catch (error) {
      console.error('[Analytics] Session funnel query error:', error);
      return {
        date: this.getTodayDateString(),
        sessionsStarted: 0,
        sessionsPaused: 0,
        sessionsResumed: 0,
        sessionsCompleted: 0,
        sessionsCancelled: 0,
        completionRate: 0,
        cancellationRate: 0,
        pauseRate: 0,
        averageDuration: 0,
        averageXpPerSession: 0,
        updatedAt: Timestamp.now(),
      };
    }
  }

  /**
   * Get session completion rate (% of started sessions that were completed)
   *
   * @param days - Number of days to analyze (default: 7)
   * @returns Completion rate (0-1)
   */
  async getSessionCompletionRate(days: number = 7): Promise<number> {
    const funnel = await this.getSessionFunnel(days);
    return funnel.completionRate;
  }

  // ==================== FEATURE ADOPTION ====================

  /**
   * Get feature usage summary
   *
   * @param days - Number of days to analyze (default: 7)
   * @returns Map of feature name -> usage count
   */
  async getFeatureUsage(days: number = 7): Promise<Map<string, number>> {
    const startDate = this.getDateNDaysAgo(days);
    const featureUsage = new Map<string, number>();

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAnalytics;

        if (data.viewedLeaderboard) {
          featureUsage.set('leaderboard', (featureUsage.get('leaderboard') || 0) + 1);
        }
        if (data.viewedStats) {
          featureUsage.set('stats', (featureUsage.get('stats') || 0) + 1);
        }
        if (data.viewedFeed) {
          featureUsage.set('feed', (featureUsage.get('feed') || 0) + 1);
        }
        if (data.setGoal) {
          featureUsage.set('goal_setting', (featureUsage.get('goal_setting') || 0) + 1);
        }
        if (data.completedGoal) {
          featureUsage.set('goal_completion', (featureUsage.get('goal_completion') || 0) + 1);
        }
      });
    } catch (error) {
      console.error('[Analytics] Feature usage query error:', error);
    }

    return featureUsage;
  }

  /**
   * Get feature adoption rate (% of users who've used a feature at least once)
   *
   * @param featureName - Name of the feature
   * @param days - Number of days to analyze (default: 30)
   * @returns Adoption rate (0-1)
   */
  async getFeatureAdoptionRate(featureName: string, days: number = 30): Promise<number> {
    const startDate = this.getDateNDaysAgo(days);

    try {
      // Get total unique users
      const allUsersSnapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      const allUserIds = new Set<string>();
      allUsersSnapshot.forEach((doc) => {
        const userId = doc.id.split('_')[0];
        allUserIds.add(userId);
      });

      const totalUsers = allUserIds.size;
      if (totalUsers === 0) return 0;

      // Get users who used this feature
      const featureField = this.getFeatureField(featureName);
      if (!featureField) return 0;

      const featureUsersSnapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .where(featureField, '==', true)
        .get();

      const featureUserIds = new Set<string>();
      featureUsersSnapshot.forEach((doc) => {
        const userId = doc.id.split('_')[0];
        featureUserIds.add(userId);
      });

      return featureUserIds.size / totalUsers;
    } catch (error) {
      console.error('[Analytics] Feature adoption query error:', error);
      return 0;
    }
  }

  /**
   * Map feature names to DailyAnalytics fields
   */
  private getFeatureField(featureName: string): string | null {
    const fieldMap: Record<string, string> = {
      leaderboard: 'viewedLeaderboard',
      stats: 'viewedStats',
      feed: 'viewedFeed',
      goal_setting: 'setGoal',
      goal_completion: 'completedGoal',
      reactions: 'gaveReaction',
    };

    return fieldMap[featureName] || null;
  }

  // ==================== ACHIEVEMENT ANALYTICS ====================

  /**
   * Get achievement unlock distribution
   *
   * @param days - Number of days to analyze (default: 30)
   * @returns Total achievements unlocked
   */
  async getAchievementsUnlocked(days: number = 30): Promise<number> {
    const startDate = this.getDateNDaysAgo(days);
    let total = 0;

    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data() as DailyAnalytics;
        total += data.achievementsUnlocked || 0;
      });
    } catch (error) {
      console.error('[Analytics] Achievements query error:', error);
    }

    return total;
  }

  // ==================== DASHBOARD SUMMARY ====================

  /**
   * Get a comprehensive dashboard summary
   *
   * @returns Object with all key metrics
   */
  async getDashboardSummary() {
    const [
      dau,
      wau,
      mau,
      topCommands,
      leastUsedCommands,
      sessionFunnel,
      featureUsage,
      achievementsUnlocked,
      newUsersWeek,
    ] = await Promise.all([
      this.getDAU(),
      this.getWAU(),
      this.getMAU(),
      this.getTopCommands(5, 7),
      this.getLeastUsedCommands(5, 30),
      this.getSessionFunnel(7),
      this.getFeatureUsage(7),
      this.getAchievementsUnlocked(7),
      this.getNewUsers(this.getDateNDaysAgo(7)),
    ]);

    return {
      activeUsers: {
        dau,
        wau,
        mau,
        dauWauRatio: wau > 0 ? dau / wau : 0,
        wauMauRatio: mau > 0 ? wau / mau : 0,
      },
      commands: {
        topCommands,
        leastUsedCommands,
      },
      sessions: {
        started: sessionFunnel.sessionsStarted,
        completed: sessionFunnel.sessionsCompleted,
        cancelled: sessionFunnel.sessionsCancelled,
        completionRate: sessionFunnel.completionRate,
        averageDuration: sessionFunnel.averageDuration,
        averageXp: sessionFunnel.averageXpPerSession,
      },
      features: {
        usage: Object.fromEntries(featureUsage),
      },
      achievements: {
        unlocked: achievementsUnlocked,
      },
      growth: {
        newUsersThisWeek: newUsersWeek,
      },
    };
  }

  // ==================== EXPORT UTILITIES ====================

  /**
   * Export daily analytics to JSON for external analysis
   *
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Array of DailyAnalytics objects
   */
  async exportDailyAnalytics(startDate: string, endDate: string): Promise<DailyAnalytics[]> {
    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('analytics')
        .collection('daily')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

      return snapshot.docs.map((doc) => doc.data() as DailyAnalytics);
    } catch (error) {
      console.error('[Analytics] Export error:', error);
      return [];
    }
  }
}
