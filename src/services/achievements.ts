import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ACHIEVEMENT_DEFINITIONS, getAchievement } from '../data/achievements';
import { UserStats, AchievementDefinition } from '../types';

/**
 * Achievement Service - Manages achievement unlocking and tracking
 *
 * This service handles:
 * - Checking if users meet achievement unlock conditions
 * - Awarding newly unlocked achievements to users
 * - Retrieving user's achievement collection
 */
export class AchievementService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Check if user should unlock any new achievements and award them
   *
   * This method:
   * 1. Fetches user stats from Firestore
   * 2. Checks all achievement definitions against user's stats
   * 3. Awards any newly unlocked achievements
   * 4. Returns list of newly unlocked achievement IDs
   *
   * @param userId - Discord user ID
   * @returns Array of newly unlocked achievement IDs
   *
   * @example
   * const newAchievements = await achievementService.checkAndAwardAchievements('123456');
   * // Returns: ['first_steps', 'hot_streak']
   */
  async checkAndAwardAchievements(userId: string): Promise<string[]> {
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
    const currentAchievements = stats.achievements || [];
    const newlyUnlocked: string[] = [];

    // Check each achievement definition
    for (const achievement of ACHIEVEMENT_DEFINITIONS) {
      // Skip if already unlocked
      if (currentAchievements.includes(achievement.id)) {
        continue;
      }

      // Check if conditions are met
      if (this.checkAchievementCondition(achievement, stats)) {
        newlyUnlocked.push(achievement.id);

        // Prepare update object
        const updateData: any = {
          achievements: FieldValue.arrayUnion(achievement.id),
          [`achievementsUnlockedAt.${achievement.id}`]: Timestamp.now(),
        };

        // Clear the newRecordUnlocked flag if this is the new_record achievement
        if (achievement.id === 'new_record') {
          updateData.newRecordUnlocked = false;
        }

        // Update Firestore with new achievement
        await statsRef.update(updateData);

        console.log(
          `[ACHIEVEMENT] User ${userId} unlocked "${achievement.name}" (${achievement.emoji})!`
        );
      }
    }

    return newlyUnlocked;
  }

  /**
   * Check if a specific achievement's conditions are met
   *
   * @param achievement - Achievement definition to check
   * @param stats - User's current statistics
   * @returns True if achievement should be unlocked
   */
  private checkAchievementCondition(achievement: AchievementDefinition, stats: UserStats): boolean {
    const { condition } = achievement;

    switch (condition.type) {
      case 'sessions':
        // Check total session count
        return (stats[condition.field as keyof UserStats] as number) >= condition.threshold;

      case 'hours':
        // Check total duration (in seconds)
        return (stats[condition.field as keyof UserStats] as number) >= condition.threshold;

      case 'streak':
        // Check current or longest streak
        return (stats[condition.field as keyof UserStats] as number) >= condition.threshold;

      case 'activities':
        // Check number of unique activity types
        const activityTypes = stats.activityTypes || [];
        return activityTypes.length >= condition.threshold;

      case 'custom':
        // Handle special achievement conditions
        return this.checkCustomCondition(achievement.id, stats, condition.threshold);

      default:
        return false;
    }
  }

  /**
   * Check custom achievement conditions that don't fit standard patterns
   *
   * @param achievementId - Achievement identifier
   * @param stats - User statistics
   * @param threshold - Threshold value for condition
   * @returns True if custom condition is met
   */
  private checkCustomCondition(
    achievementId: string,
    stats: UserStats,
    threshold: number
  ): boolean {
    switch (achievementId) {
      // ===== INTENSITY ACHIEVEMENTS =====
      case 'power_hour':
        // Single session over 2 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'marathon':
        // Single session over 4 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'deep_focus':
        // Single session over 6 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'ultra_marathon':
        // Single session over 8 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'iron_will':
        // Single session over 12 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'new_record':
        // Beat personal best - this is a one-time achievement triggered by the temporary flag
        // The flag is set in stats.ts when user beats their longestSessionDuration
        // and then cleared after the achievement is awarded
        return stats.newRecordUnlocked === true;

      // ===== SCHEDULE ACHIEVEMENTS =====
      case 'early_bird':
        // Complete a session before 7 AM (at least once)
        return (stats.sessionsBefore7AM || 0) >= threshold;

      case 'night_owl':
        // Complete a session after 11 PM (at least once)
        return (stats.sessionsAfter11PM || 0) >= threshold;

      case 'midnight_grinder':
        // Complete a session after midnight (12 AM - 6 AM)
        return (stats.sessionsAfterMidnight || 0) >= threshold;

      case 'weekend_warrior':
        // Study on both Saturday and Sunday (same weekend)
        // Requires at least one weekend where both days had sessions
        return (stats.weekendWarriorWeeks || 0) >= threshold;

      case 'weekend_streak':
        // Study on both Sat+Sun for 4 consecutive weekends
        return (stats.consecutiveWeekendStreak || 0) >= threshold;

      case 'full_week':
        // Study all 7 days in one week (at least once)
        return (stats.fullWeeksCompleted || 0) >= threshold;

      case 'month_master':
        // Study 20+ days in a single month
        // bestMonthDaysCount tracks the highest number of unique days studied in any month
        return (stats.bestMonthDaysCount || 0) >= threshold;

      case 'morning_starter':
        // Study for 1+ hour before 10 AM (1 time)
        return (stats.morningSessionsBefore10AM || 0) >= threshold;

      case 'morning_routine':
        // Study for 1+ hour before 10 AM (7 times)
        return (stats.morningSessionsBefore10AM || 0) >= threshold;

      case 'morning_champion':
        // Study for 1+ hour before 10 AM (14 times)
        return (stats.morningSessionsBefore10AM || 0) >= threshold;

      case 'morning_legend':
        // Study for 1+ hour before 10 AM (30 times)
        return (stats.morningSessionsBefore10AM || 0) >= threshold;

      // ===== LEVEL ACHIEVEMENTS =====
      case 'level_5':
      case 'level_10':
      case 'level_25':
      case 'level_35':
      case 'level_50':
      case 'level_100':
        // Check if user has reached the level
        const xp = stats.xp || 0;
        const currentLevel = this.calculateLevel(xp);
        return currentLevel >= threshold;

      // ===== META ACHIEVEMENTS =====
      case 'collector':
        // Unlock 10 achievements
        const achievementCount = (stats.achievements || []).length;
        return achievementCount >= threshold;

      default:
        return false;
    }
  }

  /**
   * Calculate user level from XP
   * Uses same formula as utils/xp.ts
   */
  private calculateLevel(xp: number): number {
    // Level 1 is the starting point (0 XP up to level 2 threshold)
    if (xp < 283) return 1;

    // Inverse of the XP formula: level = (XP / 100)^(2/3)
    // Use Math.round to handle floating point precision issues
    const level = Math.round(Math.pow(xp / 100, 2 / 3));

    // Cap at level 100 (max level)
    return Math.max(1, Math.min(100, level));
  }

  /**
   * Get all achievements a user has unlocked with full achievement details
   *
   * @param userId - Discord user ID
   * @returns Array of unlocked achievement definitions
   *
   * @example
   * const achievements = await achievementService.getUserAchievements('123456');
   * console.log(achievements.map(a => a.emoji).join(' ')); // '🎯 🔥 💯'
   */
  async getUserAchievements(userId: string): Promise<AchievementDefinition[]> {
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
    const achievementIds = stats.achievements || [];

    // Map achievement IDs to full achievement definitions
    return achievementIds
      .map((id) => getAchievement(id))
      .filter((achievement) => achievement !== undefined) as AchievementDefinition[];
  }
}
