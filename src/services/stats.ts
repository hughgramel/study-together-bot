import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { UserStats } from '../types';
import { isSameDay, isYesterday, getDateKey } from '../utils/formatters';
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
   * Check if user has a daily goal set for a specific date
   */
  private async hasGoalForDate(userId: string, timestamp: Timestamp): Promise<boolean> {
    try {
      const dailyGoalRef = this.db
        .collection('discord-data')
        .doc('dailyGoals')
        .collection('goals')
        .doc(userId);

      const doc = await dailyGoalRef.get();
      if (!doc.exists) {
        return false;
      }

      const data = doc.data();
      const dateKey = getDateKey(timestamp);
      return data?.goalsByDay?.[dateKey] !== undefined;
    } catch (error) {
      console.error('Error checking goal for date:', error);
      return false;
    }
  }

  /**
   * Check if user had activity (session OR goal) on a specific date
   */
  private async hasActivityForDate(userId: string, timestamp: Timestamp): Promise<boolean> {
    // Check sessions
    const dateKey = getDateKey(timestamp);
    const stats = await this.getUserStats(userId);
    const hasSession = stats?.sessionsByDay?.[dateKey] !== undefined && stats.sessionsByDay[dateKey] > 0;

    // Check goals
    const hasGoal = await this.hasGoalForDate(userId, timestamp);

    return hasSession || hasGoal;
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
   * Calculate current streak considering both sessions AND goals
   * This is used by the daily-goal command to show accurate streak
   */
  async getCurrentStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
    const stats = await this.getUserStats(userId);

    if (!stats) {
      // Check if user has set any goals
      const dailyGoalRef = this.db
        .collection('discord-data')
        .doc('dailyGoals')
        .collection('goals')
        .doc(userId);
      const goalDoc = await dailyGoalRef.get();

      if (!goalDoc.exists || !goalDoc.data()?.lastGoalSetAt) {
        return { currentStreak: 0, longestStreak: 0 };
      }

      // User has goals but no sessions - calculate streak from goals only
      const goalData = goalDoc.data();
      if (!goalData) {
        return { currentStreak: 0, longestStreak: 0 };
      }

      const today = Timestamp.now();

      if (goalData.lastGoalSetAt && isSameDay(goalData.lastGoalSetAt, today)) {
        return { currentStreak: 1, longestStreak: 1 };
      } else if (goalData.lastGoalSetAt && isYesterday(goalData.lastGoalSetAt, today)) {
        return { currentStreak: 1, longestStreak: 1 };
      }

      return { currentStreak: 0, longestStreak: 0 };
    }

    // User has stats - use the stored streak (which already considers goals via updateUserStats)
    return {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
    };
  }

  /**
   * Updates user statistics after completing a session
   * Now includes XP awarding with intensity multiplier
   */
  async updateUserStats(
    userId: string,
    username: string,
    sessionDuration: number,
    activity?: string,
    intensity?: number
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

    // Calculate XP multiplier based on intensity (1-5 scale)
    // 1=0.8x, 2=0.9x, 3=1.0x, 4=1.2x, 5=1.5x
    let xpMultiplier: number;
    if (intensity === 1) {
      xpMultiplier = 0.8;
    } else if (intensity === 2) {
      xpMultiplier = 0.9;
    } else if (intensity === 3) {
      xpMultiplier = 1.0;
    } else if (intensity === 4) {
      xpMultiplier = 1.2;
    } else if (intensity === 5) {
      xpMultiplier = 1.5;
    } else {
      // Default to 1.0x if no intensity provided (for backwards compatibility)
      xpMultiplier = 1.0;
    }

    if (!doc.exists) {
      // First session ever - award initial XP
      const xpBreakdown = this.xpService.getSessionXPBreakdown(
        sessionDuration,
        false, // no streak milestone yet
        1
      );

      // Apply intensity multiplier to total XP
      const baseXP = xpBreakdown.total;
      const finalXP = Math.ceil(baseXP * xpMultiplier);

      const newStats: UserStats = {
        username,
        totalSessions: 1,
        totalDuration: sessionDuration,
        currentStreak: 1,
        longestStreak: 1,
        lastSessionAt: now,
        firstSessionAt: now,
        // XP & Achievement fields
        xp: finalXP,
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
        xpGained: finalXP,
        leveledUp: false,
        xpMultiplier,
      };
    }

    // Update existing stats
    const stats = doc.data() as UserStats;

    // Calculate new streak (considering both sessions and goals)
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
      // More than 1 day ago - check if goals were set to maintain streak
      // We need to check each day between last session and today
      let streakBroken = false;
      const lastActivityDate = new Date(stats.lastSessionAt.toMillis());
      const today = new Date(now.toMillis());

      // Check each day between last session and today (exclusive)
      for (let d = new Date(lastActivityDate); d < today; d.setDate(d.getDate() + 1)) {
        const checkDate = Timestamp.fromDate(new Date(d));
        const hadActivity = await this.hasActivityForDate(userId, checkDate);

        if (!hadActivity && !isSameDay(checkDate, stats.lastSessionAt)) {
          streakBroken = true;
          break;
        }
      }

      if (streakBroken) {
        // Reset streak
        newStreak = 1;
      } else {
        // Maintain or increment streak
        newStreak = stats.currentStreak + 1;
        // Check for milestone
        if (newStreak === 7 || newStreak === 30) {
          isStreakMilestone = true;
        }
      }
    }

    // Update longest streak if needed
    const newLongestStreak = Math.max(newStreak, stats.longestStreak);

    // Calculate XP to award with intensity multiplier
    const xpBreakdown = this.xpService.getSessionXPBreakdown(
      sessionDuration,
      isStreakMilestone,
      newStreak
    );

    // Apply intensity multiplier to total XP
    const baseXP = xpBreakdown.total;
    const finalXP = Math.floor(baseXP * xpMultiplier);

    // Award XP
    const xpResult = await this.xpService.awardXP(
      userId,
      finalXP,
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

    await statsRef.update(updates);

    const updatedStats = { ...stats, ...updates, xp: xpResult.newXp };

    return {
      stats: updatedStats as UserStats,
      xpGained: finalXP,
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

  /**
   * Gets top users sorted by XP earned in timeframe with hours
   * Used for daily/weekly/monthly leaderboards sorted by timeframe XP
   */
  async getTopUsersByXPWithTimeframe(
    since: Timestamp,
    limit: number = 20,
    serverId?: string
  ): Promise<Array<{
    userId: string;
    username: string;
    xp: number;
    level: number;
    timeframeHours: number;
    sessionCount: number;
  }>> {
    // Get all sessions in the timeframe
    let sessionsQuery = this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('createdAt', '>=', since);

    if (serverId) {
      sessionsQuery = sessionsQuery.where('serverId', '==', serverId);
    }

    const sessionsSnapshot = await sessionsQuery.get();

    if (sessionsSnapshot.empty) {
      return [];
    }

    // Aggregate XP and hours by user for this timeframe
    const userDataMap = new Map<string, {
      username: string;
      totalXP: number;
      totalDuration: number;
      sessionCount: number;
      totalAllTimeXP: number;
    }>();

    sessionsSnapshot.docs.forEach(doc => {
      const session = doc.data();
      const userId = session.userId;
      const duration = session.duration || 0;
      const xpGained = session.xpGained || 0;

      if (userDataMap.has(userId)) {
        const existing = userDataMap.get(userId)!;
        existing.totalXP += xpGained;
        existing.totalDuration += duration;
        existing.sessionCount += 1;
      } else {
        userDataMap.set(userId, {
          username: session.username,
          totalXP: xpGained,
          totalDuration: duration,
          sessionCount: 1,
          totalAllTimeXP: 0
        });
      }
    });

    // Get all-time XP for each user (for level display)
    const userIds = Array.from(userDataMap.keys());
    const userStatsPromises = userIds.map(userId =>
      this.db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats')
        .doc(userId)
        .get()
    );

    const userStatsDocs = await Promise.all(userStatsPromises);
    userStatsDocs.forEach((doc, index) => {
      if (doc.exists) {
        const data = doc.data() as UserStats;
        const userId = userIds[index];
        const userData = userDataMap.get(userId);
        if (userData) {
          userData.totalAllTimeXP = data.xp || 0;
        }
      }
    });

    // Convert to array and sort by timeframe XP
    const users = Array.from(userDataMap.entries())
      .map(([userId, data]) => ({
        userId,
        username: data.username,
        xp: data.totalXP, // XP earned in this timeframe
        level: calculateLevel(data.totalAllTimeXP), // Level based on all-time XP
        timeframeHours: data.totalDuration / 3600,
        sessionCount: data.sessionCount
      }))
      .sort((a, b) => b.xp - a.xp) // Sort by timeframe XP descending
      .slice(0, limit);

    return users;
  }

  /**
   * Get historical chart data for a user
   * Returns time-series data for hours, XP, or sessions
   */
  async getHistoricalChartData(
    userId: string,
    metric: 'hours' | 'xp' | 'sessions' | 'totalHours',
    timeframe: 'week' | 'month' | 'year'
  ): Promise<{
    data: Array<{ label: string; value: number }>;
    currentValue: number;
    previousValue: number;
  }> {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let bucketCount: number;
    let labelFormat: (date: Date, index?: number) => string;

    // Determine timeframe and bucket configuration
    if (timeframe === 'week') {
      // Week view: 7 days ending today
      startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago so including today = 7 days
      startDate.setHours(0, 0, 0, 0); // Set to start of day
      previousStartDate = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      previousStartDate.setHours(0, 0, 0, 0);
      bucketCount = 7;
      labelFormat = (date) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[date.getDay()];
      };
    } else if (timeframe === 'month') {
      // Month view: 4 weeks
      startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
      bucketCount = 4;
      labelFormat = (date, weekNumber?) => {
        return `Week ${(weekNumber || 0) + 1}`;
      };
    } else {
      // Year view: 12 months
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      previousStartDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
      bucketCount = 12;
      labelFormat = (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[date.getMonth()];
      };
    }

    // Fetch sessions from the database
    const sessionsSnapshot = await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(previousStartDate))
      .get();

    // Initialize buckets for current and previous periods
    const currentBuckets: number[] = new Array(bucketCount).fill(0);
    const previousBuckets: number[] = new Array(bucketCount).fill(0);
    const labels: string[] = [];

    // Generate labels
    for (let i = 0; i < bucketCount; i++) {
      let labelDate: Date;
      if (timeframe === 'year') {
        labelDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        labels.push(labelFormat(labelDate));
      } else if (timeframe === 'month') {
        // For month view, use week number
        labels.push(`Week ${i + 1}`);
      } else {
        labelDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        labels.push(labelFormat(labelDate));
      }
    }

    // Aggregate sessions into buckets
    sessionsSnapshot.docs.forEach(doc => {
      const session = doc.data();
      const sessionDate = session.createdAt.toDate();
      const duration = session.duration || 0;
      const xpGained = session.xpGained || 0;

      // Determine which bucket this session belongs to
      let bucketIndex: number;
      let isCurrentPeriod: boolean;

      if (timeframe === 'year') {
        // For year view, bucket by month
        const monthsDiff = (sessionDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (sessionDate.getMonth() - startDate.getMonth());
        bucketIndex = monthsDiff;
        isCurrentPeriod = sessionDate >= startDate;
      } else if (timeframe === 'month') {
        // For month view, bucket by week (7-day periods)
        const timeDiff = sessionDate.getTime() - startDate.getTime();
        const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
        bucketIndex = Math.floor(daysDiff / 7); // Group into weeks
        isCurrentPeriod = sessionDate >= startDate;
      } else {
        // For week view, bucket by day
        const timeDiff = sessionDate.getTime() - startDate.getTime();
        const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
        bucketIndex = daysDiff;
        isCurrentPeriod = sessionDate >= startDate;
      }

      // Add to appropriate bucket
      if (isCurrentPeriod && bucketIndex >= 0 && bucketIndex < bucketCount) {
        if (metric === 'hours' || metric === 'totalHours') {
          currentBuckets[bucketIndex] += duration / 3600;
        } else if (metric === 'xp') {
          currentBuckets[bucketIndex] += xpGained;
        } else if (metric === 'sessions') {
          currentBuckets[bucketIndex] += 1;
        }
      } else if (!isCurrentPeriod) {
        // Previous period
        let prevBucketIndex: number;
        if (timeframe === 'year') {
          const monthsDiff = (sessionDate.getFullYear() - previousStartDate.getFullYear()) * 12 +
                            (sessionDate.getMonth() - previousStartDate.getMonth());
          prevBucketIndex = monthsDiff;
        } else if (timeframe === 'month') {
          const timeDiff = sessionDate.getTime() - previousStartDate.getTime();
          const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
          prevBucketIndex = Math.floor(daysDiff / 7);
        } else {
          const timeDiff = sessionDate.getTime() - previousStartDate.getTime();
          const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
          prevBucketIndex = daysDiff;
        }

        if (prevBucketIndex >= 0 && prevBucketIndex < bucketCount) {
          if (metric === 'hours' || metric === 'totalHours') {
            previousBuckets[prevBucketIndex] += duration / 3600;
          } else if (metric === 'xp') {
            previousBuckets[prevBucketIndex] += xpGained;
          } else if (metric === 'sessions') {
            previousBuckets[prevBucketIndex] += 1;
          }
        }
      }
    });

    // Calculate totals
    const currentTotal = currentBuckets.reduce((sum, val) => sum + val, 0);
    const previousTotal = previousBuckets.reduce((sum, val) => sum + val, 0);

    // Create data array with labels
    let data: Array<{ label: string; value: number }>;

    if (metric === 'totalHours') {
      // For totalHours, create cumulative values
      let cumulative = 0;
      data = labels.map((label, index) => {
        cumulative += currentBuckets[index] || 0;
        return {
          label,
          value: cumulative,
        };
      });
    } else {
      // For other metrics, use regular values
      data = labels.map((label, index) => ({
        label,
        value: currentBuckets[index] || 0,
      }));
    }

    return {
      data,
      currentValue: currentTotal,
      previousValue: previousTotal,
    };
  }
}
