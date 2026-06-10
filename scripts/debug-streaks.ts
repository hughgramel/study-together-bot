import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

let serviceAccount: admin.ServiceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('Firebase service account not found.');
    process.exit(1);
  }
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

const TARGET_USERNAMES = ['milkbread', 'cheromy', 'navneeth'];

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

function isYesterday(d1: Date, d2: Date): boolean {
  const d1PlusOne = new Date(d1);
  d1PlusOne.setUTCDate(d1PlusOne.getUTCDate() + 1);
  return (
    d1PlusOne.getUTCFullYear() === d2.getUTCFullYear() &&
    d1PlusOne.getUTCMonth() === d2.getUTCMonth() &&
    d1PlusOne.getUTCDate() === d2.getUTCDate()
  );
}

async function run() {
  // Fetch all user stats and filter by username
  const statsSnapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .get();

  const matchedUsers = statsSnapshot.docs.filter((doc) => {
    const data = doc.data();
    const username = (data.username ?? '').toLowerCase();
    return TARGET_USERNAMES.some((t) => username.includes(t.toLowerCase()));
  });

  if (matchedUsers.length === 0) {
    console.log('No matching users found. Dumping all usernames for reference:');
    statsSnapshot.docs.forEach((doc) => {
      console.log(' ', doc.data().username ?? doc.id);
    });
    process.exit(0);
  }

  const now = new Date();
  console.log(`Current UTC time: ${now.toISOString()}\n`);

  for (const doc of matchedUsers) {
    const data = doc.data();
    const userId = doc.id;
    const username = data.username ?? userId;
    const currentStreak = data.currentStreak ?? 0;
    const longestStreak = data.longestStreak ?? 0;
    const lastSessionAt: Timestamp | undefined = data.lastSessionAt;
    const sessionsByDay: Record<string, number> = data.sessionsByDay ?? {};

    console.log(`\n${'='.repeat(60)}`);
    console.log(`User: ${username} (${userId})`);
    console.log(`Current streak: ${currentStreak}  |  Longest streak: ${longestStreak}`);

    if (lastSessionAt) {
      const lastDate = lastSessionAt.toDate();
      console.log(`Last session at: ${lastDate.toISOString()}`);

      const sameDay = isSameDay(lastDate, now);
      const yesterday = isYesterday(lastDate, now);

      if (sameDay) {
        console.log(`  -> Last session was TODAY (UTC) - streak should be maintained`);
      } else if (yesterday) {
        console.log(`  -> Last session was YESTERDAY (UTC) - streak should have incremented on next session`);
      } else {
        const diffMs = now.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        console.log(`  -> Last session was ${diffDays} day(s) ago - STREAK BROKEN (gap > 1 day)`);
      }
    } else {
      console.log('Last session at: (none)');
    }

    // Show sessionsByDay sorted descending (most recent first)
    const dayKeys = Object.keys(sessionsByDay).sort().reverse();
    console.log(`\nSession history (sessionsByDay) - ${dayKeys.length} days recorded:`);
    if (dayKeys.length === 0) {
      console.log('  (no sessions recorded in sessionsByDay)');
    } else {
      dayKeys.slice(0, 30).forEach((key) => {
        console.log(`  ${key}: ${sessionsByDay[key]} session(s)`);
      });
      if (dayKeys.length > 30) {
        console.log(`  ... and ${dayKeys.length - 30} more days`);
      }
    }

    // Check for gaps in recent history
    console.log('\nGap analysis (last 14 days):');
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    let consecutiveDays = 0;
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setUTCDate(checkDate.getUTCDate() - i);
      const key = checkDate.toISOString().split('T')[0];
      const hasSessions = (sessionsByDay[key] ?? 0) > 0;
      console.log(`  ${key}: ${hasSessions ? `${sessionsByDay[key]} session(s)` : 'NO ACTIVITY'}`);
      if (i === 0 && hasSessions) consecutiveDays++;
      else if (i > 0 && hasSessions && consecutiveDays === i) consecutiveDays++;
    }

    // Fetch recent completed sessions for this user
    const recentSessions = await db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    console.log(`\nRecent completed sessions (last ${recentSessions.size}):`);
    if (recentSessions.empty) {
      console.log('  (none found)');
    } else {
      recentSessions.docs.forEach((sDoc) => {
        const s = sDoc.data();
        const createdAt = s.createdAt?.toDate().toISOString() ?? 'unknown';
        const duration = s.duration ? `${Math.round(s.duration / 60)}min` : '?';
        console.log(`  ${createdAt}  duration=${duration}  activity=${s.activity ?? 'unknown'}`);
      });
    }

    // Check daily goals
    const goalDoc = await db
      .collection('discord-data')
      .doc('dailyGoals')
      .collection('goals')
      .doc(userId)
      .get();

    if (goalDoc.exists) {
      const goalData = goalDoc.data()!;
      console.log(`\nDaily goal: target=${goalData.targetMinutes}min`);
      if (goalData.lastGoalSetAt) {
        console.log(`  lastGoalSetAt: ${goalData.lastGoalSetAt.toDate().toISOString()}`);
      }
    } else {
      console.log('\nNo daily goal set.');
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
