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
        // XP & Achievement fields
        xp: randomizedXP,
        achievements: [],
        achievementsUnlockedAt: {},
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

    // Track longest session and new record
    const previousLongestSession = stats.longestSessionDuration || 0;
    const newLongestSession = Math.max(previousLongestSession, sessionDuration);
    const beatPersonalBest = sessionDuration > previousLongestSession;

    const updates: Partial<UserStats> = {
      username, // Update username in case it changed
      totalSessions: stats.totalSessions + 1,
      totalDuration: stats.totalDuration + sessionDuration,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastSessionAt: now,
      sessionsByDay,
      activityTypes,
      longestSessionDuration: newLongestSession,
    };

    // TIME-OF-DAY TRACKING
    // Check session completion hour
    const completionHour = now.toDate().getHours();

    // Sessions completed before 7 AM
    if (this.isBeforeHour(now, 7)) {
      updates.sessionsBefore7AM = (stats.sessionsBefore7AM || 0) + 1;
    }

    // Sessions completed after 11 PM
    if (this.isAfterHour(now, 23)) {
      updates.sessionsAfter11PM = (stats.sessionsAfter11PM || 0) + 1;
    }

    // Sessions completed after midnight (12 AM - 6 AM)
    if (completionHour >= 0 && completionHour < 6) {
      updates.sessionsAfterMidnight = (stats.sessionsAfterMidnight || 0) + 1;
    }

    // Morning sessions (1+ hour before 10 AM)
    // Session must be at least 1 hour AND completed before 10 AM
    if (sessionDuration >= 3600 && this.isBeforeHour(now, 10)) {
      updates.morningSessionsBefore10AM = (stats.morningSessionsBefore10AM || 0) + 1;
    }

    // WEEKEND & WEEKLY TRACKING
    const weekKey = this.getWeekKey(now);
    const dayOfWeek = this.getDayOfWeek(now);

    // Track sessions by week and day for weekend warrior and full week achievements
    // Load existing data and convert to Set for easier manipulation
    const weekdayTracking = stats.weekdayTracking || {};
    const daysThisWeekSet = new Set<number>(weekdayTracking[weekKey] || []);
    const previousWeekSize = daysThisWeekSet.size;
    daysThisWeekSet.add(dayOfWeek);

    // Check for weekend warrior (both Saturday=6 and Sunday=0 in same week)
    const hasWeekendWarrior = daysThisWeekSet.has(0) && daysThisWeekSet.has(6);
    if (hasWeekendWarrior) {
      // Only count this week once (check if we already counted it)
      const alreadyCounted = (weekdayTracking[weekKey] || []).includes(0) &&
                             (weekdayTracking[weekKey] || []).includes(6);
      if (!alreadyCounted) {
        updates.weekendWarriorWeeks = (stats.weekendWarriorWeeks || 0) + 1;

        // Track consecutive weekend streak
        // Get previous week's data to check if they also had weekend warrior
        const previousWeekKey = this.getPreviousWeekKey(now);
        const previousWeekDays = weekdayTracking[previousWeekKey] || [];
        const hadPreviousWeekendWarrior = previousWeekDays.includes(0) && previousWeekDays.includes(6);

        if (hadPreviousWeekendWarrior) {
          // Continue streak
          updates.consecutiveWeekendStreak = (stats.consecutiveWeekendStreak || 0) + 1;
        } else {
          // Start new streak
          updates.consecutiveWeekendStreak = 1;
        }
      }
    }

    // Check for full week (all 7 days: 0-6)
    if (daysThisWeekSet.size === 7 && previousWeekSize < 7) {
      updates.fullWeeksCompleted = (stats.fullWeeksCompleted || 0) + 1;
    }

    // Store weekday tracking (convert Set to Array for Firestore)
    updates.weekdayTracking = {
      ...weekdayTracking,
      [weekKey]: Array.from(daysThisWeekSet)
    };

    // MONTHLY TRACKING
    const monthKey = this.getMonthKey(now);
    const monthDayTracking = stats.monthDayTracking || {};
    const daysThisMonthSet = new Set<string>(monthDayTracking[monthKey] || []);
    daysThisMonthSet.add(dateKey);

    // Update best month if current month has more days
    const daysThisMonth = daysThisMonthSet.size;
    const currentBest = stats.bestMonthDaysCount || 0;
    if (daysThisMonth > currentBest) {
      updates.bestMonthDaysCount = daysThisMonth;
    }

    // Store month day tracking (convert Set to Array for Firestore)
    updates.monthDayTracking = {
      ...monthDayTracking,
      [monthKey]: Array.from(daysThisMonthSet)
    };

    // NEW RECORD TRACKING
    // Set temporary flag if user beat their personal best
    if (beatPersonalBest && previousLongestSession > 0) {
      updates.newRecordUnlocked = true;
    }

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
   * Helper to get week key in YYYY-Www format (ISO week)
   */
  private getWeekKey(timestamp: Timestamp): string {
    const date = timestamp.toDate();
    const year = date.getFullYear();
    const week = this.getISOWeek(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Helper to get previous week key (for streak tracking)
   */
  private getPreviousWeekKey(timestamp: Timestamp): string {
    const date = timestamp.toDate();
    // Subtract 7 days to get previous week
    const previousWeek = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
    const year = previousWeek.getFullYear();
    const week = this.getISOWeek(previousWeek);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Helper to get ISO week number (1-53)
   */
  private getISOWeek(date: Date): number {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }

  /**
   * Helper to get month key in YYYY-MM format
   */
  private getMonthKey(timestamp: Timestamp): string {
    const date = timestamp.toDate();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Check if timestamp is before a specific hour (local time)
   */
  private isBeforeHour(timestamp: Timestamp, hour: number): boolean {
    const date = timestamp.toDate();
    return date.getHours() < hour;
  }

  /**
   * Check if timestamp is after a specific hour (local time)
   */
  private isAfterHour(timestamp: Timestamp, hour: number): boolean {
    const date = timestamp.toDate();
    return date.getHours() >= hour;
  }

  /**
   * Get day of week (0 = Sunday, 6 = Saturday)
   */
  private getDayOfWeek(timestamp: Timestamp): number {
    return timestamp.toDate().getDay();
  }

  /**
   * Check if timestamp is on weekend (Saturday or Sunday)
   */
  private isWeekend(timestamp: Timestamp): boolean {
    const day = this.getDayOfWeek(timestamp);
    return day === 0 || day === 6; // Sunday or Saturday
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
   * Returns array of users with their XP, level, and achievement count
   */
  async getTopUsersByXP(limit: number = 20): Promise<Array<{
    userId: string;
    username: string;
    xp: number;
    level: number;
    achievementCount: number;
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
      const achievementCount = (data.achievements || []).length;

      return {
        userId: doc.id,
        username: data.username,
        xp,
        level,
        achievementCount
      };
    });

    return users;
  }
}
