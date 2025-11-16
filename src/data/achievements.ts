import { AchievementDefinition } from '../types';

/**
 * Achievement Definitions - All unlockable achievements available in the system
 *
 * Focus areas: Hours, Streaks, Levels, Study Habits (early morning, weekends, long sessions)
 *
 * Categories:
 * - milestone: First session achievement
 * - time: Total hours studied achievements
 * - streak: Consecutive day achievements
 * - intensity: Long session achievements
 * - schedule: Time-based and weekend achievements
 * - level: XP level milestones
 */

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ===== MILESTONE (First Session Only) =====
  {
    id: 'first_steps',
    name: 'First Steps',
    emoji: '🎯',
    description: 'Complete your first session',
    category: 'milestone',
    xpReward: 50,
    condition: {
      type: 'sessions',
      threshold: 1,
      field: 'totalSessions',
    },
    rarity: 'common',
    order: 1,
  },

  // ===== TIME ACHIEVEMENTS (Total Hours) =====
  {
    id: 'getting_started',
    name: 'Getting Started',
    emoji: '⏱️',
    description: 'Study for 10 hours total',
    category: 'time',
    xpReward: 50,
    condition: {
      type: 'hours',
      threshold: 36000, // 10 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'common',
    order: 10,
  },
  {
    id: 'academic',
    name: 'Academic',
    emoji: '🎓',
    description: 'Study for 25 hours total',
    category: 'time',
    xpReward: 75,
    condition: {
      type: 'hours',
      threshold: 90000, // 25 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'common',
    order: 10.5,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    emoji: '⭐',
    description: 'Study for 50 hours total',
    category: 'time',
    xpReward: 100,
    condition: {
      type: 'hours',
      threshold: 180000, // 50 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'common',
    order: 11,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    emoji: '💯',
    description: 'Study for 100 hours total',
    category: 'time',
    xpReward: 200,
    condition: {
      type: 'hours',
      threshold: 360000, // 100 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'rare',
    order: 12,
  },
  {
    id: 'committed',
    name: 'Committed',
    emoji: '🕐',
    description: 'Study for 250 hours total',
    category: 'time',
    xpReward: 300,
    condition: {
      type: 'hours',
      threshold: 900000, // 250 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'rare',
    order: 13,
  },
  {
    id: 'scholar',
    name: 'Scholar',
    emoji: '📚',
    description: 'Study for 500 hours total',
    category: 'time',
    xpReward: 500,
    condition: {
      type: 'hours',
      threshold: 1800000, // 500 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'epic',
    order: 14,
  },
  {
    id: 'master',
    name: 'Master',
    emoji: '🧙',
    description: 'Study for 1,000 hours total',
    category: 'time',
    xpReward: 1000,
    condition: {
      type: 'hours',
      threshold: 3600000, // 1000 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'epic',
    order: 15,
  },
  {
    id: 'grandmaster',
    name: 'Grandmaster',
    emoji: '👑',
    description: 'Study for 2,500 hours total',
    category: 'time',
    xpReward: 2500,
    condition: {
      type: 'hours',
      threshold: 9000000, // 2500 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'legendary',
    order: 16,
  },
  {
    id: 'legend',
    name: 'Legend',
    emoji: '🏆',
    description: 'Study for 5,000 hours total',
    category: 'time',
    xpReward: 5000,
    condition: {
      type: 'hours',
      threshold: 18000000, // 5000 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'legendary',
    order: 17,
  },

  // ===== STREAK ACHIEVEMENTS (Consecutive Days) =====
  {
    id: 'hot_streak',
    name: 'Hot Streak',
    emoji: '🔥',
    description: 'Maintain a 3-day streak',
    category: 'streak',
    xpReward: 50,
    condition: {
      type: 'streak',
      threshold: 3,
      field: 'currentStreak',
    },
    rarity: 'common',
    order: 20,
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    emoji: '🔥',
    description: 'Maintain a 7-day streak',
    category: 'streak',
    xpReward: 100,
    condition: {
      type: 'streak',
      threshold: 7,
      field: 'currentStreak',
    },
    rarity: 'common',
    order: 21,
  },
  {
    id: 'blazing',
    name: 'Blazing',
    emoji: '🔥',
    description: 'Maintain a 14-day streak',
    category: 'streak',
    xpReward: 200,
    condition: {
      type: 'streak',
      threshold: 14,
      field: 'currentStreak',
    },
    rarity: 'rare',
    order: 22,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    emoji: '💫',
    description: 'Maintain a 30-day streak',
    category: 'streak',
    xpReward: 300,
    condition: {
      type: 'streak',
      threshold: 30,
      field: 'currentStreak',
    },
    rarity: 'rare',
    order: 23,
  },
  {
    id: 'relentless',
    name: 'Relentless',
    emoji: '⭐',
    description: 'Maintain a 60-day streak',
    category: 'streak',
    xpReward: 500,
    condition: {
      type: 'streak',
      threshold: 60,
      field: 'currentStreak',
    },
    rarity: 'epic',
    order: 24,
  },
  {
    id: 'phenomenal',
    name: 'Phenomenal',
    emoji: '🌟',
    description: 'Maintain a 90-day streak',
    category: 'streak',
    xpReward: 750,
    condition: {
      type: 'streak',
      threshold: 90,
      field: 'currentStreak',
    },
    rarity: 'epic',
    order: 25,
  },
  {
    id: 'immortal',
    name: 'Immortal',
    emoji: '💎',
    description: 'Maintain a 180-day streak',
    category: 'streak',
    xpReward: 1500,
    condition: {
      type: 'streak',
      threshold: 180,
      field: 'currentStreak',
    },
    rarity: 'legendary',
    order: 26,
  },
  {
    id: 'eternal',
    name: 'Eternal',
    emoji: '♾️',
    description: 'Maintain a 365-day streak',
    category: 'streak',
    xpReward: 3650,
    condition: {
      type: 'streak',
      threshold: 365,
      field: 'currentStreak',
    },
    rarity: 'legendary',
    order: 27,
  },

  // ===== INTENSITY ACHIEVEMENTS (Long Sessions) =====
  {
    id: 'power_hour',
    name: 'Power Hour',
    emoji: '⚡',
    description: 'Complete a 2-hour session',
    category: 'intensity',
    xpReward: 75,
    condition: {
      type: 'custom',
      threshold: 7200, // 2 hours in seconds
    },
    rarity: 'common',
    order: 39,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    emoji: '💪',
    description: 'Complete a 4-hour session',
    category: 'intensity',
    xpReward: 150,
    condition: {
      type: 'custom',
      threshold: 14400, // 4 hours in seconds
    },
    rarity: 'rare',
    order: 40,
  },
  {
    id: 'deep_focus',
    name: 'Deep Focus',
    emoji: '🎯',
    description: 'Complete a 6-hour session',
    category: 'intensity',
    xpReward: 225,
    condition: {
      type: 'custom',
      threshold: 21600, // 6 hours in seconds
    },
    rarity: 'rare',
    order: 40.5,
  },
  {
    id: 'ultra_marathon',
    name: 'Ultra Marathon',
    emoji: '🏃',
    description: 'Complete an 8-hour session',
    category: 'intensity',
    xpReward: 300,
    condition: {
      type: 'custom',
      threshold: 28800, // 8 hours in seconds
    },
    rarity: 'epic',
    order: 41,
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    emoji: '🦾',
    description: 'Complete a 12-hour session',
    category: 'intensity',
    xpReward: 500,
    condition: {
      type: 'custom',
      threshold: 43200, // 12 hours in seconds
    },
    rarity: 'legendary',
    order: 42,
  },
  {
    id: 'new_record',
    name: 'New Record',
    emoji: '🎊',
    description: 'Beat your personal best session duration',
    category: 'intensity',
    xpReward: 200,
    condition: {
      type: 'custom',
      threshold: 1, // Requires custom logic to detect when longestSessionDuration increases
    },
    rarity: 'rare',
    order: 43,
  },

  // ===== SCHEDULE ACHIEVEMENTS (Time-based & Weekends) =====
  {
    id: 'early_bird',
    name: 'Early Bird',
    emoji: '🐦',
    description: 'Complete a session before 7 AM',
    category: 'schedule',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 1,
    },
    rarity: 'rare',
    order: 50,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    emoji: '🦉',
    description: 'Complete a session after 11 PM',
    category: 'schedule',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 1,
    },
    rarity: 'rare',
    order: 51,
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    emoji: '⚔️',
    description: 'Study on both Saturday and Sunday',
    category: 'schedule',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 1,
    },
    rarity: 'rare',
    order: 52,
  },
  {
    id: 'morning_starter',
    name: 'Morning Starter',
    emoji: '🌅',
    description: 'Study for 1 hour before 10 AM',
    category: 'schedule',
    xpReward: 75,
    condition: {
      type: 'custom',
      threshold: 1,
    },
    rarity: 'common',
    order: 53,
  },
  {
    id: 'morning_routine',
    name: 'Morning Routine',
    emoji: '☀️',
    description: 'Study for 1 hour before 10 AM (7 times)',
    category: 'schedule',
    xpReward: 150,
    condition: {
      type: 'custom',
      threshold: 7,
    },
    rarity: 'rare',
    order: 54,
  },
  {
    id: 'morning_champion',
    name: 'Morning Champion',
    emoji: '🌄',
    description: 'Study for 1 hour before 10 AM (14 times)',
    category: 'schedule',
    xpReward: 300,
    condition: {
      type: 'custom',
      threshold: 14,
    },
    rarity: 'epic',
    order: 55,
  },
  {
    id: 'morning_legend',
    name: 'Morning Legend',
    emoji: '🌞',
    description: 'Study for 1 hour before 10 AM (30 times)',
    category: 'schedule',
    xpReward: 500,
    condition: {
      type: 'custom',
      threshold: 30,
    },
    rarity: 'epic',
    order: 56,
  },
  {
    id: 'midnight_grinder',
    name: 'Midnight Grinder',
    emoji: '🌙',
    description: 'Complete a session after midnight',
    category: 'schedule',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 1,
    },
    rarity: 'rare',
    order: 57,
  },
  {
    id: 'weekend_streak',
    name: 'Weekend Streak',
    emoji: '🗓️',
    description: 'Study on both Saturday and Sunday for 4 consecutive weekends',
    category: 'schedule',
    xpReward: 300,
    condition: {
      type: 'custom',
      threshold: 4, // Requires tracking weekend consistency
    },
    rarity: 'epic',
    order: 58,
  },
  {
    id: 'full_week',
    name: 'Full Week',
    emoji: '📅',
    description: 'Study at least once every day for 7 consecutive days',
    category: 'schedule',
    xpReward: 250,
    condition: {
      type: 'custom',
      threshold: 1, // Requires checking if all 7 days in a week have sessions
    },
    rarity: 'epic',
    order: 59,
  },
  {
    id: 'month_master',
    name: 'Month Master',
    emoji: '🗓️',
    description: 'Study for at least 20 days in a single month',
    category: 'schedule',
    xpReward: 400,
    condition: {
      type: 'custom',
      threshold: 20, // Requires counting unique study days in a month
    },
    rarity: 'epic',
    order: 60,
  },

  // ===== LEVEL ACHIEVEMENTS (XP Milestones) =====
  {
    id: 'level_5',
    name: 'Rising Star',
    emoji: '🌠',
    description: 'Reach Level 5',
    category: 'level',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 5,
    },
    rarity: 'common',
    order: 60,
  },
  {
    id: 'level_10',
    name: 'Achiever',
    emoji: '🎖️',
    description: 'Reach Level 10',
    category: 'level',
    xpReward: 200,
    condition: {
      type: 'custom',
      threshold: 10,
    },
    rarity: 'common',
    order: 61,
  },
  {
    id: 'level_25',
    name: 'Elite',
    emoji: '💎',
    description: 'Reach Level 25',
    category: 'level',
    xpReward: 500,
    condition: {
      type: 'custom',
      threshold: 25,
    },
    rarity: 'rare',
    order: 62,
  },
  {
    id: 'level_35',
    name: 'Pro',
    emoji: '🚀',
    description: 'Reach Level 35',
    category: 'level',
    xpReward: 750,
    condition: {
      type: 'custom',
      threshold: 35,
    },
    rarity: 'rare',
    order: 62.5,
  },
  {
    id: 'level_50',
    name: 'Champion',
    emoji: '🏅',
    description: 'Reach Level 50',
    category: 'level',
    xpReward: 1000,
    condition: {
      type: 'custom',
      threshold: 50,
    },
    rarity: 'epic',
    order: 63,
  },
  {
    id: 'level_100',
    name: 'Transcendent',
    emoji: '✨',
    description: 'Reach Level 100',
    category: 'level',
    xpReward: 2500,
    condition: {
      type: 'custom',
      threshold: 100,
    },
    rarity: 'legendary',
    order: 64,
  },

  // ===== META ACHIEVEMENTS (Achievement Hunting) =====
  {
    id: 'collector',
    name: 'Collector',
    emoji: '🏆',
    description: 'Unlock 10 achievements',
    category: 'meta',
    xpReward: 250,
    condition: {
      type: 'custom',
      threshold: 10, // Check achievements.length
    },
    rarity: 'rare',
    order: 70,
  },

];

/**
 * Get an achievement by its ID
 *
 * @param id - Achievement identifier
 * @returns Achievement definition or undefined if not found
 *
 * @example
 * const achievement = getAchievement('first_steps');
 * console.log(achievement.name); // 'First Steps'
 */
export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
}

/**
 * Get all achievements in a specific category
 *
 * @param category - Achievement category
 * @returns Array of achievement definitions in that category
 *
 * @example
 * const streakAchievements = getAchievementsByCategory('streak');
 * console.log(streakAchievements.length); // 8
 */
export function getAchievementsByCategory(
  category: string
): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter((a) => a.category === category);
}

/**
 * Get all achievement definitions
 *
 * @returns Complete array of all achievements
 */
export function getAllAchievements(): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS;
}
