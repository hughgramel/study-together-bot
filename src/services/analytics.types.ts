import { Timestamp } from 'firebase-admin/firestore';

/**
 * Event types for tracking different user actions
 */
export enum AnalyticsEventType {
  // Command execution events
  COMMAND_EXECUTED = 'command_executed',
  COMMAND_ERROR = 'command_error',

  // Session lifecycle events
  SESSION_STARTED = 'session_started',
  SESSION_PAUSED = 'session_paused',
  SESSION_RESUMED = 'session_resumed',
  SESSION_ENDED = 'session_ended',
  SESSION_CANCELLED = 'session_cancelled',

  // Achievement & XP events
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  LEVEL_UP = 'level_up',
  XP_GAINED = 'xp_gained',

  // Goal events
  GOAL_SET = 'goal_set',
  GOAL_COMPLETED = 'goal_completed',

  // Social events
  REACTION_GIVEN = 'reaction_given',
  REACTION_RECEIVED = 'reaction_received',

  // Feature usage events
  LEADERBOARD_VIEWED = 'leaderboard_viewed',
  STATS_VIEWED = 'stats_viewed',
  FEED_VIEWED = 'feed_viewed',

  // Onboarding events
  FIRST_COMMAND = 'first_command',
  FIRST_SESSION_COMPLETED = 'first_session_completed',
}

/**
 * Event categories for grouping related events
 */
export enum AnalyticsCategory {
  COMMAND = 'command',
  SESSION = 'session',
  ACHIEVEMENT = 'achievement',
  SOCIAL = 'social',
  GOAL = 'goal',
  ONBOARDING = 'onboarding',
}

/**
 * Raw analytics event - minimal storage for individual events
 */
export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  category: AnalyticsCategory;
  userId: string;
  serverId: string;
  timestamp: Timestamp;
  metadata?: Record<string, any>; // Additional context-specific data
}

/**
 * Command execution tracking
 */
export interface CommandEvent extends AnalyticsEvent {
  eventType: AnalyticsEventType.COMMAND_EXECUTED | AnalyticsEventType.COMMAND_ERROR;
  metadata: {
    commandName: string;
    success: boolean;
    responseTimeMs: number;
    errorMessage?: string;
  };
}

/**
 * Session lifecycle tracking
 */
export interface SessionEvent extends AnalyticsEvent {
  eventType:
    | AnalyticsEventType.SESSION_STARTED
    | AnalyticsEventType.SESSION_PAUSED
    | AnalyticsEventType.SESSION_RESUMED
    | AnalyticsEventType.SESSION_ENDED
    | AnalyticsEventType.SESSION_CANCELLED;
  metadata: {
    sessionId?: string;
    activity?: string;
    duration?: number; // seconds (for ended/cancelled)
    intensity?: number; // 1-5 scale
    xpGained?: number; // for ended sessions
  };
}

/**
 * Achievement tracking
 */
export interface AchievementEvent extends AnalyticsEvent {
  eventType: AnalyticsEventType.ACHIEVEMENT_UNLOCKED | AnalyticsEventType.LEVEL_UP;
  metadata: {
    achievementId?: string;
    achievementName?: string;
    xpReward?: number;
    newLevel?: number;
    oldLevel?: number;
  };
}

/**
 * Daily aggregate statistics - one document per user per day
 * This reduces storage costs by aggregating raw events
 */
export interface DailyAnalytics {
  userId: string;
  date: string; // YYYY-MM-DD format
  serverId: string; // Primary server (most active server that day)

  // Command usage
  commandsExecuted: number;
  commandsFailed: number;
  commandBreakdown: {
    // Map of command name -> execution count
    [commandName: string]: number;
  };
  averageResponseTimeMs: number;

  // Session stats
  sessionsStarted: number;
  sessionsCompleted: number;
  sessionsCancelled: number;
  totalSessionDuration: number; // seconds
  totalXpGained: number;

  // Feature usage flags (true if used at least once that day)
  viewedLeaderboard: boolean;
  viewedStats: boolean;
  viewedFeed: boolean;
  setGoal: boolean;
  completedGoal: boolean;
  gaveReaction: boolean;

  // Achievement progress
  achievementsUnlocked: number;
  levelsGained: number;

  // Timestamps
  firstActiveAt: Timestamp; // First event of the day
  lastActiveAt: Timestamp; // Last event of the day
  updatedAt: Timestamp; // Last update to this document
}

/**
 * User cohort - tracks when users first joined
 */
export interface UserCohort {
  userId: string;
  username: string;
  firstSeenAt: Timestamp; // When user first used the bot
  firstSeenDate: string; // YYYY-MM-DD
  cohortWeek: string; // ISO week format (e.g., '2025-W03')
  cohortMonth: string; // YYYY-MM format (e.g., '2025-01')
  serverId: string; // Primary server
}

/**
 * Feature usage summary - tracks adoption of each feature
 */
export interface FeatureUsage {
  featureName: string;
  category: string; // 'session', 'stats', 'social', 'goal', 'leaderboard'

  // Adoption metrics
  totalUsers: number; // Total users who've ever used this feature
  activeUsersToday: number;
  activeUsersThisWeek: number;
  activeUsersThisMonth: number;

  // Usage metrics
  totalUsageCount: number; // All-time usage count
  usageToday: number;
  usageThisWeek: number;
  usageThisMonth: number;

  // Engagement
  averageUsagePerUser: number; // totalUsageCount / totalUsers
  powerUsers: number; // Users who use this feature >5x/week

  // Timestamps
  lastUsedAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Retention metrics - tracks DAU/WAU/MAU
 */
export interface RetentionMetrics {
  date: string; // YYYY-MM-DD

  // Active user counts
  dau: number; // Daily Active Users
  wau: number; // Weekly Active Users (last 7 days)
  mau: number; // Monthly Active Users (last 30 days)

  // Cohort retention (users first seen on specific dates)
  day1Retention: number; // % of users from yesterday who returned today
  day7Retention: number; // % of users from 7 days ago who returned today
  day30Retention: number; // % of users from 30 days ago who returned today

  // New users
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;

  // Churn indicators
  churnedUsers: number; // Users who haven't been active in 30+ days
  atRiskUsers: number; // Users who haven't been active in 7-29 days

  updatedAt: Timestamp;
}

/**
 * Command health metrics - identifies underused/broken commands
 */
export interface CommandHealth {
  commandName: string;

  // Usage metrics
  totalExecutions: number;
  executionsToday: number;
  executionsThisWeek: number;
  executionsThisMonth: number;

  // Success rate
  successCount: number;
  errorCount: number;
  successRate: number; // successCount / totalExecutions

  // Performance
  averageResponseTimeMs: number;
  slowestResponseTimeMs: number;

  // Adoption
  uniqueUsers: number; // Total users who've used this command
  activeUsers: number; // Users who've used it in last 7 days

  // Health indicators
  isUnderutilized: boolean; // < 10 uses/week
  isErrorProne: boolean; // Success rate < 90%
  isSlow: boolean; // Average response > 3000ms

  lastUsedAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Session funnel - tracks drop-off points in session flow
 */
export interface SessionFunnel {
  date: string; // YYYY-MM-DD

  // Funnel stages
  sessionsStarted: number;
  sessionsPaused: number;
  sessionsResumed: number;
  sessionsCompleted: number;
  sessionsCancelled: number;

  // Conversion rates
  completionRate: number; // sessionsCompleted / sessionsStarted
  cancellationRate: number; // sessionsCancelled / sessionsStarted
  pauseRate: number; // sessionsPaused / sessionsStarted

  // Average metrics
  averageDuration: number; // seconds
  averageXpPerSession: number;

  updatedAt: Timestamp;
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  // Feature flags
  enabled: boolean;
  trackCommands: boolean;
  trackSessions: boolean;
  trackAchievements: boolean;
  trackSocial: boolean;

  // Sampling (for high-volume bots)
  sampleRate: number; // 0.0 to 1.0 (1.0 = track all events)

  // Retention
  rawEventRetentionDays: number; // How long to keep raw events (default: 7)
  aggregateRetentionDays: number; // How long to keep daily aggregates (default: 90)

  // Batch settings
  batchSize: number; // Max events to batch before writing (default: 10)
  batchTimeoutMs: number; // Max time to wait before flushing batch (default: 5000)

  // Privacy
  anonymizeUserIds: boolean; // Hash user IDs for privacy
  excludedCommands: string[]; // Commands to not track (e.g., admin commands)

  updatedAt: Timestamp;
}

/**
 * Drop-off point detection - identifies where users abandon features
 */
export interface DropOffPoint {
  feature: string; // Feature name (e.g., 'session_flow', 'goal_setting')
  stage: string; // Stage in the flow (e.g., 'started', 'paused', 'completed')

  // Metrics
  usersReached: number; // Users who reached this stage
  usersProgressed: number; // Users who moved to next stage
  dropOffRate: number; // (usersReached - usersProgressed) / usersReached

  // Comparisons
  expectedDropOffRate: number; // Industry benchmark or historical average
  isAnomaly: boolean; // Drop-off rate significantly higher than expected

  date: string; // YYYY-MM-DD
  updatedAt: Timestamp;
}
