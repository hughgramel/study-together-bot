/**
 * Type Definitions - Centralized TypeScript interfaces for the Study Together Bot
 *
 * This file contains all TypeScript type definitions used throughout the bot.
 * Organized by functional area for easy navigation. All Firebase data models,
 * configuration types, and domain objects are defined here.
 *
 * Sections:
 * - Session Management: Active and completed session tracking
 * - User Statistics: User progress, XP, achievements, and analytics
 * - Server Configuration: Per-server settings
 * - Achievements System: Achievement definitions and tracking
 * - Social Features: Posts, reactions, and weekly challenges
 * - Goals System: Daily goals and task tracking
 * - Events System: Scheduled study events and RSVPs
 * - Groups System: Study groups and membership
 *
 * @module types
 */

import { Timestamp } from 'firebase-admin/firestore';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Active session record - one per user maximum
 *
 * Tracks a user's currently running study session. Only one active session
 * can exist per user at a time. Supports pause/unpause functionality and
 * intensity ratings for XP multipliers.
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
  intensity?: number;       // Session intensity (1-5 scale) - affects XP multiplier
}

/**
 * Completed session record
 *
 * Permanent record of a finished study session. Created when users run /stop.
 * Used for statistics, achievements, leaderboards, and social feed posts.
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

// ============================================================================
// USER STATISTICS
// ============================================================================

/**
 * User statistics - one per user
 *
 * Comprehensive tracking of user progress, achievements, and study patterns.
 * Updated after each session completion. Includes XP, achievements, streaks,
 * time-of-day analytics, and social engagement metrics.
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
  newRecordUnlocked?: boolean;        // Flag indicating user beat their personal best (triggers new_record achievement)
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

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

/**
 * Server configuration - one per Discord server
 *
 * Stores per-server settings configured by admins. Includes channel IDs
 * for feed posts, welcome messages, events, and timezone preferences.
 */
export interface ServerConfig {
  feedChannelId?: string;   // Discord channel ID for feed posts
  welcomeChannelId?: string; // Discord channel ID for welcome messages
  eventsChannelId?: string; // Discord channel ID for study events
  goalChannelId?: string;   // Discord channel ID for goal/task parsing
  timezone?: string;        // IANA timezone (e.g., 'America/New_York', 'America/Los_Angeles')
  setupAt: Timestamp;       // When configuration was last updated
  setupBy: string;          // Discord user ID of admin who set it up
}

// ============================================================================
// ACHIEVEMENTS SYSTEM
// ============================================================================

/**
 * Achievement definition - defines an unlockable achievement
 *
 * Template for achievements users can unlock. Defines unlock conditions,
 * XP rewards, rarity tiers, and display information. All achievement
 * definitions are stored in src/data/achievements.ts.
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

// ============================================================================
// SOCIAL FEATURES
// ============================================================================

/**
 * Session post - tracks session feed posts for social features
 *
 * Represents a Strava-style post in the feed channel after session completion.
 * Tracks reactions, cheers, and engagement metrics for social features.
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
 * Weekly challenge - tracks weekly XP goals and leaderboards
 *
 * Weekly community challenge with XP targets. Tracks participants,
 * completions, and top earners for competitive leaderboards.
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

// ============================================================================
// GOALS SYSTEM
// ============================================================================

/**
 * Individual goal item
 *
 * A single goal/task with difficulty level and completion tracking.
 * Awards XP based on difficulty when completed.
 */
export interface Goal {
  id: string;                // Unique goal ID (UUID)
  text: string;              // Goal description
  difficulty: 'easy' | 'medium' | 'hard'; // Difficulty level
  createdAt: Timestamp;      // When goal was created
  completedAt?: Timestamp;   // When goal was completed (if completed)
  isCompleted: boolean;      // Completion status
  xpAwarded?: number;        // XP awarded upon completion
}

/**
 * Daily goal - tracks user's goals
 *
 * Container for a user's daily goals. Users can have multiple active
 * goals tracked at once with different difficulty levels.
 */
export interface DailyGoal {
  userId: string;           // Discord user ID
  username: string;         // Discord username
  goals: Goal[];            // Array of goals
  lastGoalSetAt?: Timestamp; // Most recent goal set timestamp
  goalsByDay?: {            // Map of date (YYYY-MM-DD) -> goal text (legacy)
    [date: string]: string;
  };
}

// ============================================================================
// EVENTS SYSTEM
// ============================================================================

/**
 * Study event - scheduled group study sessions
 *
 * Scheduled study event with RSVP tracking. Supports different study types
 * (silent, conversation, pomodoro, custom), location details, capacity limits,
 * and attendee management.
 */
export interface StudyEvent {
  eventId: string;          // Unique event ID (UUID)
  serverId: string;         // Discord server ID
  creatorId: string;        // User ID of event creator
  creatorUsername: string;  // Username of creator

  // Event details
  title: string;            // Event title/name
  description?: string;     // Optional description
  location: string;         // Exact location (e.g., "Library - 3rd floor, table near windows")

  // Scheduling
  startTime: Timestamp;     // When event starts
  duration?: number;        // Duration in minutes (optional, undefined = no limit)

  // Settings
  maxAttendees?: number;    // Maximum number of attendees (undefined = unlimited)
  studyType: 'silent' | 'conversation' | 'pomodoro' | 'custom'; // Type of study session
  customType?: string;      // Custom type description if studyType is 'custom'

  // RSVP tracking
  attendees: Array<{        // Users who have RSVP'd
    userId: string;
    username: string;
    joinedAt: Timestamp;
  }>;

  // Metadata
  createdAt: Timestamp;     // When event was created
  messageId?: string;       // Discord message ID if posted to feed
  channelId?: string;       // Discord channel ID where posted
  isCancelled?: boolean;    // Whether event has been cancelled
  cancelledAt?: Timestamp;  // When event was cancelled
}

// ============================================================================
// GROUPS SYSTEM
// ============================================================================

/**
 * Group - represents a study group with multiple members
 *
 * Study group with up to 5 members. Groups earn XP bonuses based on their
 * level (calculated from total member hours). Can be public or private.
 * Member information is stored separately in GroupMembership records.
 *
 * NOTE: This interface is re-exported from services/groups.ts where it is
 * actually implemented. Kept here for backward compatibility and centralized
 * type definitions.
 */
export interface Group {
  groupId: string;          // Unique group ID (e.g., 'GP-A1B2')
  name: string;             // Group name
  ownerId: string;          // Discord user ID of group owner
  ownerUsername: string;    // Discord username of owner
  serverId: string;         // Discord server ID
  isPublic: boolean;        // Whether group is publicly visible/joinable
  maxMembers: number;       // Maximum number of members (default: 5)
  memberCount: number;      // Current number of members
  totalHours: number;       // Total study hours across all members
  level: number;            // Group level (calculated from total hours)
  createdAt: Timestamp;     // When group was created
  updatedAt: Timestamp;     // Last stats update
}

/**
 * Group membership - one per user (for quick lookup)
 *
 * Denormalized record for fast user -> group lookups. Each user can only
 * be in one group at a time. Tracks ownership status and join date.
 *
 * NOTE: This interface is re-exported from services/groups.ts where it is
 * actually implemented. Kept here for backward compatibility and centralized
 * type definitions.
 */
export interface GroupMembership {
  userId: string;           // Discord user ID
  username: string;         // Discord username
  groupId: string;          // Group ID user belongs to
  joinedAt: Timestamp;      // When user joined the group
  isOwner: boolean;         // Whether user is the group owner
}
