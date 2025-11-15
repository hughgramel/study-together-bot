import { BadgeDefinition } from '../types';

/**
 * Badge Definitions - All achievement badges available in the system
 *
 * This file defines all 20 starter badges organized by category.
 * Badges automatically unlock when users meet the specified conditions.
 *
 * Categories:
 * - milestone: Session count achievements
 * - time: Total hours studied achievements
 * - streak: Consecutive day achievements
 * - diversity: Activity variety achievements
 * - intensity: Long session and multi-session achievements
 */

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ===== MILESTONE BADGES (Session Count) =====
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
  {
    id: 'dedicated',
    name: 'Dedicated',
    emoji: '⭐',
    description: 'Complete 10 sessions',
    category: 'milestone',
    xpReward: 100,
    condition: {
      type: 'sessions',
      threshold: 10,
      field: 'totalSessions',
    },
    rarity: 'common',
    order: 2,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    emoji: '🌟',
    description: 'Complete 50 sessions',
    category: 'milestone',
    xpReward: 200,
    condition: {
      type: 'sessions',
      threshold: 50,
      field: 'totalSessions',
    },
    rarity: 'rare',
    order: 3,
  },
  {
    id: 'master',
    name: 'Master',
    emoji: '💎',
    description: 'Complete 100 sessions',
    category: 'milestone',
    xpReward: 500,
    condition: {
      type: 'sessions',
      threshold: 100,
      field: 'totalSessions',
    },
    rarity: 'epic',
    order: 4,
  },

  // ===== TIME BADGES (Total Hours) =====
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
    id: 'committed',
    name: 'Committed',
    emoji: '🕐',
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
    order: 13,
  },

  // ===== STREAK BADGES (Consecutive Days) =====
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
    xpReward: 150,
    condition: {
      type: 'streak',
      threshold: 7,
      field: 'currentStreak',
    },
    rarity: 'rare',
    order: 21,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    emoji: '🌟',
    description: 'Maintain a 30-day streak',
    category: 'streak',
    xpReward: 500,
    condition: {
      type: 'streak',
      threshold: 30,
      field: 'currentStreak',
    },
    rarity: 'epic',
    order: 22,
  },
  {
    id: 'immortal',
    name: 'Immortal',
    emoji: '⚡',
    description: 'Maintain a 100-day streak',
    category: 'streak',
    xpReward: 1500,
    condition: {
      type: 'streak',
      threshold: 100,
      field: 'currentStreak',
    },
    rarity: 'legendary',
    order: 23,
  },

  // ===== DIVERSITY BADGES (Activity Variety) =====
  {
    id: 'explorer',
    name: 'Explorer',
    emoji: '🎨',
    description: 'Try 3 different activity types',
    category: 'diversity',
    xpReward: 50,
    condition: {
      type: 'activities',
      threshold: 3,
      field: 'activityTypes',
    },
    rarity: 'common',
    order: 30,
  },
  {
    id: 'versatile',
    name: 'Versatile',
    emoji: '🌈',
    description: 'Try 7 different activity types',
    category: 'diversity',
    xpReward: 100,
    condition: {
      type: 'activities',
      threshold: 7,
      field: 'activityTypes',
    },
    rarity: 'rare',
    order: 31,
  },
  {
    id: 'renaissance',
    name: 'Renaissance',
    emoji: '🎭',
    description: 'Try 15 different activity types',
    category: 'diversity',
    xpReward: 250,
    condition: {
      type: 'activities',
      threshold: 15,
      field: 'activityTypes',
    },
    rarity: 'epic',
    order: 32,
  },

  // ===== INTENSITY BADGES (Long Sessions & Multi-Session Days) =====
  {
    id: 'marathon',
    name: 'Marathon',
    emoji: '💪',
    description: 'Complete a session over 4 hours',
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
    id: 'ultra_marathon',
    name: 'Ultra Marathon',
    emoji: '🏃',
    description: 'Complete a session over 8 hours',
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
    id: 'speed_demon',
    name: 'Speed Demon',
    emoji: '⚡',
    description: 'Complete 5 sessions in one day',
    category: 'intensity',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 5,
    },
    rarity: 'rare',
    order: 42,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    emoji: '🐦',
    description: 'Start 5 sessions before 7 AM',
    category: 'intensity',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 5,
    },
    rarity: 'rare',
    order: 50,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    emoji: '🦉',
    description: 'Start 5 sessions after 11 PM',
    category: 'intensity',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 5,
    },
    rarity: 'rare',
    order: 51,
  },
];

/**
 * Get a badge by its ID
 *
 * @param id - Badge identifier
 * @returns Badge definition or undefined if not found
 *
 * @example
 * const badge = getBadge('first_steps');
 * console.log(badge.name); // 'First Steps'
 */
export function getBadge(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === id);
}

/**
 * Get all badges in a specific category
 *
 * @param category - Badge category
 * @returns Array of badge definitions in that category
 *
 * @example
 * const streakBadges = getBadgesByCategory('streak');
 * console.log(streakBadges.length); // 4
 */
export function getBadgesByCategory(
  category: string
): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}

/**
 * Get all badge definitions
 *
 * @returns Complete array of all badges
 */
export function getAllBadges(): BadgeDefinition[] {
  return BADGE_DEFINITIONS;
}
