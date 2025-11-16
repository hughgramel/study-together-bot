/**
 * Verify XP and Badges Reset
 *
 * This script verifies that the reset was applied correctly by:
 * 1. Checking that all users have 0 achievements
 * 2. Verifying XP matches the formula: totalDuration (in hours) * 10
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
 * Calculate expected XP based on total duration with 1x multiplier
 * Formula: 10 XP per hour
 */
function calculateExpectedXP(durationSeconds: number): number {
  const hours = durationSeconds / 3600;
  return Math.floor(hours * 10);
}

async function verifyReset() {
  console.log('🔍 Verifying XP and Badge reset...\n');

  try {
    // Fetch all user stats
    const statsSnapshot = await db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .get();

    if (statsSnapshot.empty) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`📊 Checking ${statsSnapshot.size} users...\n`);

    let allCorrect = true;
    let badgesCleared = 0;
    let xpCorrect = 0;
    let xpIncorrect = 0;

    // Process each user
    for (const doc of statsSnapshot.docs) {
      const userId = doc.id;
      const stats = doc.data();

      const totalDuration = stats.totalDuration || 0;
      const username = stats.username || 'Unknown';
      const currentXP = stats.xp || 0;
      const achievements = stats.achievements || [];
      const achievementsUnlockedAt = stats.achievementsUnlockedAt || {};

      // Calculate expected XP
      const expectedXP = calculateExpectedXP(totalDuration);

      // Check achievements are cleared
      const badgesCorrect = achievements.length === 0 && Object.keys(achievementsUnlockedAt).length === 0;

      if (badgesCorrect) {
        badgesCleared++;
      }

      // Check XP is correct
      const xpMatches = currentXP === expectedXP;

      if (xpMatches) {
        xpCorrect++;
      } else {
        xpIncorrect++;
        allCorrect = false;
      }

      // Log status
      const badgeStatus = badgesCorrect ? '✅' : '❌';
      const xpStatus = xpMatches ? '✅' : '❌';
      const hours = (totalDuration / 3600).toFixed(2);

      if (!badgesCorrect || !xpMatches) {
        console.log(`${badgeStatus} ${xpStatus} ${username} (${userId}):`);
        console.log(`   Hours: ${hours}h`);
        console.log(`   XP: ${currentXP} (expected: ${expectedXP})`);
        console.log(`   Achievements: ${achievements.length} (expected: 0)`);
        console.log(`   Unlock timestamps: ${Object.keys(achievementsUnlockedAt).length} (expected: 0)`);
        console.log();
      }
    }

    console.log('📋 Verification Summary:');
    console.log(`✅ Badges cleared correctly: ${badgesCleared}/${statsSnapshot.size} users`);
    console.log(`✅ XP calculated correctly: ${xpCorrect}/${statsSnapshot.size} users`);
    if (xpIncorrect > 0) {
      console.log(`❌ XP incorrect: ${xpIncorrect}/${statsSnapshot.size} users`);
    }

    if (allCorrect && badgesCleared === statsSnapshot.size) {
      console.log('\n✨ All users verified successfully! Reset is correct.');
    } else {
      console.log('\n⚠️  Some issues found. Please review the output above.');
    }
  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  }
}

// Run the script
verifyReset()
  .then(() => {
    console.log('\n👋 Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });
