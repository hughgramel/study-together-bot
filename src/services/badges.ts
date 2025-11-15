import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { BADGE_DEFINITIONS, getBadge } from '../data/badges';
import { UserStats, BadgeDefinition } from '../types';

/**
 * Badge Service - Manages badge unlocking and tracking
 *
 * This service handles:
 * - Checking if users meet badge unlock conditions
 * - Awarding newly unlocked badges to users
 * - Retrieving user's badge collection
 */
export class BadgeService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Check if user should unlock any new badges and award them
   *
   * This method:
   * 1. Fetches user stats from Firestore
   * 2. Checks all badge definitions against user's stats
   * 3. Awards any newly unlocked badges
   * 4. Returns list of newly unlocked badge IDs
   *
   * @param userId - Discord user ID
   * @returns Array of newly unlocked badge IDs
   *
   * @example
   * const newBadges = await badgeService.checkAndAwardBadges('123456');
   * // Returns: ['first_steps', 'hot_streak']
   */
  async checkAndAwardBadges(userId: string): Promise<string[]> {
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
    const currentBadges = stats.badges || [];
    const newlyUnlocked: string[] = [];

    // Check each badge definition
    for (const badge of BADGE_DEFINITIONS) {
      // Skip if already unlocked
      if (currentBadges.includes(badge.id)) {
        continue;
      }

      // Check if conditions are met
      if (this.checkBadgeCondition(badge, stats)) {
        newlyUnlocked.push(badge.id);

        // Update Firestore with new badge
        await statsRef.update({
          badges: FieldValue.arrayUnion(badge.id),
          [`badgesUnlockedAt.${badge.id}`]: Timestamp.now(),
        });

        console.log(
          `[BADGE] User ${userId} unlocked "${badge.name}" (${badge.emoji})!`
        );
      }
    }

    return newlyUnlocked;
  }

  /**
   * Check if a specific badge's conditions are met
   *
   * @param badge - Badge definition to check
   * @param stats - User's current statistics
   * @returns True if badge should be unlocked
   */
  private checkBadgeCondition(badge: BadgeDefinition, stats: UserStats): boolean {
    const { condition } = badge;

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
        // Handle special badge conditions
        return this.checkCustomCondition(badge.id, stats, condition.threshold);

      default:
        return false;
    }
  }

  /**
   * Check custom badge conditions that don't fit standard patterns
   *
   * @param badgeId - Badge identifier
   * @param stats - User statistics
   * @param threshold - Threshold value for condition
   * @returns True if custom condition is met
   */
  private checkCustomCondition(
    badgeId: string,
    stats: UserStats,
    threshold: number
  ): boolean {
    switch (badgeId) {
      case 'speed_demon':
        // 5 sessions in one day - check if any day has >= threshold sessions
        const sessionsByDay = stats.sessionsByDay || {};
        return Object.values(sessionsByDay).some((count) => count >= threshold);

      case 'marathon':
        // Single session over 4 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'ultra_marathon':
        // Single session over 8 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'early_bird':
        // 5 sessions before 7 AM (using noon as proxy - will be updated in stats service)
        return (stats.sessionsBeforeNoon || 0) >= threshold;

      case 'night_owl':
        // 5 sessions after 11 PM
        return (stats.sessionsAfterMidnight || 0) >= threshold;

      default:
        return false;
    }
  }

  /**
   * Get all badges a user has unlocked with full badge details
   *
   * @param userId - Discord user ID
   * @returns Array of unlocked badge definitions
   *
   * @example
   * const badges = await badgeService.getUserBadges('123456');
   * console.log(badges.map(b => b.emoji).join(' ')); // '🎯 🔥 💯'
   */
  async getUserBadges(userId: string): Promise<BadgeDefinition[]> {
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
    const badgeIds = stats.badges || [];

    // Map badge IDs to full badge definitions
    return badgeIds
      .map((id) => getBadge(id))
      .filter((badge) => badge !== undefined) as BadgeDefinition[];
  }
}
