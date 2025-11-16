/**
 * Update to 100 XP/hour Rate
 *
 * This script:
 * 1. Fetches all users from the database
 * 2. Recalculates XP based on total hours with new rate (100 XP per hour)
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
 * Calculate XP based on total duration with new rate
 * Formula: 100 XP per hour
 */
function calculateXPFromDuration(durationSeconds: number): number {
  const hours = durationSeconds / 3600;
  return Math.floor(hours * 100);
}

/**
 * Calculate level from XP
 */
function calculateLevel(xp: number): number {
  if (xp < 283) return 1;
  const level = Math.round(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level));
}

async function updateToNew100XPRate() {
  console.log('🚀 Updating all users to 100 XP/hour rate...\n');

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

    console.log(`📊 Found ${statsSnapshot.size} users to process\n`);

    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const doc of statsSnapshot.docs) {
      const userId = doc.id;
      const stats = doc.data();

      try {
        const totalDuration = stats.totalDuration || 0;
        const username = stats.username || 'Unknown';
        const oldXP = stats.xp || 0;

        // Calculate new XP based on total hours (100 XP/hour)
        const newXP = calculateXPFromDuration(totalDuration);
        const newLevel = calculateLevel(newXP);

        // Update user stats
        await doc.ref.update({
          xp: newXP,
        });

        const hours = (totalDuration / 3600).toFixed(2);
        console.log(
          `✅ ${username.padEnd(25)} ${hours.padStart(6)}h | ${oldXP.toString().padStart(4)} XP → ${newXP.toString().padStart(5)} XP | Level ${newLevel}`
        );

        successCount++;
      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
        errorCount++;
      }
    }

    console.log('\n📋 Summary:');
    console.log(`✅ Successfully updated: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log('\n✨ Update complete!');
  } catch (error) {
    console.error('❌ Fatal error during update:', error);
    throw error;
  }
}

// Run the script
updateToNew100XPRate()
  .then(() => {
    console.log('\n👋 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
