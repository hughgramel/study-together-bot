/**
 * Leveled Achievement Definitions - Duolingo-style progression system
 *
 * Defines the 4 core achievements that users progress through by leveling up.
 * Each achievement has 10 levels, and each level grants +0.1% permanent XP boost.
 *
 * Total max boost: 4.0% (4 achievements × 10 levels × 0.1%)
 */

import { LeveledAchievementDefinition } from '../types';

/**
 * Scholar - Total hours studied
 * Tracks cumulative study time across all sessions
 */
export const SCHOLAR: LeveledAchievementDefinition = {
  id: 'scholar',
  name: 'Scholar',
  emoji: '📚',
  description: 'Total hours studied',
  color: 0x4A90E2, // Blue
  levels: [
    10,    // Level 1: 10 hours
    25,    // Level 2: 25 hours
    50,    // Level 3: 50 hours
    100,   // Level 4: 100 hours
    250,   // Level 5: 250 hours
    500,   // Level 6: 500 hours
    1000,  // Level 7: 1,000 hours
    2500,  // Level 8: 2,500 hours
    5000,  // Level 9: 5,000 hours
    10000, // Level 10: 10,000 hours
  ],
  statField: 'totalDuration', // seconds
  unit: 'hours',
  order: 1,
};

/**
 * Marathon Runner - Longest single session
 * Tracks the user's longest continuous study session
 */
export const MARATHON_RUNNER: LeveledAchievementDefinition = {
  id: 'marathon_runner',
  name: 'Marathon Runner',
  emoji: '⚡',
  description: 'Longest session',
  color: 0xF5A623, // Orange
  levels: [
    1,  // Level 1: 1 hour
    2,  // Level 2: 2 hours
    4,  // Level 3: 4 hours
    6,  // Level 4: 6 hours
    8,  // Level 5: 8 hours
    10, // Level 6: 10 hours
    12, // Level 7: 12 hours
    15, // Level 8: 15 hours
    18, // Level 9: 18 hours
    24, // Level 10: 24 hours
  ],
  statField: 'longestSessionDuration', // seconds
  unit: 'hours',
  order: 2,
};

/**
 * Wildfire - Longest streak
 * Tracks the user's longest consecutive day streak
 */
export const WILDFIRE: LeveledAchievementDefinition = {
  id: 'wildfire',
  name: 'Wildfire',
  emoji: '🔥',
  description: 'Longest streak',
  color: 0xE74C3C, // Red
  levels: [
    1,   // Level 1: 1 day
    7,   // Level 2: 7 days (1 week)
    14,  // Level 3: 14 days (2 weeks)
    30,  // Level 4: 30 days (1 month)
    60,  // Level 5: 60 days (2 months)
    90,  // Level 6: 90 days (3 months)
    180, // Level 7: 180 days (6 months)
    365, // Level 8: 365 days (1 year)
    500, // Level 9: 500 days
    1000,// Level 10: 1000 days
  ],
  statField: 'longestStreak', // days
  unit: 'days',
  order: 3,
};

/**
 * Champion - User level progression
 * Tracks the user's XP-based level
 */
export const CHAMPION: LeveledAchievementDefinition = {
  id: 'champion',
  name: 'Champion',
  emoji: '🏆',
  description: 'User level',
  color: 0xFFD700, // Gold
  levels: [
    1,   // Level 1: Reach user level 1
    5,   // Level 2: Reach user level 5
    10,  // Level 3: Reach user level 10
    25,  // Level 4: Reach user level 25
    35,  // Level 5: Reach user level 35
    50,  // Level 6: Reach user level 50
    75,  // Level 7: Reach user level 75
    90,  // Level 8: Reach user level 90
    100, // Level 9: Reach user level 100
    125, // Level 10: Reach user level 125
  ],
  statField: 'xp', // Will calculate level from XP
  unit: 'level',
  order: 4,
};

/**
 * All leveled achievements in display order
 */
export const LEVELED_ACHIEVEMENTS: LeveledAchievementDefinition[] = [
  SCHOLAR,
  MARATHON_RUNNER,
  WILDFIRE,
  CHAMPION,
];

/**
 * Get a leveled achievement by ID
 */
export function getLeveledAchievement(id: string): LeveledAchievementDefinition | undefined {
  return LEVELED_ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get all leveled achievement definitions
 */
export function getAllLeveledAchievements(): LeveledAchievementDefinition[] {
  return LEVELED_ACHIEVEMENTS;
}
