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
   * Returns information about streaks and PRs for celebration
   */
  async updateUserStats(
    userId: string,
    username: string,
    sessionDuration: number
  ): Promise<{
    isFirstSessionOfDay: boolean;
    newStreak: number;
    previousStreak: number;
    newPRs: string[]; // Array of PR types achieved: 'session', 'day', 'week'
  }> {
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
        longestSessionDuration: sessionDuration,
        mostHoursInDay: sessionDuration,
        mostHoursInWeek: sessionDuration,
        achievements: [],
      };

      await statsRef.set(newStats);
      return {
        isFirstSessionOfDay: true,
        newStreak: 1,
        previousStreak: 0,
        newPRs: ['session', 'day', 'week'], // First session is always all PRs
      };
    }

    // Update existing stats
    const stats = doc.data() as UserStats;
    const isFirstSessionOfDay = !isSameDay(stats.lastSessionAt, now);

    // Calculate new streak
    let newStreak = stats.currentStreak;
    const previousStreak = stats.currentStreak;

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

    // Check for Personal Records
    const newPRs: string[] = [];

    // Session duration PR
    const longestSessionDuration = stats.longestSessionDuration || 0;
    if (sessionDuration > longestSessionDuration) {
      newPRs.push('session');
    }

    // Calculate today's total hours (we need to query completed sessions)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todaySessions = await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(today))
      .get();

    const todayTotal = todaySessions.docs.reduce((sum, doc) => {
      return sum + (doc.data() as any).duration;
    }, 0);

    const mostHoursInDay = stats.mostHoursInDay || 0;
    if (todayTotal > mostHoursInDay) {
      newPRs.push('day');
    }

    // Calculate this week's total hours
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekSessions = await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(weekAgo))
      .get();

    const weekTotal = weekSessions.docs.reduce((sum, doc) => {
      return sum + (doc.data() as any).duration;
    }, 0);

    const mostHoursInWeek = stats.mostHoursInWeek || 0;
    if (weekTotal > mostHoursInWeek) {
      newPRs.push('week');
    }

    const updates: Partial<UserStats> = {
      username, // Update username in case it changed
      totalSessions: stats.totalSessions + 1,
      totalDuration: stats.totalDuration + sessionDuration,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastSessionAt: now,
      longestSessionDuration: Math.max(sessionDuration, longestSessionDuration),
      mostHoursInDay: Math.max(todayTotal, mostHoursInDay),
      mostHoursInWeek: Math.max(weekTotal, mostHoursInWeek),
    };

    await statsRef.update(updates);

    return {
      isFirstSessionOfDay,
      newStreak,
      previousStreak,
      newPRs,
    };
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

  /**
   * Awards an achievement to a user if they don't already have it
   * Returns true if the achievement was newly awarded
   */
  async awardAchievement(userId: string, achievementId: string): Promise<boolean> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    if (!doc.exists) {
      return false;
    }

    const stats = doc.data() as UserStats;
    const achievements = stats.achievements || [];

    // Check if already earned
    if (achievements.includes(achievementId)) {
      return false;
    }

    // Award the achievement
    await statsRef.update({
      achievements: [...achievements, achievementId],
    });

    return true;
  }
}
