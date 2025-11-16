import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let serviceAccount: admin.ServiceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', error);
    process.exit(1);
  }
} else {
  const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Firebase service account file not found');
    process.exit(1);
  }
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
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

// Convert UTC timestamp to Pacific Time date string (YYYY-MM-DD)
function toPacificDateString(date: Date): string {
  const pacificDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const year = pacificDate.getFullYear();
  const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
  const day = String(pacificDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function analyzeChurn() {
  console.log('📊 Analyzing Churn and Retention Metrics...\n');

  // Fetch all completed sessions
  const sessionsSnapshot = await db
    .collection('discord-data')
    .doc('sessions')
    .collection('completed')
    .orderBy('startTime', 'asc')
    .get();

  console.log(`Total sessions: ${sessionsSnapshot.size}\n`);

  // Map userId to their active days
  const userActivityByDay = new Map<string, Set<string>>();
  const userFirstDay = new Map<string, string>();
  const userLastDay = new Map<string, string>();
  const allDays = new Set<string>();

  sessionsSnapshot.forEach((doc) => {
    const session = doc.data() as SessionData;
    const dateKey = toPacificDateString(session.startTime.toDate());
    const userId = session.userId;

    allDays.add(dateKey);

    if (!userActivityByDay.has(userId)) {
      userActivityByDay.set(userId, new Set());
      userFirstDay.set(userId, dateKey);
    }

    userActivityByDay.get(userId)!.add(dateKey);
    userLastDay.set(userId, dateKey);
  });

  const sortedDays = Array.from(allDays).sort();
  const totalUsers = userActivityByDay.size;

  console.log(`📅 Date Range: ${sortedDays[0]} to ${sortedDays[sortedDays.length - 1]}`);
  console.log(`👥 Total Unique Users: ${totalUsers}\n`);

  // Calculate retention metrics
  console.log('📈 RETENTION METRICS:\n');

  // Day-over-day retention
  const activeUsersByDay = new Map<string, Set<string>>();
  sortedDays.forEach(day => {
    activeUsersByDay.set(day, new Set());
  });

  userActivityByDay.forEach((days, userId) => {
    days.forEach(day => {
      activeUsersByDay.get(day)!.add(userId);
    });
  });

  console.log('Daily Active Users (DAU):');
  sortedDays.forEach(day => {
    const count = activeUsersByDay.get(day)!.size;
    console.log(`  ${day}: ${count} users`);
  });

  // Calculate retention for each day
  console.log('\n📊 Day-over-Day Retention:');
  for (let i = 0; i < sortedDays.length - 1; i++) {
    const today = sortedDays[i];
    const tomorrow = sortedDays[i + 1];

    const todayUsers = activeUsersByDay.get(today)!;
    const tomorrowUsers = activeUsersByDay.get(tomorrow)!;

    const retained = Array.from(todayUsers).filter(u => tomorrowUsers.has(u)).length;
    const retentionRate = todayUsers.size > 0 ? (retained / todayUsers.size * 100) : 0;

    console.log(`  ${today} → ${tomorrow}: ${retained}/${todayUsers.size} users retained (${retentionRate.toFixed(1)}%)`);
  }

  // Calculate churn
  console.log('\n📉 CHURN ANALYSIS:\n');

  const latestDay = sortedDays[sortedDays.length - 1];
  const activeToday = activeUsersByDay.get(latestDay)!;
  const inactiveUsers = totalUsers - activeToday.size;

  console.log(`Active Today (${latestDay}): ${activeToday.size} users`);
  console.log(`Inactive Today: ${inactiveUsers} users`);
  console.log(`Overall Churn Rate: ${(inactiveUsers / totalUsers * 100).toFixed(1)}%\n`);

  // Analyze churned users
  const churnedUsers: Array<{ userId: string; firstDay: string; lastDay: string; daysActive: number }> = [];

  userActivityByDay.forEach((days, userId) => {
    if (!activeToday.has(userId)) {
      churnedUsers.push({
        userId,
        firstDay: userFirstDay.get(userId)!,
        lastDay: userLastDay.get(userId)!,
        daysActive: days.size,
      });
    }
  });

  if (churnedUsers.length > 0) {
    console.log(`Churned Users Breakdown:`);
    churnedUsers.forEach(user => {
      console.log(`  - User ${user.userId.slice(0, 8)}...: Joined ${user.firstDay}, Last seen ${user.lastDay}, Active ${user.daysActive} day(s)`);
    });
  } else {
    console.log('🎉 No churned users! All users were active today!');
  }

  // Multi-day retention
  console.log('\n📅 Multi-Day Retention Analysis:\n');

  // Day 1 retention (users who came back the day after joining)
  let day1RetentionCount = 0;
  let day1CohortSize = 0;

  userActivityByDay.forEach((days, userId) => {
    const firstDay = userFirstDay.get(userId)!;
    const firstDayIndex = sortedDays.indexOf(firstDay);

    // Skip if they joined on the last day (can't measure next day retention)
    if (firstDayIndex >= sortedDays.length - 1) return;

    day1CohortSize++;
    const nextDay = sortedDays[firstDayIndex + 1];

    if (days.has(nextDay)) {
      day1RetentionCount++;
    }
  });

  if (day1CohortSize > 0) {
    console.log(`Day 1 Retention: ${day1RetentionCount}/${day1CohortSize} users (${(day1RetentionCount / day1CohortSize * 100).toFixed(1)}%)`);
  }

  // Overall retention (users who came back at least once after joining)
  let returnedUsers = 0;
  userActivityByDay.forEach((days, userId) => {
    if (days.size > 1) {
      returnedUsers++;
    }
  });

  console.log(`Multi-Day Users: ${returnedUsers}/${totalUsers} users (${(returnedUsers / totalUsers * 100).toFixed(1)}%)`);
  console.log(`Single-Day Users: ${totalUsers - returnedUsers}/${totalUsers} users (${((totalUsers - returnedUsers) / totalUsers * 100).toFixed(1)}%)`);

  // Engagement tiers
  console.log('\n🏆 User Engagement Tiers:\n');

  const engagementTiers = {
    'Power Users (5+ days)': 0,
    'Regular Users (3-4 days)': 0,
    'Casual Users (2 days)': 0,
    'One-time Users (1 day)': 0,
  };

  userActivityByDay.forEach((days) => {
    const dayCount = days.size;
    if (dayCount >= 5) engagementTiers['Power Users (5+ days)']++;
    else if (dayCount >= 3) engagementTiers['Regular Users (3-4 days)']++;
    else if (dayCount === 2) engagementTiers['Casual Users (2 days)']++;
    else engagementTiers['One-time Users (1 day)']++;
  });

  Object.entries(engagementTiers).forEach(([tier, count]) => {
    const percentage = (count / totalUsers * 100).toFixed(1);
    console.log(`  ${tier}: ${count} users (${percentage}%)`);
  });

  console.log('\n✅ Analysis complete!');
  process.exit(0);
}

analyzeChurn().catch((error) => {
  console.error('Error analyzing churn:', error);
  process.exit(1);
});
