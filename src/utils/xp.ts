/**
 * XP & Leveling System Utilities
 *
 * This module provides utility functions for calculating levels, XP requirements,
 * and progress tracking for the gamification system.
 *
 * XP Curve Formula:
 * - XP required for level N: 100 * (N^1.5)
 * - Level from XP: (XP / 100)^(2/3)
 *
 * Example progression:
 * - Level 1:  0 XP
 * - Level 2:  283 XP
 * - Level 5:  1,118 XP
 * - Level 10: 3,162 XP
 * - Level 20: 8,944 XP
 * - Level 50: 35,355 XP
 * - Level 100: 100,000 XP (max level)
 */

/**
 * Calculate the current level from total XP earned
 * Uses an exponential curve to make early levels faster and later levels harder
 *
 * @param xp - Total XP earned
 * @returns Current level (1-100)
 *
 * @example
 * calculateLevel(0)    // Returns 1
 * calculateLevel(283)  // Returns 2
 * calculateLevel(3162) // Returns 10
 */
export function calculateLevel(xp: number): number {
  // Level 1 is the starting point (0 XP up to level 2 threshold)
  if (xp < 283) return 1;

  // Inverse of the XP formula: level = (XP / 100)^(2/3)
  // Use Math.round to handle floating point precision issues
  const level = Math.round(Math.pow(xp / 100, 2 / 3));

  // Cap at level 100 (max level)
  return Math.max(1, Math.min(100, level));
}

/**
 * Calculate the total XP required to reach a specific level
 *
 * @param level - Target level (1-100)
 * @returns Total XP needed to reach that level
 *
 * @example
 * xpForLevel(1)  // Returns 0
 * xpForLevel(2)  // Returns 283
 * xpForLevel(10) // Returns 3,162
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;

  // Formula: XP = 100 * (level^1.5)
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calculate how much XP is needed to reach the next level
 *
 * @param currentXp - Current total XP
 * @returns XP needed to level up
 *
 * @example
 * xpToNextLevel(0)   // Returns 100 (need 100 XP to reach level 2)
 * xpToNextLevel(150) // Returns XP needed to reach level 3
 */
export function xpToNextLevel(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  const nextLevelXp = xpForLevel(currentLevel + 1);

  return nextLevelXp - currentXp;
}

/**
 * Calculate progress percentage toward the next level
 *
 * @param currentXp - Current total XP
 * @returns Progress percentage (0-100)
 *
 * @example
 * levelProgress(0)   // Returns 0 (0% progress to level 2)
 * levelProgress(50)  // Returns 50 (50% progress to level 2)
 * levelProgress(100) // Returns 0 (just reached level 2, 0% to level 3)
 */
export function levelProgress(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);

  // Calculate progress as percentage
  const progress = ((currentXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  // Clamp between 0 and 100
  return Math.min(100, Math.max(0, progress));
}

/**
 * Award XP to a user and calculate level-up information
 * This is a pure function - it doesn't modify any data, just calculates the result
 *
 * @param currentXp - Current total XP
 * @param xpToAdd - Amount of XP to award
 * @returns Object containing new XP, new level, and level-up information
 *
 * @example
 * awardXP(0, 50)
 * // Returns: { newXp: 50, newLevel: 1, leveledUp: false, levelsGained: 0, oldLevel: 1 }
 *
 * awardXP(80, 50)
 * // Returns: { newXp: 130, newLevel: 2, leveledUp: true, levelsGained: 1, oldLevel: 1 }
 *
 * awardXP(0, 1000)
 * // Returns: { newXp: 1000, newLevel: 10, leveledUp: true, levelsGained: 9, oldLevel: 1 }
 */
export function awardXP(
  currentXp: number,
  xpToAdd: number
): {
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  levelsGained: number;
  oldLevel: number;
} {
  const oldLevel = calculateLevel(currentXp);
  const newXp = currentXp + xpToAdd;
  const newLevel = calculateLevel(newXp);

  const leveledUp = newLevel > oldLevel;
  const levelsGained = newLevel - oldLevel;

  return {
    newXp,
    newLevel,
    leveledUp,
    levelsGained,
    oldLevel,
  };
}
