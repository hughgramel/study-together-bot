import { Timestamp } from 'firebase-admin/firestore';

/**
 * Active session record - one per user maximum
 */
export interface ActiveSession {
  userId: string;           // Discord user ID
  username: string;         // Discord username (updated on each action)
  serverId: string;         // Discord guild/server ID
  activity: string;         // What the user is working on
  startTime: Timestamp;     // Firebase server timestamp
  isPaused: boolean;        // Current pause state
  pausedAt?: Timestamp;     // Timestamp when last paused (if isPaused = true)
  pausedDuration: number;   // Total seconds spent paused
  isVCSession?: boolean;    // Whether this session was started by joining VC
  vcChannelId?: string;     // Voice channel ID if VC session
  leftVCAt?: Timestamp;     // Timestamp when user left VC (for pending completion)
  pendingCompletion?: boolean; // Whether waiting for /end or 1-hour auto-post
  intensity?: number;       // Session intensity (1-5 scale) - affects XP multiplier
}

/**
 * Completed session record
 */
export interface CompletedSession {
  userId: string;           // Discord user ID
  username: string;         // Discord username
  serverId: string;         // Discord guild/server ID
  activity: string;         // What the user worked on
  title: string;            // Session title
  description: string;      // What was actually accomplished
  duration: number;         // Total session duration in seconds
  startTime: Timestamp;     // When session started
  endTime: Timestamp;       // When session ended
  createdAt: Timestamp;     // Document creation time (for sorting)
  intensity?: number;       // Session intensity (1-5 scale) - affects XP multiplier
  xpGained?: number;        // XP earned from this session (for leaderboards)
}

/**
 * User statistics - one per user
 */
export interface UserStats {
  username: string;         // Discord username (updated on each session)
  totalSessions: number;    // All-time session count
  totalDuration: number;    // All-time duration in seconds
  currentStreak: number;    // Current consecutive days with sessions
  longestStreak: number;    // Best streak ever
  lastSessionAt: Timestamp; // Most recent session timestamp
  firstSessionAt: Timestamp; // First ever session timestamp

  // XP & Achievement System (Phase 1)
  xp?: number;              // Total XP earned (10 XP/hour + bonuses)
  achievements?: string[];  // Array of unlocked achievement IDs (e.g., ['first_steps', 'hot_streak'])
  achievementsUnlockedAt?: { // Map of achievement ID -> unlock timestamp
    [achievementId: string]: Timestamp;
  };

  // Session Analytics (for achievement unlock conditions)
  sessionsByDay?: {         // Map of date (YYYY-MM-DD) -> session count for that day
    [date: string]: number; // Example: { '2025-01-15': 3 } = 3 sessions on Jan 15
  };
  activityTypes?: string[]; // Unique activity types user has logged (for diversity achievements)
  longestSessionDuration?: number; // Longest single session in seconds (for marathon achievements)
  firstSessionOfDayCount?: number; // Number of times user started the first session of the day

  // Time-of-Day Tracking (for Early Bird/Night Owl achievements)
  sessionsBeforeNoon?: number;     // Count of sessions started before 12:00 PM
  sessionsAfterMidnight?: number;  // Count of sessions started after 12:00 AM
  sessionsBefore7AM?: number;      // Sessions completed before 7:00 AM
  sessionsAfter11PM?: number;      // Sessions completed after 11:00 PM
  morningSessionsBefore10AM?: number; // Sessions of 1+ hour completed before 10:00 AM

  // Schedule Pattern Tracking (for Weekend/Weekly achievements)
  weekendWarriorWeeks?: number;       // Weeks with sessions on both Saturday and Sunday
  consecutiveWeekendStreak?: number;  // Current streak of consecutive weekends with both Sat+Sun sessions
  fullWeeksCompleted?: number;        // Weeks with sessions on all 7 days
  bestMonthDaysCount?: number;        // Highest number of days studied in any single month
  newRecordUnlocked?: boolean;        // Temporary flag indicating user beat their personal best
  weekdayTracking?: {                 // Map of week key -> array of days with sessions (0-6)
    [weekKey: string]: number[];      // Example: { '2025-W03': [0, 1, 6] } = Sun, Mon, Sat
  };
  monthDayTracking?: {                // Map of month key -> array of dates with sessions
    [monthKey: string]: string[];     // Example: { '2025-01': ['2025-01-15', '2025-01-16'] }
  };

  // Social Engagement (Phase 2)
  reactionsReceived?: number;      // Total reactions received on user's posts
  reactionsGiven?: number;         // Total reactions given to others' posts
  cheersReceived?: number;         // Total cheers/kudos received
  cheersGiven?: number;            // Total cheers/kudos given

  // Weekly Challenge Tracking (Phase 2)
  weeklyXpEarned?: {               // Map of week key -> XP earned
    [weekKey: string]: number;     // Example: { '2025-W03': 1250 }
  };
  weeklyStreakCount?: number;      // Consecutive weeks hitting challenge target

  // Profile Stats (Phase 2)
  favoriteActivity?: string;           // Most common activity type
  peakLevel?: number;                  // Highest level ever reached
  firstAchievementUnlockedAt?: Timestamp; // When first achievement was unlocked
}

/**
 * Server configuration - one per Discord server
 */
export interface ServerConfig {
  feedChannelId?: string;   // Discord channel ID for feed posts
  focusRoomIds?: string[];  // Voice channel IDs that auto-start sessions
  setupAt: Timestamp;       // When configuration was last updated
  setupBy: string;          // Discord user ID of admin who set it up
}

/**
 * Achievement definition - defines an unlockable achievement
 */
export interface AchievementDefinition {
  id: string;               // Unique achievement identifier (e.g., 'first_steps', 'centurion')
  name: string;             // Display name shown to users (e.g., 'First Steps', 'Centurion')
  emoji: string;            // Emoji representation (e.g., '🎯', '🔥', '💯')
  description: string;      // What the achievement is for (e.g., 'Complete your first session')
  category: 'milestone' | 'time' | 'streak' | 'social' | 'intensity' | 'diversity' | 'schedule' | 'level' | 'meta'; // Achievement category
  xpReward: number;         // Bonus XP awarded when achievement is unlocked (50-1000)
  condition: {              // Unlock requirements
    type: 'sessions' | 'hours' | 'streak' | 'activities' | 'custom'; // Type of condition
    threshold: number;      // Target value to reach (e.g., 100 for "100 hours")
    field?: string;         // UserStats field to check (e.g., 'totalDuration', 'currentStreak')
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary'; // Achievement rarity (affects display color)
  order: number;            // Display sort order (lower = shown first)
}

/**
 * Session post - tracks session feed posts for social features (Phase 2)
 */
export interface SessionPost {
  messageId: string;        // Discord message ID (document ID)
  userId: string;           // User who completed the session
  username: string;         // Discord username
  guildId: string;          // Discord server ID
  channelId: string;        // Feed channel ID
  sessionId: string;        // Reference to completed session
  duration: number;            // Session duration in seconds
  xpGained: number;            // XP awarded for this session
  levelGained?: number;        // New level if leveled up
  achievementsUnlocked?: string[]; // Achievement IDs unlocked in this session
  postedAt: Timestamp;         // When posted to feed
  reactions: {              // Map of emoji -> array of user IDs who reacted
    [emoji: string]: string[];
  };
  cheers: Array<{           // Cheers/kudos given to this post
    userId: string;
    username: string;
    message: string;
    timestamp: Timestamp;
  }>;
}

/**
 * Weekly challenge - tracks weekly XP goals and leaderboards (Phase 2)
 */
export interface WeeklyChallenge {
  weekKey: string;          // ISO week format (e.g., '2025-W03')
  startDate: Timestamp;     // Week start (Monday 00:00)
  endDate: Timestamp;       // Week end (Sunday 23:59)
  targetXp: number;            // XP goal for the week
  bonusXp: number;             // Bonus XP for completing
  bonusAchievement?: string;   // Optional achievement ID for completion
  participants: string[];      // User IDs who participated this week
  completedBy: string[];    // User IDs who completed the challenge
  topEarners: Array<{       // Top 10 leaderboard for the week
    userId: string;
    username: string;
    xpEarned: number;
    level: number;
  }>;
}

/**
 * Daily goal - tracks user's daily goal
 */
export interface DailyGoal {
  userId: string;           // Discord user ID
  username: string;         // Discord username
  currentGoal?: string;     // Current daily goal text
  lastGoalSetAt?: Timestamp; // Most recent goal set timestamp
  goalsByDay?: {            // Map of date (YYYY-MM-DD) -> goal text
    [date: string]: string;
  };
}
