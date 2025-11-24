/**
 * Leveled Achievement Service - Manages Duolingo-style achievement progression
 *
 * This service handles:
 * - Checking and updating achievement levels based on user stats
 * - Calculating total XP boost from all achievement levels
 * - Detecting level-ups and returning newly achieved levels
 * - Converting stat values to achievement levels
 */

import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { UserStats, LeveledAchievementProgress } from '../types';
import { LEVELED_ACHIEVEMENTS, getLeveledAchievement } from '../data/leveledAchievements';
import { calculateLevel } from '../utils/xp';

export class LeveledAchievementService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Check and update all achievement levels for a user
   * Returns array of level-ups that occurred (for notifications)
   *
   * @param userId - Discord user ID
   * @returns Array of level-up objects: { achievementId, newLevel, achievementName }
   */
  async checkAndUpdateAchievements(userId: string): Promise<Array<{
    achievementId: string;
    newLevel: number;
    achievementName: string;
    emoji: string;
  }>> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    if (!doc.exists) {
      return [];
    }

    const stats = doc.data() as UserStats;
    const currentAchievements = stats.leveledAchievements || {};
    const levelUps: Array<{
      achievementId: string;
      newLevel: number;
      achievementName: string;
      emoji: string;
    }> = [];

    // Track updates to apply
    const updates: any = {};

    // Check each achievement
    for (const achievement of LEVELED_ACHIEVEMENTS) {
      const currentProgress = currentAchievements[achievement.id];
      const currentLevel = currentProgress?.currentLevel || 0;

      // Get the stat value for this achievement
      const statValue = this.getStatValue(stats, achievement.statField, achievement.unit);

      // Calculate what level the user should be at
      const newLevel = this.calculateAchievementLevel(statValue, achievement.levels);

      // Check if user leveled up
      if (newLevel > currentLevel) {
        // Record all level-ups (could be multiple if they jumped levels)
        for (let level = currentLevel + 1; level <= newLevel; level++) {
          levelUps.push({
            achievementId: achievement.id,
            newLevel: level,
            achievementName: achievement.name,
            emoji: achievement.emoji,
          });
        }

        // Prepare update for this achievement
        const progressUpdate: LeveledAchievementProgress = {
          achievementId: achievement.id,
          currentLevel: newLevel,
          currentProgress: statValue,
          unlockedAt: currentProgress?.unlockedAt || Timestamp.now(),
          lastLevelUpAt: Timestamp.now(),
        };

        updates[`leveledAchievements.${achievement.id}`] = progressUpdate;

        console.log(
          `[LEVELED_ACHIEVEMENT] User ${userId} leveled up "${achievement.name}" to level ${newLevel}!`
        );
      } else if (statValue !== currentProgress?.currentProgress) {
        // Update progress even if no level up
        updates[`leveledAchievements.${achievement.id}.currentProgress`] = statValue;
      }
    }

    // Calculate total achievement boost
    const totalBoost = this.calculateTotalBoost(stats.leveledAchievements || {}, updates);
    updates.totalAchievementBoost = totalBoost;

    // Apply all updates
    if (Object.keys(updates).length > 0) {
      await statsRef.update(updates);
    }

    return levelUps;
  }

  /**
   * Get the stat value for a specific achievement
   */
  private getStatValue(stats: UserStats, statField: string, unit: string): number {
    if (statField === 'xp') {
      // Special case: convert XP to level
      const xp = stats.xp || 0;
      return calculateLevel(xp);
    }

    const value = (stats[statField as keyof UserStats] as number) || 0;

    // Convert seconds to hours for duration-based achievements
    if (unit === 'hours') {
      return Math.floor(value / 3600); // Convert seconds to hours
    }

    return value;
  }

  /**
   * Calculate achievement level based on stat value and level thresholds
   * Returns 0-10 (0 = not started, 10 = max level)
   */
  private calculateAchievementLevel(statValue: number, levels: number[]): number {
    for (let i = levels.length - 1; i >= 0; i--) {
      if (statValue >= levels[i]) {
        return i + 1; // Levels are 1-indexed
      }
    }
    return 0; // Not reached level 1 yet
  }

  /**
   * Calculate total XP boost percentage from all achievement levels
   * Each level = +0.1% boost
   *
   * @param currentAchievements - Current achievement progress
   * @param pendingUpdates - Updates about to be applied (for optimistic calculation)
   * @returns Total boost percentage (e.g., 2.5 = +2.5%)
   */
  private calculateTotalBoost(
    currentAchievements: { [key: string]: LeveledAchievementProgress },
    pendingUpdates: any = {}
  ): number {
    let totalLevels = 0;

    for (const achievement of LEVELED_ACHIEVEMENTS) {
      // Check if there's a pending update for this achievement
      const pendingKey = `leveledAchievements.${achievement.id}`;
      if (pendingUpdates[pendingKey]) {
        totalLevels += pendingUpdates[pendingKey].currentLevel;
      } else {
        const progress = currentAchievements[achievement.id];
        totalLevels += progress?.currentLevel || 0;
      }
    }

    // Each level = 0.1% boost
    return totalLevels * 0.1;
  }

  /**
   * Get achievement progress for a specific user
   * Returns current level and progress for each achievement
   */
  async getUserAchievementProgress(userId: string): Promise<{
    achievements: Array<{
      id: string;
      name: string;
      emoji: string;
      description: string;
      color: number;
      currentLevel: number;
      maxLevel: number;
      currentProgress: number;
      nextThreshold: number | null;
      unit: string;
    }>;
    totalBoost: number;
  }> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    if (!doc.exists) {
      return {
        achievements: LEVELED_ACHIEVEMENTS.map((a) => ({
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          description: a.description,
          color: a.color,
          currentLevel: 0,
          maxLevel: 10,
          currentProgress: 0,
          nextThreshold: a.levels[0],
          unit: a.unit,
        })),
        totalBoost: 0,
      };
    }

    const stats = doc.data() as UserStats;
    const leveledAchievements = stats.leveledAchievements || {};

    const achievements = LEVELED_ACHIEVEMENTS.map((achievement) => {
      const currentProgress = this.getStatValue(stats, achievement.statField, achievement.unit);

      // Calculate what level they SHOULD be at based on current progress
      const actualLevel = this.calculateAchievementLevel(currentProgress, achievement.levels);

      // Determine next threshold
      let nextThreshold: number | null = null;
      if (actualLevel < 10) {
        nextThreshold = achievement.levels[actualLevel]; // actualLevel is 0-indexed for array access
      }

      return {
        id: achievement.id,
        name: achievement.name,
        emoji: achievement.emoji,
        description: achievement.description,
        color: achievement.color,
        currentLevel: actualLevel,
        maxLevel: 10,
        currentProgress,
        nextThreshold,
        unit: achievement.unit,
      };
    });

    // Calculate total boost from actual levels (not stored value, in case of desync)
    const totalLevels = achievements.reduce((sum, a) => sum + a.currentLevel, 0);
    const totalBoost = totalLevels * 0.1;

    return {
      achievements,
      totalBoost,
    };
  }

  /**
   * Initialize achievement progress for a new user
   */
  async initializeAchievements(userId: string): Promise<void> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const initialAchievements: { [key: string]: LeveledAchievementProgress } = {};

    for (const achievement of LEVELED_ACHIEVEMENTS) {
      initialAchievements[achievement.id] = {
        achievementId: achievement.id,
        currentLevel: 0,
        currentProgress: 0,
      };
    }

    await statsRef.update({
      leveledAchievements: initialAchievements,
      totalAchievementBoost: 0,
    });
  }
}
