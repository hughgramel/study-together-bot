import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { UserStats } from '../types';
import { isSameDay, isYesterday } from '../utils/formatters';

export class StatsService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Gets user statistics
   */
  async getUserStats(userId: string): Promise<UserStats | null> {
    const doc = await this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as UserStats;
  }

  /**
   * Updates user statistics after completing a session
   */
  async updateUserStats(
    userId: string,
    username: string,
    sessionDuration: number
  ): Promise<void> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    const now = Timestamp.now();

    if (!doc.exists) {
      // First session ever
      const newStats: UserStats = {
        username,
        totalSessions: 1,
        totalDuration: sessionDuration,
        currentStreak: 1,
        longestStreak: 1,
        lastSessionAt: now,
        firstSessionAt: now,
      };

      await statsRef.set(newStats);
      return;
    }

    // Update existing stats
    const stats = doc.data() as UserStats;

    // Calculate new streak
    let newStreak = stats.currentStreak;

    if (isSameDay(stats.lastSessionAt, now)) {
      // Same day - keep streak
      newStreak = stats.currentStreak;
    } else if (isYesterday(stats.lastSessionAt, now)) {
      // Yesterday - increment streak
      newStreak = stats.currentStreak + 1;
    } else {
      // 2+ days ago - reset streak
      newStreak = 1;
    }

    // Update longest streak if needed
    const newLongestStreak = Math.max(newStreak, stats.longestStreak);

    const updates: Partial<UserStats> = {
      username, // Update username in case it changed
      totalSessions: stats.totalSessions + 1,
      totalDuration: stats.totalDuration + sessionDuration,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastSessionAt: now,
    };

    await statsRef.update(updates);
  }

  /**
   * Gets user's ranking position based on total duration
   * Returns the user's rank (1-indexed) and total number of users
   */
  async getUserRanking(userId: string): Promise<{ rank: number; total: number } | null> {
    // Get all user stats
    const snapshot = await this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .orderBy('totalDuration', 'desc')
      .get();

    if (snapshot.empty) {
      return null;
    }

    const users = snapshot.docs;
    const userIndex = users.findIndex(doc => doc.id === userId);

    if (userIndex === -1) {
      return null;
    }

    return {
      rank: userIndex + 1,
      total: users.length
    };
  }
}
