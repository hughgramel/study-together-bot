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
  longestSessionDuration: number; // Longest single session in seconds (PR)
  mostHoursInDay: number;   // Most hours logged in a single day in seconds (PR)
  mostHoursInWeek: number;  // Most hours logged in a single week in seconds (PR)
  achievements: string[];   // Array of achievement IDs earned by user
}

/**
 * Server configuration - one per Discord server
 */
export interface ServerConfig {
  feedChannelId: string;    // Discord channel ID for feed posts
  setupAt: Timestamp;       // When feed was configured
  setupBy: string;          // Discord user ID of admin who set it up
}
