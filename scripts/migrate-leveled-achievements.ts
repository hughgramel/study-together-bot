/**
 * Migration Script: Migrate to Leveled Achievements System
 *
 * This script:
 * 1. Backs up existing achievement data to a separate collection
 * 2. Calculates refund XP for removed achievements
 * 3. Converts old achievements to new leveled achievement system
 * 4. Initializes 4 core achievements: Scholar, Marathon Runner, Wildfire, Champion
 * 5. Calculates achievement levels based on user stats
 * 6. Calculates total achievement XP boost percentage
 */

import * as admin from 'firebase-admin';
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
    console.log('✅ Loaded Firebase credentials from environment variable');
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
  console.log('✅ Loaded Firebase credentials from local file');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

// XP rewards for achievements that will be removed
const REMOVED_ACHIEVEMENT_XP: { [key: string]: number } = {
  // Schedule achievements
  'weekend_warrior': 100,
  'weekend_streak': 300,
  'full_week': 250,
  'month_master': 400,
  'midnight_grinder': 100,
  'night_owl': 100,
  'early_bird': 100,
  'morning_starter': 75,
  'morning_routine': 150,
  'morning_champion': 300,
  'morning_legend': 500,

  // Level achievements
  'level_5': 100,
  'level_10': 200,
  'level_25': 500,
  'level_35': 750,
  'level_50': 1000,
  'level_100': 2500,

  // Meta achievements
  'collector': 250,

  // Special intensity
  'new_record': 200,

  // Milestone
  'first_steps': 50,
};

// Leveled achievement definitions
const LEVELED_ACHIEVEMENTS = [
  {
    id: 'scholar',
    name: 'Scholar',
    levels: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000], // hours
    statField: 'totalDuration',
    unit: 'hours',
  },
  {
    id: 'marathon_runner',
    name: 'Marathon Runner',
    levels: [1, 2, 4, 6, 8, 10, 12, 15, 18, 24], // hours
    statField: 'longestSessionDuration',
    unit: 'hours',
  },
  {
    id: 'wildfire',
    name: 'Wildfire',
    levels: [1, 7, 14, 30, 60, 90, 180, 365, 500, 1000], // days
    statField: 'longestStreak',
    unit: 'days',
  },
  {
    id: 'champion',
    name: 'Champion',
    levels: [1, 5, 10, 25, 35, 50, 75, 90, 100, 125], // user levels
    statField: 'xp',
    unit: 'level',
  },
];

function calculateLevel(xp: number): number {
  if (xp < 283) return 1;
  const level = Math.round(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level));
}

function getStatValue(stats: any, statField: string, unit: string): number {
  if (statField === 'xp') {
    // Convert XP to level
    const xp = stats.xp || 0;
    return calculateLevel(xp);
  }

  const value = stats[statField] || 0;

  // Convert seconds to hours for duration-based achievements
  if (unit === 'hours') {
    return Math.floor(value / 3600);
  }

  return value;
}

function calculateAchievementLevel(statValue: number, levels: number[]): number {
  for (let i = levels.length - 1; i >= 0; i--) {
    if (statValue >= levels[i]) {
      return i + 1; // Levels are 1-indexed
    }
  }
  return 0; // Not reached level 1 yet
}

async function migrateUser(userId: string, stats: any): Promise<void> {
  const username = stats.username || 'Unknown';
  console.log(`\n👤 Migrating: ${username} (${userId})`);

  // 1. Calculate refund XP for removed achievements
  const currentAchievements = stats.achievements || [];
  let refundXP = 0;

  for (const achievementId of currentAchievements) {
    if (REMOVED_ACHIEVEMENT_XP[achievementId]) {
      refundXP += REMOVED_ACHIEVEMENT_XP[achievementId];
      console.log(`  ├─ Refunding ${REMOVED_ACHIEVEMENT_XP[achievementId]} XP for "${achievementId}"`);
    }
  }

  console.log(`  ├─ Total refund XP: ${refundXP}`);

  // 2. Backup old achievement data to separate collection
  if (currentAchievements.length > 0) {
    await db
      .collection('discord-data')
      .doc('achievementBackup')
      .collection('legacy')
      .doc(userId)
      .set({
        userId,
        username,
        achievements: currentAchievements,
        achievementsUnlockedAt: stats.achievementsUnlockedAt || {},
        backedUpAt: admin.firestore.Timestamp.now(),
      });
    console.log(`  ├─ Backed up ${currentAchievements.length} legacy achievements`);
  }

  // 3. Initialize leveled achievements based on current stats
  const leveledAchievements: any = {};
  let totalLevels = 0;

  for (const achievement of LEVELED_ACHIEVEMENTS) {
    const statValue = getStatValue(stats, achievement.statField, achievement.unit);
    const currentLevel = calculateAchievementLevel(statValue, achievement.levels);

    leveledAchievements[achievement.id] = {
      achievementId: achievement.id,
      currentLevel,
      currentProgress: statValue,
      ...(currentLevel > 0 && {
        unlockedAt: admin.firestore.Timestamp.now(),
        lastLevelUpAt: admin.firestore.Timestamp.now(),
      }),
    };

    totalLevels += currentLevel;

    if (currentLevel > 0) {
      console.log(`  ├─ ${achievement.name}: Level ${currentLevel}/10 (${statValue} ${achievement.unit})`);
    }
  }

  // Calculate total XP boost (each level = 0.1%)
  const totalAchievementBoost = totalLevels * 0.1;
  console.log(`  ├─ Total achievement boost: +${totalAchievementBoost.toFixed(1)}%`);

  // 4. Update user stats
  const newXP = (stats.xp || 0) + refundXP;
  const newLevel = calculateLevel(newXP);

  const updates: any = {
    leveledAchievements,
    totalAchievementBoost,
    xp: newXP,
  };

  // Keep legacy achievements for reference but mark as migrated
  // Don't delete them in case we need to roll back
  if (currentAchievements.length > 0) {
    updates.legacyAchievementsMigrated = true;
    updates.legacyAchievementsMigratedAt = admin.firestore.Timestamp.now();
  }

  await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .doc(userId)
    .update(updates);

  console.log(`  ├─ New XP: ${newXP} (Level ${newLevel})`);
  console.log(`  └─ ✅ Migration complete`);
}

async function migrateAllUsers() {
  console.log('🚀 Starting Leveled Achievements Migration\n');
  console.log('This will:');
  console.log('  1. Backup all legacy achievements to achievementBackup/legacy collection');
  console.log('  2. Refund XP for removed achievements');
  console.log('  3. Initialize 4 core leveled achievements');
  console.log('  4. Calculate achievement levels based on user stats');
  console.log('  5. Set achievement XP boost percentages\n');

  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Continue with migration? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Migration cancelled');
    process.exit(0);
  }

  try {
    // Fetch all users
    const statsSnapshot = await db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .get();

    if (statsSnapshot.empty) {
      console.log('❌ No users found');
      return;
    }

    console.log(`\n📊 Found ${statsSnapshot.size} users to migrate\n`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of statsSnapshot.docs) {
      try {
        await migrateUser(doc.id, doc.data());
        migratedCount++;
      } catch (error) {
        console.error(`  └─ ❌ Error migrating user ${doc.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log(`📦 Total: ${statsSnapshot.size} users`);
    console.log('='.repeat(60));

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('  1. Test the /achievements command to verify display');
    console.log('  2. Complete a session to verify XP boost is applied');
    console.log('  3. Check that achievement level-ups are detected');
    console.log('  4. If everything works, legacy achievements can be removed in a future update');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
    process.exit(0);
  }
}

// Run migration
migrateAllUsers();
