import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { WeeklyChallenge, UserStats } from '../types';
import { calculateLevel } from '../utils/xp';

/**
 * Weekly Challenge Service - Manages weekly XP challenges and leaderboards
 *
 * This service handles:
 * - Creating and managing weekly challenges
 * - Tracking user weekly XP progress
 * - Awarding bonus XP and achievements for completion
 * - Maintaining weekly leaderboards
 */
export class WeeklyChallengeService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Get the ISO week key for a given timestamp (e.g., '2025-W03')
   */
  private getWeekKey(timestamp: Timestamp): string {
    const date = timestamp.toDate();

    // Get ISO week number
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

    return `${tempDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  /**
   * Get start and end timestamps for a week key
   */
  private getWeekBounds(weekKey: string): { start: Timestamp; end: Timestamp } {
    const [year, week] = weekKey.split('-W').map(Number);

    // Find Monday of the week
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4.getTime());
    monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
    monday.setHours(0, 0, 0, 0);

    // Sunday end of week
    const sunday = new Date(monday.getTime());
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: Timestamp.fromDate(monday),
      end: Timestamp.fromDate(sunday)
    };
  }

  /**
   * Get or create the current week's challenge
   */
  async getCurrentChallenge(): Promise<WeeklyChallenge> {
    const now = Timestamp.now();
    const weekKey = this.getWeekKey(now);

    const challengeRef = this.db
      .collection('discord-data')
      .doc('weeklyChallenges')
      .collection('challenges')
      .doc(weekKey);

    const doc = await challengeRef.get();

    if (doc.exists) {
      return doc.data() as WeeklyChallenge;
    }

    // Create new challenge for this week
    const bounds = this.getWeekBounds(weekKey);
    const newChallenge: WeeklyChallenge = {
      weekKey,
      startDate: bounds.start,
      endDate: bounds.end,
      targetXp: 1000, // Goal: 1000 XP per week (~100 hours)
      bonusXp: 200,   // Bonus for completing
      participants: [],
      completedBy: [],
      topEarners: []
    };

    await challengeRef.set(newChallenge);
    console.log(`[CHALLENGE] Created new weekly challenge for ${weekKey}`);

    return newChallenge;
  }

  /**
   * Record XP earned by a user for the current week
   *
   * @param userId - Discord user ID
   * @param username - Discord username
   * @param xpGained - XP earned in this session
   * @returns Object with completion status and bonus XP awarded
   */
  async recordWeeklyXP(
    userId: string,
    username: string,
    xpGained: number
  ): Promise<{
    weeklyTotal: number;
    completed: boolean;
    newlyCompleted: boolean;
    bonusXpAwarded: number;
  }> {
    const now = Timestamp.now();
    const weekKey = this.getWeekKey(now);
    const challenge = await this.getCurrentChallenge();

    // Update user's weekly XP in UserStats
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const statsDoc = await statsRef.get();
    if (!statsDoc.exists) {
      return {
        weeklyTotal: 0,
        completed: false,
        newlyCompleted: false,
        bonusXpAwarded: 0
      };
    }

    const stats = statsDoc.data() as UserStats;
    const weeklyXpEarned = stats.weeklyXpEarned || {};
    const previousWeeklyXp = weeklyXpEarned[weekKey] || 0;
    const newWeeklyXp = previousWeeklyXp + xpGained;

    // Update user's weekly XP
    await statsRef.update({
      [`weeklyXpEarned.${weekKey}`]: newWeeklyXp
    });

    // Add user to participants if not already there
    const challengeRef = this.db
      .collection('discord-data')
      .doc('weeklyChallenges')
      .collection('challenges')
      .doc(weekKey);

    await challengeRef.update({
      participants: FieldValue.arrayUnion(userId)
    });

    // Check if user just completed the challenge
    const wasCompleted = previousWeeklyXp >= challenge.targetXp;
    const isNowCompleted = newWeeklyXp >= challenge.targetXp;
    const newlyCompleted = !wasCompleted && isNowCompleted;

    let bonusXpAwarded = 0;

    if (newlyCompleted) {
      // Award bonus XP
      bonusXpAwarded = challenge.bonusXp;
      await statsRef.update({
        xp: FieldValue.increment(bonusXpAwarded),
        weeklyStreakCount: FieldValue.increment(1)
      });

      // Add to completedBy list
      await challengeRef.update({
        completedBy: FieldValue.arrayUnion(userId)
      });

      console.log(`[CHALLENGE] User ${userId} completed weekly challenge! Awarded ${bonusXpAwarded} bonus XP`);
    }

    // Update weekly leaderboard
    await this.updateWeeklyLeaderboard(weekKey);

    return {
      weeklyTotal: newWeeklyXp,
      completed: isNowCompleted,
      newlyCompleted,
      bonusXpAwarded
    };
  }

  /**
   * Update the top earners leaderboard for a given week
   */
  private async updateWeeklyLeaderboard(weekKey: string): Promise<void> {
    // Get all users with weekly XP for this week
    const snapshot = await this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .get();

    const earners: Array<{
      userId: string;
      username: string;
      xpEarned: number;
      level: number;
    }> = [];

    snapshot.docs.forEach(doc => {
      const stats = doc.data() as UserStats;
      const weeklyXpEarned = stats.weeklyXpEarned || {};
      const xpThisWeek = weeklyXpEarned[weekKey];

      if (xpThisWeek && xpThisWeek > 0) {
        const totalXp = stats.xp || 0;
        earners.push({
          userId: doc.id,
          username: stats.username,
          xpEarned: xpThisWeek,
          level: calculateLevel(totalXp)
        });
      }
    });

    // Sort by XP earned this week (descending)
    earners.sort((a, b) => b.xpEarned - a.xpEarned);

    // Keep top 10
    const topEarners = earners.slice(0, 10);

    // Update challenge document
    const challengeRef = this.db
      .collection('discord-data')
      .doc('weeklyChallenges')
      .collection('challenges')
      .doc(weekKey);

    await challengeRef.update({ topEarners });
  }

  /**
   * Get user's progress for the current week
   */
  async getUserProgress(userId: string): Promise<{
    weeklyXp: number;
    targetXp: number;
    completed: boolean;
    rank: number | null;
  }> {
    const challenge = await this.getCurrentChallenge();
    const weekKey = challenge.weekKey;

    const statsDoc = await this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId)
      .get();

    if (!statsDoc.exists) {
      return {
        weeklyXp: 0,
        targetXp: challenge.targetXp,
        completed: false,
        rank: null
      };
    }

    const stats = statsDoc.data() as UserStats;
    const weeklyXpEarned = stats.weeklyXpEarned || {};
    const weeklyXp = weeklyXpEarned[weekKey] || 0;
    const completed = weeklyXp >= challenge.targetXp;

    // Find user's rank
    const rank = challenge.topEarners.findIndex(e => e.userId === userId);

    return {
      weeklyXp,
      targetXp: challenge.targetXp,
      completed,
      rank: rank >= 0 ? rank + 1 : null
    };
  }
}
