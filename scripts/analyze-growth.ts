import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let serviceAccount: admin.ServiceAccount;

// Check if running in production with environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Loaded Firebase credentials from environment variable');
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', error);
    process.exit(1);
  }
} else {
  // Local development - load from file
  const serviceAccountPath = path.join(
    __dirname,
    '../firebase-service-account.json'
  );

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Firebase service account file not found and FIREBASE_SERVICE_ACCOUNT env var not set');
    console.error('Please set FIREBASE_SERVICE_ACCOUNT environment variable or provide firebase-service-account.json');
    process.exit(1);
  }

  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log('✅ Loaded Firebase credentials from local file');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

interface SessionData {
  userId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration: number;
}

interface MonthlyMetrics {
  month: string;
  uniqueUsers: number;
  totalSessions: number;
  totalHours: number;
  uniquePosters: number;
  totalPosts: number;
  cumulativeUsers: Set<string>;
}

interface WeeklyMetrics {
  week: string;
  uniqueUsers: number;
  totalSessions: number;
  totalHours: number;
  uniquePosters: number;
  totalPosts: number;
  cumulativeUsers: Set<string>;
}

interface DailyMetrics {
  date: string;
  uniqueUsers: number;
  totalSessions: number;
  totalHours: number;
  uniquePosters: number;
  totalPosts: number;
  cumulativeUsers: Set<string>;
}

function getWeekKey(date: Date): string {
  // Get ISO week number
  const tempDate = new Date(date.valueOf());
  const dayNum = (tempDate.getDay() + 6) % 7;
  tempDate.setDate(tempDate.getDate() - dayNum + 3);
  const firstThursday = tempDate.valueOf();
  tempDate.setMonth(0, 1);
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - tempDate.valueOf()) / 604800000);
  return `${tempDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function analyzeGrowth() {
  console.log('Analyzing Discord bot growth metrics...\n');

  // Fetch all completed sessions
  const sessionsSnapshot = await db
    .collection('discord-data')
    .doc('sessions')
    .collection('completed')
    .orderBy('startTime', 'asc')
    .get();

  console.log(`Total completed sessions: ${sessionsSnapshot.size}`);

  // Fetch all posts from feed
  const postsSnapshot = await db
    .collection('discord-data')
    .doc('sessionPosts')
    .collection('posts')
    .orderBy('postedAt', 'asc')
    .get();

  console.log(`Total posts: ${postsSnapshot.size}`);

  // Get date range
  if (sessionsSnapshot.empty) {
    console.log('No sessions found!');
    return;
  }

  const firstSession = sessionsSnapshot.docs[0].data() as SessionData;
  const lastSession = sessionsSnapshot.docs[sessionsSnapshot.size - 1].data() as SessionData;
  const firstDate = firstSession.startTime.toDate();
  const lastDate = lastSession.startTime.toDate();

  const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  console.log(`Date range: ${firstDate.toLocaleDateString()} - ${lastDate.toLocaleDateString()} (${daysDiff} days)\n`);

  // Process sessions by month
  const monthlyData = new Map<string, MonthlyMetrics>();
  const allTimeUsers = new Set<string>();

  sessionsSnapshot.forEach((doc) => {
    const session = doc.data() as SessionData;
    const date = session.startTime.toDate();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        month: monthKey,
        uniqueUsers: 0,
        totalSessions: 0,
        totalHours: 0,
        uniquePosters: 0,
        totalPosts: 0,
        cumulativeUsers: new Set(allTimeUsers),
      });
    }

    const metrics = monthlyData.get(monthKey)!;
    metrics.totalSessions++;
    metrics.totalHours += session.duration / 3600; // Convert seconds to hours
    allTimeUsers.add(session.userId);
    metrics.cumulativeUsers.add(session.userId);
  });

  // Count unique users per month for sessions
  const monthlyUsers = new Map<string, Set<string>>();
  sessionsSnapshot.forEach((doc) => {
    const session = doc.data() as SessionData;
    const date = session.startTime.toDate();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyUsers.has(monthKey)) {
      monthlyUsers.set(monthKey, new Set());
    }
    monthlyUsers.get(monthKey)!.add(session.userId);
  });

  // Update unique users count
  monthlyUsers.forEach((users, month) => {
    if (monthlyData.has(month)) {
      monthlyData.get(month)!.uniqueUsers = users.size;
    }
  });

  // Process posts by month
  const monthlyPosters = new Map<string, Set<string>>();
  const monthlyPostCounts = new Map<string, number>();

  postsSnapshot.forEach((doc) => {
    const post = doc.data();
    const date = post.postedAt.toDate();
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyPosters.has(monthKey)) {
      monthlyPosters.set(monthKey, new Set());
      monthlyPostCounts.set(monthKey, 0);
    }

    monthlyPosters.get(monthKey)!.add(post.userId);
    monthlyPostCounts.set(monthKey, (monthlyPostCounts.get(monthKey) || 0) + 1);
  });

  // Update post metrics
  monthlyPosters.forEach((posters, month) => {
    if (monthlyData.has(month)) {
      monthlyData.get(month)!.uniquePosters = posters.size;
      monthlyData.get(month)!.totalPosts = monthlyPostCounts.get(month) || 0;
    } else {
      // Month with posts but no sessions
      monthlyData.set(month, {
        month,
        uniqueUsers: 0,
        totalSessions: 0,
        totalHours: 0,
        uniquePosters: posters.size,
        totalPosts: monthlyPostCounts.get(month) || 0,
        cumulativeUsers: new Set(),
      });
    }
  });

  // Sort by month
  const sortedMonths = Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  // Print table header
  console.log('┌────────────┬────────────┬────────────────┬──────────┬────────────┬───────────────┬────────────┐');
  console.log('│   Month    │  New Users │ Cumulative     │ Sessions │    Hours   │ Unique        │   Posts    │');
  console.log('│            │            │ Total Users    │          │            │ Posters       │            │');
  console.log('├────────────┼────────────┼────────────────┼──────────┼────────────┼───────────────┼────────────┤');

  let totalUsers = new Set<string>();
  sortedMonths.forEach(([month, metrics]) => {
    const previousTotal = totalUsers.size;
    metrics.cumulativeUsers.forEach(user => totalUsers.add(user));
    const newUsers = totalUsers.size - previousTotal;

    console.log(
      `│ ${month.padEnd(10)} │ ${String(newUsers).padStart(10)} │ ${String(totalUsers.size).padStart(14)} │ ${String(metrics.totalSessions).padStart(8)} │ ${metrics.totalHours.toFixed(1).padStart(10)} │ ${String(metrics.uniquePosters).padStart(13)} │ ${String(metrics.totalPosts).padStart(10)} │`
    );
  });

  console.log('└────────────┴────────────┴────────────────┴──────────┴────────────┴───────────────┴────────────┘');

  // If data spans less than 60 days, show weekly breakdown
  if (daysDiff < 60) {
    console.log('\n📅 Weekly Breakdown:\n');

    // Process sessions by week
    const weeklyData = new Map<string, WeeklyMetrics>();
    const weeklyUsersSet = new Map<string, Set<string>>();

    sessionsSnapshot.forEach((doc) => {
      const session = doc.data() as SessionData;
      const date = session.startTime.toDate();
      const weekKey = getWeekKey(date);

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          week: weekKey,
          uniqueUsers: 0,
          totalSessions: 0,
          totalHours: 0,
          uniquePosters: 0,
          totalPosts: 0,
          cumulativeUsers: new Set(allTimeUsers),
        });
        weeklyUsersSet.set(weekKey, new Set());
      }

      const metrics = weeklyData.get(weekKey)!;
      metrics.totalSessions++;
      metrics.totalHours += session.duration / 3600;
      weeklyUsersSet.get(weekKey)!.add(session.userId);
    });

    // Update unique users count
    weeklyUsersSet.forEach((users, week) => {
      if (weeklyData.has(week)) {
        weeklyData.get(week)!.uniqueUsers = users.size;
      }
    });

    // Process posts by week
    const weeklyPosters = new Map<string, Set<string>>();
    const weeklyPostCounts = new Map<string, number>();

    postsSnapshot.forEach((doc) => {
      const post = doc.data();
      const date = post.postedAt.toDate();
      const weekKey = getWeekKey(date);

      if (!weeklyPosters.has(weekKey)) {
        weeklyPosters.set(weekKey, new Set());
        weeklyPostCounts.set(weekKey, 0);
      }

      weeklyPosters.get(weekKey)!.add(post.userId);
      weeklyPostCounts.set(weekKey, (weeklyPostCounts.get(weekKey) || 0) + 1);
    });

    // Update post metrics
    weeklyPosters.forEach((posters, week) => {
      if (weeklyData.has(week)) {
        weeklyData.get(week)!.uniquePosters = posters.size;
        weeklyData.get(week)!.totalPosts = weeklyPostCounts.get(week) || 0;
      }
    });

    // Sort by week
    const sortedWeeks = Array.from(weeklyData.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    // Print weekly table
    console.log('┌────────────┬────────────┬────────────────┬──────────┬────────────┬───────────────┬────────────┐');
    console.log('│    Week    │  New Users │ Cumulative     │ Sessions │    Hours   │ Unique        │   Posts    │');
    console.log('│            │            │ Total Users    │          │            │ Posters       │            │');
    console.log('├────────────┼────────────┼────────────────┼──────────┼────────────┼───────────────┼────────────┤');

    let weeklyTotalUsers = new Set<string>();
    sortedWeeks.forEach(([week, metrics]) => {
      const previousTotal = weeklyTotalUsers.size;
      weeklyUsersSet.get(week)!.forEach(user => weeklyTotalUsers.add(user));
      const newUsers = weeklyTotalUsers.size - previousTotal;

      console.log(
        `│ ${week.padEnd(10)} │ ${String(newUsers).padStart(10)} │ ${String(weeklyTotalUsers.size).padStart(14)} │ ${String(metrics.totalSessions).padStart(8)} │ ${metrics.totalHours.toFixed(1).padStart(10)} │ ${String(metrics.uniquePosters).padStart(13)} │ ${String(metrics.totalPosts).padStart(10)} │`
      );
    });

    console.log('└────────────┴────────────┴────────────────┴──────────┴────────────┴───────────────┴────────────┘');
  }

  // If data spans less than 14 days, show daily breakdown
  if (daysDiff < 14) {
    console.log('\n📆 Daily Breakdown:\n');

    // Process sessions by day
    const dailyData = new Map<string, DailyMetrics>();
    const dailyUsersSet = new Map<string, Set<string>>();

    sessionsSnapshot.forEach((doc) => {
      const session = doc.data() as SessionData;
      const date = session.startTime.toDate();
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          date: dateKey,
          uniqueUsers: 0,
          totalSessions: 0,
          totalHours: 0,
          uniquePosters: 0,
          totalPosts: 0,
          cumulativeUsers: new Set(allTimeUsers),
        });
        dailyUsersSet.set(dateKey, new Set());
      }

      const metrics = dailyData.get(dateKey)!;
      metrics.totalSessions++;
      metrics.totalHours += session.duration / 3600;
      dailyUsersSet.get(dateKey)!.add(session.userId);
    });

    // Update unique users count
    dailyUsersSet.forEach((users, day) => {
      if (dailyData.has(day)) {
        dailyData.get(day)!.uniqueUsers = users.size;
      }
    });

    // Process posts by day
    const dailyPosters = new Map<string, Set<string>>();
    const dailyPostCounts = new Map<string, number>();

    postsSnapshot.forEach((doc) => {
      const post = doc.data();
      const date = post.postedAt.toDate();
      const dateKey = date.toISOString().split('T')[0];

      if (!dailyPosters.has(dateKey)) {
        dailyPosters.set(dateKey, new Set());
        dailyPostCounts.set(dateKey, 0);
      }

      dailyPosters.get(dateKey)!.add(post.userId);
      dailyPostCounts.set(dateKey, (dailyPostCounts.get(dateKey) || 0) + 1);
    });

    // Update post metrics
    dailyPosters.forEach((posters, day) => {
      if (dailyData.has(day)) {
        dailyData.get(day)!.uniquePosters = posters.size;
        dailyData.get(day)!.totalPosts = dailyPostCounts.get(day) || 0;
      }
    });

    // Sort by date
    const sortedDays = Array.from(dailyData.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    // Print daily table
    console.log('┌────────────┬────────────┬────────────────┬──────────┬────────────┬───────────────┬────────────┐');
    console.log('│    Date    │  New Users │ Cumulative     │ Sessions │    Hours   │ Unique        │   Posts    │');
    console.log('│            │            │ Total Users    │          │            │ Posters       │            │');
    console.log('├────────────┼────────────┼────────────────┼──────────┼────────────┼───────────────┼────────────┤');

    let dailyTotalUsers = new Set<string>();
    sortedDays.forEach(([day, metrics]) => {
      const previousTotal = dailyTotalUsers.size;
      dailyUsersSet.get(day)!.forEach(user => dailyTotalUsers.add(user));
      const newUsers = dailyTotalUsers.size - previousTotal;

      console.log(
        `│ ${day.padEnd(10)} │ ${String(newUsers).padStart(10)} │ ${String(dailyTotalUsers.size).padStart(14)} │ ${String(metrics.totalSessions).padStart(8)} │ ${metrics.totalHours.toFixed(1).padStart(10)} │ ${String(metrics.uniquePosters).padStart(13)} │ ${String(metrics.totalPosts).padStart(10)} │`
      );
    });

    console.log('└────────────┴────────────┴────────────────┴──────────┴────────────┴───────────────┴────────────┘');
  }

  // Summary statistics
  console.log('\n📊 Summary Statistics:');
  console.log(`Total Unique Users (All Time): ${totalUsers.size}`);
  console.log(`Total Sessions: ${sessionsSnapshot.size}`);
  console.log(`Total Posts: ${postsSnapshot.size}`);

  const totalHours = Array.from(monthlyData.values())
    .reduce((sum, m) => sum + m.totalHours, 0);
  console.log(`Total Hours Logged: ${totalHours.toFixed(1)}`);

  const allPosters = new Set<string>();
  postsSnapshot.forEach((doc) => {
    allPosters.add(doc.data().userId);
  });
  console.log(`Total Unique Posters: ${allPosters.size}`);

  // Growth rate analysis
  if (sortedMonths.length > 1) {
    console.log('\n📈 Growth Analysis:');
    const firstMonth = sortedMonths[0][1];
    const lastMonth = sortedMonths[sortedMonths.length - 1][1];

    console.log(`First Month (${sortedMonths[0][0]}): ${firstMonth.uniqueUsers} users, ${firstMonth.totalHours.toFixed(1)} hours`);
    console.log(`Latest Month (${sortedMonths[sortedMonths.length - 1][0]}): ${lastMonth.uniqueUsers} users, ${lastMonth.totalHours.toFixed(1)} hours`);

    if (sortedMonths.length >= 2) {
      const avgUsersPerMonth = totalUsers.size / sortedMonths.length;
      const avgHoursPerMonth = totalHours / sortedMonths.length;
      const avgSessionsPerMonth = sessionsSnapshot.size / sortedMonths.length;

      console.log(`\nAverages per Month:`);
      console.log(`  - Users: ${avgUsersPerMonth.toFixed(1)}`);
      console.log(`  - Hours: ${avgHoursPerMonth.toFixed(1)}`);
      console.log(`  - Sessions: ${avgSessionsPerMonth.toFixed(1)}`);
    }
  }

  process.exit(0);
}

analyzeGrowth().catch((error) => {
  console.error('Error analyzing growth:', error);
  process.exit(1);
});
