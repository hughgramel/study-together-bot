/**
 * Recalculates and restores streaks for specified users from their raw sessionsByDay data.
 * Run with --dry-run to preview without writing to Firestore.
 *
 * Usage:
 *   npx ts-node scripts/restore-streaks.ts          # preview only (dry run)
 *   npx ts-node scripts/restore-streaks.ts --apply  # actually write to Firestore
 */
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
    console.error('Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT env var or add firebase-service-account.json.');
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
const DRY_RUN = !process.argv.includes('--apply');

/**
 * Recalculate the correct current streak from sessionsByDay and goalsByDay.
 * Counts consecutive days backwards from today (UTC) that have activity.
 */
async function recalculateStreak(
  userId: string,
  sessionsByDay: Record<string, number>,
  today: Date
): Promise<number> {
  // Load goal data for this user
  const goalDoc = await db
    .collection('discord-data')
    .doc('dailyGoals')
    .collection('goals')
    .doc(userId)
    .get();

  const goalsByDay: Record<string, unknown> = goalDoc.exists
    ? (goalDoc.data()?.goalsByDay ?? {})
    : {};

  const todayKey = today.toISOString().split('T')[0];

  // Walk backwards from today, counting consecutive days with activity
  let streak = 0;
  for (let i = 0; i <= 730; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().split('T')[0];

    const hasSession = (sessionsByDay[key] ?? 0) > 0;
    const hasGoal = goalsByDay[key] !== undefined;

    if (hasSession || hasGoal) {
      streak++;
    } else {
      // No activity on this day — streak ends here
      // Exception: if i === 0 (today) and the current streak hasn't started yet,
      // allow one "grace" day in case the user is mid-session.
      // We check if yesterday has activity instead.
      if (i === 0) {
        // Today has no activity yet; that's okay — check from yesterday
        continue;
      }
      break;
    }
  }

  return streak;
}

async function run() {
  if (DRY_RUN) {
    console.log('=== DRY RUN (no changes will be written) ===');
    console.log('Run with --apply to write changes to Firestore.\n');
  } else {
    console.log('=== APPLY MODE — writing to Firestore ===\n');
  }

  // Fetch all user stats and filter by username
  const statsSnapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .get();

  const matchedUsers = statsSnapshot.docs.filter((doc) => {
    const username = (doc.data().username ?? '').toLowerCase();
    return TARGET_USERNAMES.some((t) => username.toLowerCase().includes(t.toLowerCase()));
  });

  if (matchedUsers.length === 0) {
    console.log('No matching users found. Available usernames:');
    statsSnapshot.docs.forEach((doc) => {
      console.log(' ', doc.data().username ?? doc.id);
    });
    process.exit(0);
  }

  const now = new Date();
  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);

  console.log(`UTC date: ${todayUTC.toISOString().split('T')[0]}\n`);

  for (const doc of matchedUsers) {
    const data = doc.data();
    const userId = doc.id;
    const username = data.username ?? userId;
    const storedStreak = data.currentStreak ?? 0;
    const storedLongest = data.longestStreak ?? 0;
    const sessionsByDay: Record<string, number> = data.sessionsByDay ?? {};
    const lastSessionAt: Timestamp | undefined = data.lastSessionAt;

    console.log(`${'─'.repeat(60)}`);
    console.log(`User: ${username} (${userId})`);
    console.log(`Stored streak:  current=${storedStreak}  longest=${storedLongest}`);
    if (lastSessionAt) {
      console.log(`Last session:   ${lastSessionAt.toDate().toISOString()}`);
    }

    // Show recent sessionsByDay
    const dayKeys = Object.keys(sessionsByDay).sort().reverse().slice(0, 14);
    console.log('\nRecent sessionsByDay:');
    dayKeys.forEach((k) => console.log(`  ${k}: ${sessionsByDay[k]} session(s)`));

    // Recalculate correct streak
    const correctStreak = await recalculateStreak(userId, sessionsByDay, todayUTC);
    const correctLongest = Math.max(correctStreak, storedLongest);

    console.log(`\nRecalculated streak: ${correctStreak}`);
    console.log(`Longest will be:     ${correctLongest}`);

    if (correctStreak === storedStreak) {
      console.log('-> No change needed.\n');
      continue;
    }

    console.log(`-> Would update: currentStreak ${storedStreak} -> ${correctStreak}`);
    if (correctLongest !== storedLongest) {
      console.log(`-> Would update: longestStreak ${storedLongest} -> ${correctLongest}`);
    }

    if (!DRY_RUN) {
      await doc.ref.update({
        currentStreak: correctStreak,
        longestStreak: correctLongest,
      });
      console.log('-> Written to Firestore.');
    }

    console.log('');
  }

  if (DRY_RUN) {
    console.log('\nRe-run with --apply to write these changes.');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
