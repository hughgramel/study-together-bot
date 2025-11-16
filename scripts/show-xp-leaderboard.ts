/**
 * Show XP Leaderboard
 *
 * This script displays all users sorted by XP
 */

import * as admin from 'firebase-admin';
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

/**
 * Calculate level from XP (using correct formula)
 */
function calculateLevel(xp: number): number {
  if (xp < 283) return 1;
  const level = Math.round(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level));
}

async function showLeaderboard() {
  console.log('🏆 XP Leaderboard\n');

  try {
    // Fetch all user stats ordered by XP
    const statsSnapshot = await db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .orderBy('xp', 'desc')
      .get();

    if (statsSnapshot.empty) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`Rank | Username                    | XP     | Level | Hours  | Sessions`);
    console.log(`-----|----------------------------|--------|-------|--------|----------`);

    statsSnapshot.docs.forEach((doc, index) => {
      const stats = doc.data();
      const username = stats.username || 'Unknown';
      const xp = stats.xp || 0;
      const level = calculateLevel(xp);
      const hours = ((stats.totalDuration || 0) / 3600).toFixed(2);
      const sessions = stats.totalSessions || 0;

      const rank = `${index + 1}`.padStart(4);
      const usernamePadded = username.padEnd(26).substring(0, 26);
      const xpPadded = `${xp}`.padStart(6);
      const levelPadded = `${level}`.padStart(5);
      const hoursPadded = `${hours}h`.padStart(6);
      const sessionsPadded = `${sessions}`.padStart(8);

      console.log(`${rank} | ${usernamePadded} | ${xpPadded} | ${levelPadded} | ${hoursPadded} | ${sessionsPadded}`);
    });

    console.log(`\n📊 Total users: ${statsSnapshot.size}`);

  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    throw error;
  }
}

// Run the script
showLeaderboard()
  .then(() => {
    console.log('\n👋 Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
