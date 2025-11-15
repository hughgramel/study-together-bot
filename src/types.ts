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

  // XP & Badge System (Phase 1)
  xp?: number;              // Total XP earned (10 XP/hour + bonuses)
  badges?: string[];        // Array of unlocked badge IDs (e.g., ['first_steps', 'hot_streak'])
  badgesUnlockedAt?: {      // Map of badge ID -> unlock timestamp
    [badgeId: string]: Timestamp;
  };

  // Session Analytics (for badge unlock conditions)
  sessionsByDay?: {         // Map of date (YYYY-MM-DD) -> session count for that day
    [date: string]: number; // Example: { '2025-01-15': 3 } = 3 sessions on Jan 15
  };
  activityTypes?: string[]; // Unique activity types user has logged (for diversity badges)
  longestSessionDuration?: number; // Longest single session in seconds (for marathon badges)
  firstSessionOfDayCount?: number; // Number of times user started the first session of the day

  // Time-of-Day Tracking (for Early Bird/Night Owl badges)
  sessionsBeforeNoon?: number;     // Count of sessions started before 12:00 PM
  sessionsAfterMidnight?: number;  // Count of sessions started after 12:00 AM
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
 * Badge definition - defines an achievement badge
 */
export interface BadgeDefinition {
  id: string;               // Unique badge identifier (e.g., 'first_steps', 'centurion')
  name: string;             // Display name shown to users (e.g., 'First Steps', 'Centurion')
  emoji: string;            // Emoji representation (e.g., '🎯', '🔥', '💯')
  description: string;      // What the badge is for (e.g., 'Complete your first session')
  category: 'milestone' | 'time' | 'streak' | 'social' | 'intensity' | 'diversity'; // Badge category
  xpReward: number;         // Bonus XP awarded when badge is unlocked (50-1000)
  condition: {              // Unlock requirements
    type: 'sessions' | 'hours' | 'streak' | 'activities' | 'custom'; // Type of condition
    threshold: number;      // Target value to reach (e.g., 100 for "100 hours")
    field?: string;         // UserStats field to check (e.g., 'totalDuration', 'currentStreak')
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary'; // Badge rarity (affects display color)
  order: number;            // Display sort order (lower = shown first)
}
