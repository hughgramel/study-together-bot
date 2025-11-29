/**
 * Analytics Deep Dive Report Generator
 *
 * This script queries Firebase to generate a comprehensive analytics report
 * Run with: npx ts-node scripts/analytics-deep-dive.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Types
interface UserStats {
  username: string;
  totalSessions: number;
  totalDuration: number;
  currentStreak: number;
  longestStreak: number;
  lastSessionAt: admin.firestore.Timestamp;
  firstSessionAt: admin.firestore.Timestamp;
  xp?: number;
  achievements?: string[];
  leveledAchievements?: Record<string, any>;
  sessionsByDay?: Record<string, number>;
}

interface CompletedSession {
  userId: string;
  username: string;
  serverId: string;
  activity: string;
  title: string;
  description: string;
  duration: number;
  startTime: admin.firestore.Timestamp;
  endTime: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  xpGained?: number;
}

interface UserAnalytics {
  userId: string;
  username: string;
  joinDate: Date;
  daysSinceJoining: number;
  totalSessions: number;
  totalHours: number;
  hoursPerWeek: number;
  lastSessionDate: Date;
  currentStreak: number;
  longestStreak: number;
  level: number;
  xp: number;
  mostCommonStudyTime: string;
  firstSessionDate: Date;
  firstSessionDuration: number;
  firstSessionActivity: string;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  sessionsPerDay: Record<string, number>;
  hoursByTimeSlot: { morning: number; afternoon: number; evening: number; night: number };
  sessions: CompletedSession[];
}

// Utility functions
function calculateLevel(xp: number): number {
  if (xp < 283) return 1;
  const level = Math.round(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level));
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function getTimeSlot(date: Date): string {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getCohort(joinDate: Date): string {
  const nov9 = new Date('2024-11-09');
  const nov16 = new Date('2024-11-16');
  const nov23 = new Date('2024-11-23');

  if (joinDate < nov16) return 'Week 1 (Nov 9-15)';
  if (joinDate < nov23) return 'Week 2 (Nov 16-22)';
  return 'Week 3 (Nov 23-29)';
}

async function getAllUsers(): Promise<Map<string, UserStats>> {
  const snapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .get();

  const users = new Map<string, UserStats>();
  snapshot.forEach(doc => {
    users.set(doc.id, doc.data() as UserStats);
  });

  return users;
}

async function getAllSessions(): Promise<CompletedSession[]> {
  const snapshot = await db
    .collection('discord-data')
    .doc('sessions')
    .collection('completed')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => doc.data() as CompletedSession);
}

async function analyzeUsers(): Promise<UserAnalytics[]> {
  const userStats = await getAllUsers();
  const allSessions = await getAllSessions();

  // Use most recent session date as "now" to handle stale data
  const mostRecentSession = allSessions[0];
  const now = mostRecentSession?.endTime?.toDate() || new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const userAnalytics: UserAnalytics[] = [];

  for (const [userId, stats] of userStats) {
    const userSessions = allSessions.filter(s => s.userId === userId);

    if (userSessions.length === 0) continue;

    // Sort sessions by date (oldest first for first session)
    const sortedSessions = [...userSessions].sort((a, b) =>
      a.createdAt.toMillis() - b.createdAt.toMillis()
    );

    const firstSession = sortedSessions[0];
    const lastSession = sortedSessions[sortedSessions.length - 1];

    const joinDate = stats.firstSessionAt?.toDate() || firstSession.createdAt.toDate();
    const daysSinceJoining = Math.floor((now.getTime() - joinDate.getTime()) / (24 * 60 * 60 * 1000));

    // Calculate hours by time slot
    const hoursByTimeSlot = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const sessionsPerDay: Record<string, number> = {};

    for (const session of userSessions) {
      const sessionDate = session.startTime.toDate();
      const slot = getTimeSlot(sessionDate);
      hoursByTimeSlot[slot as keyof typeof hoursByTimeSlot] += session.duration / 3600;

      const dayOfWeek = sessionDate.toLocaleDateString('en-US', { weekday: 'long' });
      sessionsPerDay[dayOfWeek] = (sessionsPerDay[dayOfWeek] || 0) + 1;
    }

    // Find most common study time
    let mostCommonSlot = 'evening';
    let maxHours = 0;
    for (const [slot, hours] of Object.entries(hoursByTimeSlot)) {
      if (hours > maxHours) {
        maxHours = hours;
        mostCommonSlot = slot;
      }
    }

    // Sessions in last 7 days
    const recentSessions = userSessions.filter(s =>
      s.startTime.toDate() >= sevenDaysAgo
    );
    const sessionsThisWeek = recentSessions.length;
    const hoursThisWeek = recentSessions.reduce((sum, s) => sum + s.duration, 0) / 3600;

    // Calculate total hours from sessions (more reliable than stats.totalDuration)
    const totalHoursFromSessions = userSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 3600;
    const totalHours = stats.totalDuration ? stats.totalDuration / 3600 : totalHoursFromSessions;

    // Weekly average
    const weeksActive = Math.max(1, daysSinceJoining / 7);
    const hoursPerWeek = totalHours / weeksActive;

    userAnalytics.push({
      userId,
      username: stats.username,
      joinDate,
      daysSinceJoining,
      totalSessions: stats.totalSessions || userSessions.length,
      totalHours,
      hoursPerWeek,
      lastSessionDate: stats.lastSessionAt?.toDate() || lastSession.endTime.toDate(),
      currentStreak: stats.currentStreak || 0,
      longestStreak: stats.longestStreak || 0,
      level: calculateLevel(stats.xp || 0),
      xp: stats.xp || 0,
      mostCommonStudyTime: mostCommonSlot,
      firstSessionDate: joinDate,
      firstSessionDuration: firstSession.duration,
      firstSessionActivity: firstSession.activity || firstSession.title || 'Unknown',
      sessionsThisWeek,
      hoursThisWeek,
      sessionsPerDay,
      hoursByTimeSlot,
      sessions: userSessions,
    });
  }

  return userAnalytics;
}

async function generateReport(): Promise<string> {
  console.log('Fetching data from Firebase...');

  const userAnalytics = await analyzeUsers();
  const allSessions = await getAllSessions();

  // Use most recent session date as "now" to handle stale data
  const mostRecentSession = allSessions[0];
  const dataEndDate = mostRecentSession?.endTime?.toDate() || new Date();
  const now = dataEndDate;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  console.log(`Data end date: ${dataEndDate.toISOString()}`);
  console.log(`7 days ago from data: ${sevenDaysAgo.toISOString()}`);

  // Sort by different criteria
  const byStreak = [...userAnalytics].sort((a, b) => b.currentStreak - a.currentStreak);
  const byTotalHours = [...userAnalytics].sort((a, b) => b.totalHours - a.totalHours);
  const byLastActive = [...userAnalytics].sort((a, b) =>
    b.lastSessionDate.getTime() - a.lastSessionDate.getTime()
  );

  // Active users (session in last 7 days)
  const activeUsers = userAnalytics.filter(u => u.lastSessionDate >= sevenDaysAgo);

  // Churn risk (inactive 7-30 days)
  const churnRisk = userAnalytics.filter(u =>
    u.lastSessionDate < sevenDaysAgo && u.lastSessionDate >= thirtyDaysAgo
  );

  // Churned (inactive 30+ days)
  const churned = userAnalytics.filter(u => u.lastSessionDate < thirtyDaysAgo);

  // Power users (7+ day streak)
  const powerUsers = byStreak.filter(u => u.currentStreak >= 7);

  // Session stats
  const totalHours = userAnalytics.reduce((sum, u) => sum + u.totalHours, 0);
  const totalSessions = allSessions.length;

  // Session duration analysis
  const sessionDurations = allSessions.map(s => s.duration);
  sessionDurations.sort((a, b) => a - b);
  const medianDuration = sessionDurations[Math.floor(sessionDurations.length / 2)];
  const avgDuration = sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;

  // Duration buckets
  const under15min = sessionDurations.filter(d => d < 900).length;
  const min15to30 = sessionDurations.filter(d => d >= 900 && d < 1800).length;
  const min30to60 = sessionDurations.filter(d => d >= 1800 && d < 3600).length;
  const over60min = sessionDurations.filter(d => d >= 3600).length;

  // Cohort analysis
  const cohorts: Record<string, UserAnalytics[]> = {};
  for (const user of userAnalytics) {
    const cohort = getCohort(user.joinDate);
    if (!cohorts[cohort]) cohorts[cohort] = [];
    cohorts[cohort].push(user);
  }

  // Time of day analysis
  const timeSlotCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const user of activeUsers) {
    const slot = user.mostCommonStudyTime as keyof typeof timeSlotCounts;
    timeSlotCounts[slot]++;
  }

  // Engagement distribution
  const sessions1to5 = userAnalytics.filter(u => u.totalSessions >= 1 && u.totalSessions <= 5).length;
  const sessions6to10 = userAnalytics.filter(u => u.totalSessions >= 6 && u.totalSessions <= 10).length;
  const sessions11to20 = userAnalytics.filter(u => u.totalSessions >= 11 && u.totalSessions <= 20).length;
  const sessions20plus = userAnalytics.filter(u => u.totalSessions > 20).length;

  // Study volume distribution (weekly hours)
  const under5hrs = activeUsers.filter(u => u.hoursPerWeek < 5).length;
  const hrs5to15 = activeUsers.filter(u => u.hoursPerWeek >= 5 && u.hoursPerWeek < 15).length;
  const hrs15to25 = activeUsers.filter(u => u.hoursPerWeek >= 15 && u.hoursPerWeek < 25).length;
  const over25hrs = activeUsers.filter(u => u.hoursPerWeek >= 25).length;

  // Daily session analysis
  const sessionsByDate: Record<string, { count: number; hours: number; users: Set<string> }> = {};
  for (const session of allSessions) {
    const dateKey = session.startTime.toDate().toISOString().split('T')[0];
    if (!sessionsByDate[dateKey]) {
      sessionsByDate[dateKey] = { count: 0, hours: 0, users: new Set() };
    }
    sessionsByDate[dateKey].count++;
    sessionsByDate[dateKey].hours += session.duration / 3600;
    sessionsByDate[dateKey].users.add(session.userId);
  }

  // Sort dates
  const sortedDates = Object.keys(sessionsByDate).sort();

  // Find peak days
  let peakDAUDate = '';
  let peakDAU = 0;
  let peakHoursDate = '';
  let peakHours = 0;

  for (const [date, data] of Object.entries(sessionsByDate)) {
    if (data.users.size > peakDAU) {
      peakDAU = data.users.size;
      peakDAUDate = date;
    }
    if (data.hours > peakHours) {
      peakHours = data.hours;
      peakHoursDate = date;
    }
  }

  // Day of week analysis
  const dayOfWeekStats: Record<string, { sessions: number; hours: number }> = {};
  for (const session of allSessions) {
    const dayName = session.startTime.toDate().toLocaleDateString('en-US', { weekday: 'long' });
    if (!dayOfWeekStats[dayName]) {
      dayOfWeekStats[dayName] = { sessions: 0, hours: 0 };
    }
    dayOfWeekStats[dayName].sessions++;
    dayOfWeekStats[dayName].hours += session.duration / 3600;
  }

  // Start generating report
  let report = `# Discord Study Bot - Analytics Deep Dive Report

**Generated:** ${now.toISOString().split('T')[0]}
**Data Period:** ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Users | ${userAnalytics.length} |
| Active Users (7 days) | ${activeUsers.length} |
| Churn Risk (7-30 days inactive) | ${churnRisk.length} |
| Churned (30+ days inactive) | ${churned.length} |
| Total Study Hours | ${totalHours.toFixed(1)}h |
| Total Sessions | ${totalSessions} |
| Avg Hours/Active User/Week | ${(activeUsers.reduce((sum, u) => sum + u.hoursPerWeek, 0) / activeUsers.length).toFixed(1)}h |
| Users with 7+ Day Streak | ${powerUsers.length} |
| 7-Day Retention Rate | ${((activeUsers.length / userAnalytics.length) * 100).toFixed(1)}% |

### Key Findings

1. **Power users are highly engaged**: ${powerUsers.length} users maintain 7+ day streaks, averaging ${powerUsers.length > 0 ? (powerUsers.reduce((sum, u) => sum + u.hoursPerWeek, 0) / powerUsers.length).toFixed(1) : 0}h/week
2. **Peak activity**: ${peakHoursDate} saw ${peakHours.toFixed(1)} total study hours
3. **Session completion**: Median session is ${formatDuration(medianDuration)}, average is ${formatDuration(avgDuration)}
4. **Study timing**: ${((timeSlotCounts.evening / activeUsers.length) * 100).toFixed(0)}% study primarily in evenings

---

## Section 1: Power User Analysis

### A. Top 3 Streak Users

`;

  // Top 3 streak users
  const top3Streak = powerUsers.slice(0, 3);
  for (let i = 0; i < top3Streak.length; i++) {
    const user = top3Streak[i];
    const firstSession = user.sessions.sort((a, b) =>
      a.createdAt.toMillis() - b.createdAt.toMillis()
    )[0];

    // Find most active day
    let mostActiveDay = 'Unknown';
    let maxDaySessions = 0;
    for (const [day, count] of Object.entries(user.sessionsPerDay)) {
      if (count > maxDaySessions) {
        maxDaySessions = count;
        mostActiveDay = day;
      }
    }

    report += `#### ${i + 1}. ${user.username}

| Metric | Value |
|--------|-------|
| User ID | \`${user.userId}\` |
| Join Date | ${user.joinDate.toISOString().split('T')[0]} |
| Total Study Hours | ${user.totalHours.toFixed(1)}h |
| Average Hours/Week | ${user.hoursPerWeek.toFixed(1)}h |
| Total Sessions | ${user.totalSessions} |
| Current Streak | 🔥 ${user.currentStreak} days |
| Longest Streak | ${user.longestStreak} days |
| Level | ${user.level} |
| XP | ${user.xp.toLocaleString()} |
| Most Active Day | ${mostActiveDay} |
| Primary Study Time | ${user.mostCommonStudyTime} |

**First Session:**
- Date: ${firstSession.createdAt.toDate().toISOString().split('T')[0]}
- Duration: ${formatDuration(firstSession.duration)}
- Activity: "${firstSession.activity || firstSession.title || 'Not specified'}"

`;
  }

  // What do power users have in common?
  report += `### Power User Patterns

`;

  if (powerUsers.length >= 2) {
    const avgPowerHours = powerUsers.reduce((sum, u) => sum + u.hoursPerWeek, 0) / powerUsers.length;
    const avgPowerSessions = powerUsers.reduce((sum, u) => sum + u.totalSessions, 0) / powerUsers.length;
    const powerTimeSlots: Record<string, number> = {};
    for (const u of powerUsers) {
      powerTimeSlots[u.mostCommonStudyTime] = (powerTimeSlots[u.mostCommonStudyTime] || 0) + 1;
    }
    const commonTimeSlot = Object.entries(powerTimeSlots).sort((a, b) => b[1] - a[1])[0];

    report += `**What the power users have in common:**

1. **High weekly volume**: Average ${avgPowerHours.toFixed(1)}h/week (vs ${(activeUsers.reduce((sum, u) => sum + u.hoursPerWeek, 0) / activeUsers.length).toFixed(1)}h for all active users)
2. **Consistent habits**: Average ${avgPowerSessions.toFixed(0)} total sessions
3. **Study time preference**: ${commonTimeSlot ? `${((commonTimeSlot[1] / powerUsers.length) * 100).toFixed(0)}% prefer ${commonTimeSlot[0]} study sessions` : 'Varied preferences'}
4. **Early adopters**: ${powerUsers.filter(u => getCohort(u.joinDate) === 'Week 1 (Nov 9-15)').length}/${powerUsers.length} joined in Week 1

`;
  }

  // Section 1B: All Active Users Table
  report += `### B. All ${activeUsers.length} Active Users

| # | Username | Join Date | Days | Sessions | Hours | hrs/wk | Last Session | Streak | Level | Study Time |
|---|----------|-----------|------|----------|-------|--------|--------------|--------|-------|------------|
`;

  const sortedActive = [...activeUsers].sort((a, b) => b.hoursPerWeek - a.hoursPerWeek);
  for (let i = 0; i < sortedActive.length; i++) {
    const u = sortedActive[i];
    report += `| ${i + 1} | ${u.username} | ${u.joinDate.toISOString().split('T')[0]} | ${u.daysSinceJoining} | ${u.totalSessions} | ${u.totalHours.toFixed(1)} | ${u.hoursPerWeek.toFixed(1)} | ${u.lastSessionDate.toISOString().split('T')[0]} | ${u.currentStreak > 0 ? '🔥' : ''}${u.currentStreak} | ${u.level} | ${u.mostCommonStudyTime} |
`;
  }

  // Cohort Analysis
  report += `
### Cohort Analysis

`;

  for (const [cohort, users] of Object.entries(cohorts)) {
    const stillActive = users.filter(u => u.lastSessionDate >= sevenDaysAgo).length;
    const avgHours = users.reduce((sum, u) => sum + u.totalHours, 0) / users.length;
    report += `**${cohort}**
- Joined: ${users.length} users
- Still Active: ${stillActive} (${((stillActive / users.length) * 100).toFixed(0)}% retention)
- Avg Total Hours: ${avgHours.toFixed(1)}h

`;
  }

  // Usage Patterns
  report += `### Usage Patterns

**Study Time Distribution (Active Users)**
| Time Slot | Users | Percentage |
|-----------|-------|------------|
| Morning (6am-12pm) | ${timeSlotCounts.morning} | ${((timeSlotCounts.morning / activeUsers.length) * 100).toFixed(0)}% |
| Afternoon (12pm-6pm) | ${timeSlotCounts.afternoon} | ${((timeSlotCounts.afternoon / activeUsers.length) * 100).toFixed(0)}% |
| Evening (6pm-10pm) | ${timeSlotCounts.evening} | ${((timeSlotCounts.evening / activeUsers.length) * 100).toFixed(0)}% |
| Night (10pm-6am) | ${timeSlotCounts.night} | ${((timeSlotCounts.night / activeUsers.length) * 100).toFixed(0)}% |

**Engagement Distribution (All Users)**
| Session Count | Users | Percentage |
|---------------|-------|------------|
| 1-5 sessions | ${sessions1to5} | ${((sessions1to5 / userAnalytics.length) * 100).toFixed(0)}% |
| 6-10 sessions | ${sessions6to10} | ${((sessions6to10 / userAnalytics.length) * 100).toFixed(0)}% |
| 11-20 sessions | ${sessions11to20} | ${((sessions11to20 / userAnalytics.length) * 100).toFixed(0)}% |
| 20+ sessions | ${sessions20plus} | ${((sessions20plus / userAnalytics.length) * 100).toFixed(0)}% |

**Weekly Study Volume (Active Users)**
| Hours/Week | Users | Percentage |
|------------|-------|------------|
| <5 hours | ${under5hrs} | ${((under5hrs / activeUsers.length) * 100).toFixed(0)}% |
| 5-15 hours | ${hrs5to15} | ${((hrs5to15 / activeUsers.length) * 100).toFixed(0)}% |
| 15-25 hours | ${hrs15to25} | ${((hrs15to25 / activeUsers.length) * 100).toFixed(0)}% |
| 25+ hours | ${over25hrs} | ${((over25hrs / activeUsers.length) * 100).toFixed(0)}% |

---

## Section 2: Retention & Churn Analysis

### A. Retention Insights

Based on your 7-day retention curve (100% → 77% → 69% → 69% → 65% → 58% → 46% → 38%):

1. **Biggest Drop-off Point**: Day 0 → Day 1 (23% drop)
   - This is the critical "aha moment" window
   - Users who don't return within 24 hours are unlikely to become regulars

2. **Secondary Drop**: Day 5 → Day 6 (12% drop)
   - End of first week is another critical point
   - Users may be trying it for a week and deciding

3. **Day 3 to Day 7 Retention**: ${((38 / 69) * 100).toFixed(0)}%
   - If a user makes it to Day 3, they have a ${((38 / 69) * 100).toFixed(0)}% chance of still being active on Day 7

### B. Churned User Analysis

`;

  // Churn analysis
  const oneAndDone = userAnalytics.filter(u => u.totalSessions === 1);
  const triedIt = userAnalytics.filter(u => u.totalSessions >= 2 && u.totalSessions <= 5);
  const wasEngaged = userAnalytics.filter(u => u.totalSessions >= 6 && u.lastSessionDate < sevenDaysAgo);

  report += `**Churn Segments**

| Segment | Count | % of Total | Avg Days Active | Avg Total Hours |
|---------|-------|------------|-----------------|-----------------|
| One-and-done (1 session) | ${oneAndDone.length} | ${((oneAndDone.length / userAnalytics.length) * 100).toFixed(0)}% | 1 | ${oneAndDone.length > 0 ? (oneAndDone.reduce((s, u) => s + u.totalHours, 0) / oneAndDone.length).toFixed(2) : 0}h |
| Tried it (2-5 sessions) | ${triedIt.length} | ${((triedIt.length / userAnalytics.length) * 100).toFixed(0)}% | ${triedIt.length > 0 ? (triedIt.reduce((s, u) => s + u.daysSinceJoining, 0) / triedIt.length).toFixed(0) : 0} | ${triedIt.length > 0 ? (triedIt.reduce((s, u) => s + u.totalHours, 0) / triedIt.length).toFixed(1) : 0}h |
| Was engaged (6+ then stopped) | ${wasEngaged.length} | ${((wasEngaged.length / userAnalytics.length) * 100).toFixed(0)}% | ${wasEngaged.length > 0 ? (wasEngaged.reduce((s, u) => s + u.daysSinceJoining, 0) / wasEngaged.length).toFixed(0) : 0} | ${wasEngaged.length > 0 ? (wasEngaged.reduce((s, u) => s + u.totalHours, 0) / wasEngaged.length).toFixed(1) : 0}h |

`;

  // Churn risk users detail
  if (churnRisk.length > 0) {
    report += `**Churn Risk Users (inactive 7-30 days)**

| Username | Last Session | Sessions | Hours | Peak Streak | Why they might have left |
|----------|--------------|----------|-------|-------------|-------------------------|
`;
    for (const u of churnRisk.slice(0, 10)) {
      const reason = u.totalSessions === 1 ? 'Never got started' :
                    u.totalSessions < 5 ? 'Didnt build habit' :
                    u.currentStreak === 0 && u.longestStreak > 3 ? 'Lost streak momentum' :
                    'Unknown';
      report += `| ${u.username} | ${u.lastSessionDate.toISOString().split('T')[0]} | ${u.totalSessions} | ${u.totalHours.toFixed(1)}h | ${u.longestStreak} | ${reason} |
`;
    }
  }

  // Section 3: Usage Patterns Over Time
  report += `
---

## Section 3: Usage Patterns Over Time

### A. Daily Activity Analysis

| Metric | Value |
|--------|-------|
| Peak DAU Day | ${peakDAUDate} (${peakDAU} users) |
| Peak Hours Day | ${peakHoursDate} (${peakHours.toFixed(1)}h) |

**Last 14 Days Activity**

| Date | DAU | Sessions | Hours |
|------|-----|----------|-------|
`;

  // Last 14 days
  const last14Days = sortedDates.slice(-14);
  for (const date of last14Days) {
    const data = sessionsByDate[date];
    if (data) {
      report += `| ${date} | ${data.users.size} | ${data.count} | ${data.hours.toFixed(1)}h |
`;
    }
  }

  // Day of week patterns
  report += `
### Day of Week Patterns

| Day | Sessions | Hours | Avg Session |
|-----|----------|-------|-------------|
`;

  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const day of dayOrder) {
    const stats = dayOfWeekStats[day] || { sessions: 0, hours: 0 };
    const avgSession = stats.sessions > 0 ? stats.hours / stats.sessions : 0;
    report += `| ${day} | ${stats.sessions} | ${stats.hours.toFixed(1)}h | ${formatDuration(avgSession * 3600)} |
`;
  }

  // Section 4: Session Analytics
  report += `
---

## Section 4: Feature Engagement

### A. Session Patterns

| Metric | Value |
|--------|-------|
| Total Sessions | ${totalSessions} |
| Average Session Length | ${formatDuration(avgDuration)} |
| Median Session Length | ${formatDuration(medianDuration)} |

**Session Duration Distribution**

| Duration | Count | Percentage |
|----------|-------|------------|
| <15 min | ${under15min} | ${((under15min / totalSessions) * 100).toFixed(0)}% |
| 15-30 min | ${min15to30} | ${((min15to30 / totalSessions) * 100).toFixed(0)}% |
| 30-60 min | ${min30to60} | ${((min30to60 / totalSessions) * 100).toFixed(0)}% |
| 60+ min | ${over60min} | ${((over60min / totalSessions) * 100).toFixed(0)}% |

### B. Level Distribution

| Level Range | Users |
|-------------|-------|
| 1-5 | ${userAnalytics.filter(u => u.level >= 1 && u.level <= 5).length} |
| 6-10 | ${userAnalytics.filter(u => u.level >= 6 && u.level <= 10).length} |
| 11-15 | ${userAnalytics.filter(u => u.level >= 11 && u.level <= 15).length} |
| 16-20 | ${userAnalytics.filter(u => u.level >= 16 && u.level <= 20).length} |
| 21+ | ${userAnalytics.filter(u => u.level >= 21).length} |

**Highest Level Users**
${byTotalHours.slice(0, 5).map((u, i) => `${i + 1}. ${u.username} - Level ${u.level} (${u.xp.toLocaleString()} XP)`).join('\n')}

---

## Section 5: Conversion Funnel

### Server to Bot Conversion

| Stage | Count | Conversion |
|-------|-------|------------|
| Discord Server Members | 260 | 100% |
| Tried the Bot (1+ session) | ${userAnalytics.length} | ${((userAnalytics.length / 260) * 100).toFixed(1)}% |
| Completed 2+ sessions | ${userAnalytics.filter(u => u.totalSessions >= 2).length} | ${((userAnalytics.filter(u => u.totalSessions >= 2).length / 260) * 100).toFixed(1)}% |
| Completed 6+ sessions | ${userAnalytics.filter(u => u.totalSessions >= 6).length} | ${((userAnalytics.filter(u => u.totalSessions >= 6).length / 260) * 100).toFixed(1)}% |
| Active Last 7 Days | ${activeUsers.length} | ${((activeUsers.length / 260) * 100).toFixed(1)}% |
| 7+ Day Streak | ${powerUsers.length} | ${((powerUsers.length / 260) * 100).toFixed(1)}% |

**Biggest Drop-off**: Discord member → First session (${((1 - userAnalytics.length / 260) * 100).toFixed(0)}% never tried)

---

## Section 6: Actionable Insights

### User Personas

`;

  // Calculate personas
  const superStudiers = activeUsers.filter(u => u.hoursPerWeek >= 20);
  const consistentTrackers = activeUsers.filter(u => u.currentStreak >= 3 && u.hoursPerWeek >= 5 && u.hoursPerWeek < 20);
  const casualUsers = activeUsers.filter(u => u.hoursPerWeek < 5);

  report += `**1. The Super Studier** (${superStudiers.length} users, ${((superStudiers.length / activeUsers.length) * 100).toFixed(0)}% of active)
- Studies 20+ hours/week
- Maintains consistent streaks
- Typically studies in ${Object.entries(timeSlotCounts).sort((a, b) => b[1] - a[1])[0][0]}
- High engagement with leaderboards
- Example: ${superStudiers[0]?.username || 'N/A'} - ${superStudiers[0]?.hoursPerWeek.toFixed(1) || 0}h/week

**2. The Consistent Tracker** (${consistentTrackers.length} users, ${((consistentTrackers.length / activeUsers.length) * 100).toFixed(0)}% of active)
- Studies 5-20 hours/week
- Maintains 3+ day streaks
- Uses bot as accountability tool
- Values the streak mechanism
- Example: ${consistentTrackers[0]?.username || 'N/A'} - ${consistentTrackers[0]?.hoursPerWeek.toFixed(1) || 0}h/week

**3. The Casual Logger** (${casualUsers.length} users, ${((casualUsers.length / activeUsers.length) * 100).toFixed(0)}% of active)
- Studies <5 hours/week
- Sporadic usage
- May not see value in tracking
- At risk of churning
- Example: ${casualUsers[0]?.username || 'N/A'} - ${casualUsers[0]?.hoursPerWeek.toFixed(1) || 0}h/week

### Biggest Opportunities

1. **Reduce Day 1 Drop-off** (Currently 23%)
   - Send a welcome message after first session
   - Celebrate first session more prominently
   - Create "Day 1 Challenge" to encourage return

2. **Convert 233 Non-Users** (90% of server)
   - Create "Study Session" events that invite participation
   - Have power users share their stats/achievements
   - Add /invite command for users to invite friends

3. **Streak Recovery System**
   - ${wasEngaged.length} users lost their streak and stopped
   - Implement "streak freeze" or "recovery" feature
   - Send "We miss you" notifications

4. **Social Features**
   - Only ${((powerUsers.length / activeUsers.length) * 100).toFixed(0)}% have strong engagement
   - Add study groups / team challenges
   - Create weekly leaderboard announcements

### Biggest Risks

1. **Heavy reliance on power users**: ${powerUsers.length} users drive ${(powerUsers.reduce((s, u) => s + u.totalHours, 0) / totalHours * 100).toFixed(0)}% of total hours
2. **High early churn**: ${oneAndDone.length} users (${((oneAndDone.length / userAnalytics.length) * 100).toFixed(0)}%) tried once and left
3. **Slow organic growth**: Only ${userAnalytics.length} of 260 server members have tried the bot
4. **Weekend vulnerability**: ${dayOfWeekStats['Saturday']?.sessions || 0} + ${dayOfWeekStats['Sunday']?.sessions || 0} weekend sessions vs ${(Object.values(dayOfWeekStats).reduce((s, d) => s + d.sessions, 0) / 7).toFixed(0)} daily average

### Hypotheses to Test

1. **"First 24 Hours"**: Users who complete 2+ sessions in their first 24 hours have 2x better Day 7 retention
   - Test: Analyze time between session 1 and 2 for retained vs churned users

2. **"Streak Stickiness"**: Users who hit a 7-day streak become permanent users
   - Test: Of users who ever hit 7-day streak, what % are still active?

3. **"Social Proof"**: Users who see others' achievements are more likely to engage
   - Test: Add prominent leaderboard visibility, measure trial conversions

4. **"Evening Dominance"**: ${((timeSlotCounts.evening / activeUsers.length) * 100).toFixed(0)}% prefer evening - is the bot optimized for this?
   - Test: Send reminder notifications in early evening

5. **"Session Length Sweet Spot"**: Is there an ideal first session length that predicts retention?
   - Test: Compare first session duration of retained vs churned users

---

## Appendix: Raw Data

### All Users by Total Hours

| Rank | Username | Hours | Sessions | Level | Streak | Last Active |
|------|----------|-------|----------|-------|--------|-------------|
`;

  for (let i = 0; i < byTotalHours.length; i++) {
    const u = byTotalHours[i];
    report += `| ${i + 1} | ${u.username} | ${u.totalHours.toFixed(1)} | ${u.totalSessions} | ${u.level} | ${u.currentStreak} | ${u.lastSessionDate.toISOString().split('T')[0]} |
`;
  }

  report += `

---

*Report generated by analytics-deep-dive.ts*
`;

  return report;
}

// Main execution
async function main() {
  try {
    const report = await generateReport();

    // Write to file
    const outputPath = path.join(__dirname, '../docs/ANALYTICS_DEEP_DIVE.md');
    fs.writeFileSync(outputPath, report);

    console.log(`\n✅ Report generated: ${outputPath}`);
    console.log('\nReport preview (first 2000 chars):\n');
    console.log(report.substring(0, 2000) + '...');

  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
