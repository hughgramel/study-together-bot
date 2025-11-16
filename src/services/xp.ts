import { Firestore } from 'firebase-admin/firestore';
import { calculateLevel, awardXP as calculateXP } from '../utils/xp';

/**
 * XP Service - Manages XP awarding and level tracking in Firestore
 *
 * This service handles all XP-related database operations, including:
 * - Awarding XP to users
 * - Calculating XP from session duration
 * - Computing XP breakdowns with bonuses
 */
export class XPService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Award XP to a user and update their level in Firestore
   *
   * @param userId - Discord user ID
   * @param amount - Amount of XP to award
   * @param reason - Reason for XP award (for logging)
   * @returns Object with new XP, level, and level-up information
   *
   * @throws Error if user stats not found
   *
   * @example
   * await xpService.awardXP('123456', 50, 'Session completed');
   * // Returns: { newXp: 350, newLevel: 2, leveledUp: true, levelsGained: 1 }
   */
  async awardXP(
    userId: string,
    amount: number,
    reason: string
  ): Promise<{ newXp: number; newLevel: number; leveledUp: boolean; levelsGained: number }> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();

    if (!doc.exists) {
      throw new Error(`User stats not found for ${userId}`);
    }

    const stats = doc.data();
    const currentXp = stats?.xp || 0;

    // Calculate new XP and level using utilities
    const result = calculateXP(currentXp, amount);

    // Update Firestore with new XP total
    // Note: Level is calculated on-demand, not stored
    await statsRef.update({
      xp: result.newXp,
    });

    console.log(
      `[XP] Awarded ${amount} XP to ${userId} for "${reason}". ` +
      `New XP: ${result.newXp}, Level: ${result.newLevel}${result.leveledUp ? ` (LEVEL UP! +${result.levelsGained})` : ''}`
    );

    return result;
  }

  /**
   * Calculate XP earned from session duration
   * Formula: 100 XP per hour
   *
   * @param durationSeconds - Session duration in seconds
   * @returns XP earned from time studied
   *
   * @example
   * calculateSessionXP(3600)  // 1 hour = 100 XP
   * calculateSessionXP(1800)  // 30 minutes = 50 XP
   * calculateSessionXP(7200)  // 2 hours = 200 XP
   */
  calculateSessionXP(durationSeconds: number): number {
    const hours = durationSeconds / 3600;
    return Math.floor(hours * 100);
  }

  /**
   * Get detailed XP breakdown for a completed session
   * Includes base XP from time plus all applicable bonuses
   *
   * @param durationSeconds - Session duration in seconds
   * @param isFirstSessionToday - Whether this is the first session of the day
   * @param isStreakMilestone - Whether this session hits a streak milestone
   * @param streakDays - Current streak length
   * @returns Object with total XP and itemized breakdown
   *
   * @example
   * getSessionXPBreakdown(3600, true, false, 1)
   * // Returns:
   * // {
   * //   total: 60,
   * //   breakdown: [
   * //     { source: 'Time studied', amount: 10 },
   * //     { source: 'Session completed', amount: 25 },
   * //     { source: 'First session today', amount: 25 }
   * //   ]
   * // }
   */
  getSessionXPBreakdown(
    durationSeconds: number,
    isFirstSessionToday: boolean,
    isStreakMilestone: boolean,
    streakDays: number
  ): { total: number; breakdown: Array<{ source: string; amount: number }> } {
    const breakdown: Array<{ source: string; amount: number }> = [];

    // Base XP from time studied (10 XP/hour)
    const timeXP = this.calculateSessionXP(durationSeconds);
    breakdown.push({ source: 'Time studied', amount: timeXP });

    // Session completion bonus (always awarded)
    breakdown.push({ source: 'Session completed', amount: 25 });

    // First session of the day bonus
    if (isFirstSessionToday) {
      breakdown.push({ source: 'First session today', amount: 25 });
    }

    // Streak milestone bonuses
    if (isStreakMilestone) {
      if (streakDays === 7) {
        breakdown.push({ source: '7-day streak milestone', amount: 100 });
      } else if (streakDays === 30) {
        breakdown.push({ source: '30-day streak milestone', amount: 500 });
      }
    }

    // Calculate total
    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

    return { total, breakdown };
  }
}
