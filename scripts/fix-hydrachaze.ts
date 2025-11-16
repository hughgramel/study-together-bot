/**
 * Fix Hydrachaze's XP and Total Duration
 *
 * This script:
 * 1. Fetches all completed sessions for hydrachaze
 * 2. Sums up the actual session durations
 * 3. Updates totalDuration in their stats
 * 4. Recalculates XP based on corrected hours (10 XP per hour)
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

const HYDRACHAZE_USER_ID = '441785661503176724';

/**
 * Calculate XP based on total duration with 1x multiplier
 * Formula: 10 XP per hour
 */
function calculateXPFromDuration(durationSeconds: number): number {
  const hours = durationSeconds / 3600;
  return Math.floor(hours * 10);
}

async function fixHydrachaze() {
  console.log('🔧 Fixing hydrachaze\'s XP and total duration...\n');

  try {
    // Fetch all completed sessions for hydrachaze
    const sessionsSnapshot = await db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('userId', '==', HYDRACHAZE_USER_ID)
      .get();

    if (sessionsSnapshot.empty) {
      console.log('❌ No completed sessions found for hydrachaze');
      return;
    }

    console.log(`📊 Found ${sessionsSnapshot.size} completed sessions\n`);

    // Sum up all session durations
    let totalDuration = 0;

    console.log('Session breakdown:');
    sessionsSnapshot.docs.forEach((doc, index) => {
      const session = doc.data();
      const duration = session.duration || 0;
      const hours = (duration / 3600).toFixed(2);
      console.log(`  ${index + 1}. ${session.activity || 'Unknown'}: ${hours}h (${duration}s)`);
      totalDuration += duration;
    });

    const totalHours = (totalDuration / 3600).toFixed(2);
    console.log(`\n📈 Total duration from sessions: ${totalHours}h (${totalDuration}s)`);

    // Calculate new XP
    const newXP = calculateXPFromDuration(totalDuration);
    console.log(`💎 Calculated XP: ${newXP} XP\n`);

    // Get current stats
    const statsRef = db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(HYDRACHAZE_USER_ID);

    const statsDoc = await statsRef.get();

    if (!statsDoc.exists) {
      console.log('❌ Stats document not found for hydrachaze');
      return;
    }

    const currentStats = statsDoc.data();
    const oldDuration = currentStats?.totalDuration || 0;
    const oldXP = currentStats?.xp || 0;
    const oldHours = (oldDuration / 3600).toFixed(2);

    console.log('Current stats:');
    console.log(`  Total duration: ${oldHours}h (${oldDuration}s)`);
    console.log(`  XP: ${oldXP}\n`);

    // Update stats
    await statsRef.update({
      totalDuration: totalDuration,
      xp: newXP,
    });

    console.log('✅ Updated stats:');
    console.log(`  Total duration: ${oldHours}h → ${totalHours}h`);
    console.log(`  XP: ${oldXP} → ${newXP}`);
    console.log('\n✨ Fix complete!');

  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  }
}

// Run the script
fixHydrachaze()
  .then(() => {
    console.log('\n👋 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
