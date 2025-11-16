import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { UserStats } from '../types';
import { isSameDay, isYesterday } from '../utils/formatters';
import { XPService } from './xp';
import { calculateLevel } from '../utils/xp';

export class StatsService {
  private db: Firestore;
  private xpService: XPService;

  constructor(db: Firestore) {
    this.db = db;
    this.xpService = new XPService(db);
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
   * Now includes XP awarding with randomization
   */
  async updateUserStats(
    userId: string,
    username: string,
    sessionDuration: number,
    activity?: string
  ): Promise<{
    stats: UserStats;
    xpGained: number;
    leveledUp: boolean;
    newLevel?: number;
    xpMultiplier: number;
  }> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    const now = Timestamp.now();

    // Generate random XP multiplier (0.75x - 1.25x)
    const xpMultiplier = 0.75 + Math.random() * 0.5;

    if (!doc.exists) {
      // First session ever - award initial XP
      const xpBreakdown = this.xpService.getSessionXPBreakdown(
        sessionDuration,
        true, // first session of day
        false, // no streak milestone yet
        1
      );

      // Apply randomization to total XP
      const baseXP = xpBreakdown.total;
      const randomizedXP = Math.floor(baseXP * xpMultiplier);

      const newStats: UserStats = {
        username,
        totalSessions: 1,
        totalDuration: sessionDuration,
        currentStreak: 1,
        longestStreak: 1,
        lastSessionAt: now,
        firstSessionAt: now,
        // XP & Badge fields
        xp: randomizedXP,
        badges: [],
        badgesUnlockedAt: {},
        // Session analytics
        sessionsByDay: {
          [this.getDateKey(now)]: 1,
        },
        activityTypes: activity ? [activity] : [],
        longestSessionDuration: sessionDuration,
        firstSessionOfDayCount: 1,
        sessionsBeforeNoon: 0,
        sessionsAfterMidnight: 0,
      };

      await statsRef.set(newStats);

      return {
        stats: newStats,
        xpGained: randomizedXP,
        leveledUp: false,
        xpMultiplier,
      };
    }

    // Update existing stats
    const stats = doc.data() as UserStats;

    // Check if this is first session of the day
    const isFirstSessionToday = !isSameDay(stats.lastSessionAt, now);

    // Calculate new streak
    let newStreak = stats.currentStreak;
    let isStreakMilestone = false;

    if (isSameDay(stats.lastSessionAt, now)) {
      // Same day - keep streak
      newStreak = stats.currentStreak;
    } else if (isYesterday(stats.lastSessionAt, now)) {
      // Yesterday - increment streak
      newStreak = stats.currentStreak + 1;
      // Check for milestone
      if (newStreak === 7 || newStreak === 30) {
        isStreakMilestone = true;
      }
    } else {
      // 2+ days ago - reset streak
      newStreak = 1;
    }

    // Update longest streak if needed
    const newLongestStreak = Math.max(newStreak, stats.longestStreak);

    // Calculate XP to award with randomization
    const xpBreakdown = this.xpService.getSessionXPBreakdown(
      sessionDuration,
      isFirstSessionToday,
      isStreakMilestone,
      newStreak
    );

    // Apply random multiplier (0.75x - 1.25x)
    const baseXP = xpBreakdown.total;
    const randomizedXP = Math.floor(baseXP * xpMultiplier);

    // Award XP
    const xpResult = await this.xpService.awardXP(
      userId,
      randomizedXP,
      'Session completed'
    );

    // Update session tracking
    const dateKey = this.getDateKey(now);
    const sessionsByDay = stats.sessionsByDay || {};
    sessionsByDay[dateKey] = (sessionsByDay[dateKey] || 0) + 1;

    // Update activity types if provided
    const activityTypes = stats.activityTypes || [];
    if (activity && !activityTypes.includes(activity)) {
      activityTypes.push(activity);
    }

    const updates: Partial<UserStats> = {
      username, // Update username in case it changed
      totalSessions: stats.totalSessions + 1,
      totalDuration: stats.totalDuration + sessionDuration,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastSessionAt: now,
      sessionsByDay,
      activityTypes,
      longestSessionDuration: Math.max(
        stats.longestSessionDuration || 0,
        sessionDuration
      ),
    };

    // Only include firstSessionOfDayCount if it needs to be updated
    if (isFirstSessionToday) {
      updates.firstSessionOfDayCount = (stats.firstSessionOfDayCount || 0) + 1;
    }

    await statsRef.update(updates);

    const updatedStats = { ...stats, ...updates, xp: xpResult.newXp };

    return {
      stats: updatedStats as UserStats,
      xpGained: randomizedXP,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.leveledUp ? xpResult.newLevel : undefined,
      xpMultiplier,
    };
  }

  /**
   * Helper to get date key in YYYY-MM-DD format
   */
  private getDateKey(timestamp: Timestamp): string {
    const date = timestamp.toDate();
    return date.toISOString().split('T')[0];
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
   * Gets top users sorted by XP (for XP leaderboards)
   * Returns array of users with their XP, level, and badge count
   */
  async getTopUsersByXP(limit: number = 20): Promise<Array<{
    userId: string;
    username: string;
    xp: number;
    level: number;
    badgeCount: number;
  }>> {
    const snapshot = await this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .orderBy('xp', 'desc')
      .limit(limit)
      .get();

    if (snapshot.empty) {
      return [];
    }

    const users = snapshot.docs.map(doc => {
      const data = doc.data() as UserStats;
      const xp = data.xp || 0;
      const level = calculateLevel(xp);
      const badgeCount = (data.badges || []).length;

      return {
        userId: doc.id,
        username: data.username,
        xp,
        level,
        badgeCount
      };
    });

    return users;
  }
}
