/**
 * Migration Script: Recalculate XP and Award Achievements
 *
 * This script:
 * 1. Recalculates all user XP based on actual session data (100 XP/hour + bonuses)
 * 2. Awards all achievements that users should have based on their stats
 * 3. Cleans up old badge data and migrates to achievement system
 * 4. Updates profile configs
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

// Import achievement definitions
const ACHIEVEMENT_DEFINITIONS = [
  // Milestone
  { id: 'first_steps', category: 'milestone', xpReward: 50, check: (s: any) => s.totalSessions >= 1 },

  // Time achievements
  { id: 'getting_started', category: 'time', xpReward: 50, check: (s: any) => s.totalDuration >= 36000 },
  { id: 'academic', category: 'time', xpReward: 75, check: (s: any) => s.totalDuration >= 90000 },
  { id: 'dedicated', category: 'time', xpReward: 100, check: (s: any) => s.totalDuration >= 180000 },
  { id: 'centurion', category: 'time', xpReward: 200, check: (s: any) => s.totalDuration >= 360000 },
  { id: 'committed', category: 'time', xpReward: 300, check: (s: any) => s.totalDuration >= 900000 },
  { id: 'scholar', category: 'time', xpReward: 500, check: (s: any) => s.totalDuration >= 1800000 },
  { id: 'master', category: 'time', xpReward: 1000, check: (s: any) => s.totalDuration >= 3600000 },
  { id: 'grandmaster', category: 'time', xpReward: 2500, check: (s: any) => s.totalDuration >= 9000000 },
  { id: 'legend', category: 'time', xpReward: 5000, check: (s: any) => s.totalDuration >= 18000000 },

  // Streak achievements
  { id: 'hot_streak', category: 'streak', xpReward: 50, check: (s: any) => s.longestStreak >= 3 },
  { id: 'on_fire', category: 'streak', xpReward: 100, check: (s: any) => s.longestStreak >= 7 },
  { id: 'blazing', category: 'streak', xpReward: 200, check: (s: any) => s.longestStreak >= 14 },
  { id: 'unstoppable', category: 'streak', xpReward: 300, check: (s: any) => s.longestStreak >= 30 },
  { id: 'relentless', category: 'streak', xpReward: 500, check: (s: any) => s.longestStreak >= 60 },
  { id: 'phenomenal', category: 'streak', xpReward: 750, check: (s: any) => s.longestStreak >= 90 },
  { id: 'immortal', category: 'streak', xpReward: 1500, check: (s: any) => s.longestStreak >= 180 },
  { id: 'eternal', category: 'streak', xpReward: 3650, check: (s: any) => s.longestStreak >= 365 },

  // Intensity achievements
  { id: 'power_hour', category: 'intensity', xpReward: 75, check: (s: any) => (s.longestSessionDuration || 0) >= 7200 },
  { id: 'marathon', category: 'intensity', xpReward: 150, check: (s: any) => (s.longestSessionDuration || 0) >= 14400 },
  { id: 'deep_focus', category: 'intensity', xpReward: 225, check: (s: any) => (s.longestSessionDuration || 0) >= 21600 },
  { id: 'ultra_marathon', category: 'intensity', xpReward: 300, check: (s: any) => (s.longestSessionDuration || 0) >= 28800 },
  { id: 'iron_will', category: 'intensity', xpReward: 500, check: (s: any) => (s.longestSessionDuration || 0) >= 43200 },
];

function calculateLevel(xp: number): number {
  if (xp < 283) return 1;
  const level = Math.round(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level));
}

async function migrateAllUsers() {
  console.log('🚀 Starting XP and Achievement Migration\n');

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

    console.log(`📊 Found ${statsSnapshot.size} users to migrate\n`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of statsSnapshot.docs) {
      const userId = doc.id;
      const stats = doc.data();
      const username = stats.username || 'Unknown';

      try {
        console.log(`\n👤 Migrating: ${username} (${userId})`);

        // Calculate base XP from hours (100 XP per hour)
        const hours = (stats.totalDuration || 0) / 3600;
        const baseXP = Math.floor(hours * 100);

        // Calculate session completion bonuses (25 XP per session)
        const sessionBonusXP = (stats.totalSessions || 0) * 25;

        // Calculate first session of day bonuses (25 XP each)
        const firstSessionBonusXP = (stats.firstSessionOfDayCount || 0) * 25;

        // Calculate streak bonuses
        let streakBonusXP = 0;
        if (stats.longestStreak >= 7) streakBonusXP += 100;
        if (stats.longestStreak >= 30) streakBonusXP += 500;

        // Total XP (before achievements)
        let totalXP = baseXP + sessionBonusXP + firstSessionBonusXP + streakBonusXP;

        // Check which achievements user should have
        const earnedAchievements: string[] = [];
        let achievementBonusXP = 0;

        for (const achievement of ACHIEVEMENT_DEFINITIONS) {
          if (achievement.check(stats)) {
            earnedAchievements.push(achievement.id);
            achievementBonusXP += achievement.xpReward;
          }
        }

        // Add achievement XP
        totalXP += achievementBonusXP;

        const level = calculateLevel(totalXP);

        console.log(`  ├─ Hours: ${hours.toFixed(2)}h → ${baseXP} base XP`);
        console.log(`  ├─ Sessions: ${stats.totalSessions} → ${sessionBonusXP} session XP`);
        console.log(`  ├─ First sessions: ${stats.firstSessionOfDayCount || 0} → ${firstSessionBonusXP} bonus XP`);
        console.log(`  ├─ Streak bonuses: ${streakBonusXP} XP`);
        console.log(`  ├─ Achievements: ${earnedAchievements.length} → ${achievementBonusXP} XP`);
        console.log(`  ├─ Total XP: ${totalXP}`);
        console.log(`  └─ Level: ${level}`);

        if (earnedAchievements.length > 0) {
          console.log(`     Achievements: ${earnedAchievements.join(', ')}`);
        }

        // Update user stats
        const updates: any = {
          xp: totalXP,
          achievements: earnedAchievements,
          achievementsUnlockedAt: {},
        };

        // Set unlock timestamps for all achievements
        const now = admin.firestore.Timestamp.now();
        earnedAchievements.forEach(achievementId => {
          updates.achievementsUnlockedAt[achievementId] = now;
        });

        // Remove old badge fields if they exist
        if (stats.badges) {
          updates.badges = admin.firestore.FieldValue.delete();
        }
        if (stats.badgesUnlockedAt) {
          updates.badgesUnlockedAt = admin.firestore.FieldValue.delete();
        }

        await doc.ref.update(updates);

        migratedCount++;
        console.log(`  ✅ Migration successful`);

      } catch (error) {
        errorCount++;
        console.error(`  ❌ Migration failed for ${username}:`, error);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📈 Migration Summary:`);
    console.log(`  ✅ Successfully migrated: ${migratedCount} users`);
    console.log(`  ❌ Failed: ${errorCount} users`);
    console.log(`  📊 Total users: ${statsSnapshot.size}`);
    console.log(`${'='.repeat(60)}\n`);

    // Show top 10 leaderboard
    console.log('🏆 Top 10 XP Leaderboard (After Migration):\n');
    const topUsers = await db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .orderBy('xp', 'desc')
      .limit(10)
      .get();

    console.log(`Rank | Username                    | XP     | Level | Achievements`);
    console.log(`-----|----------------------------|--------|-------|-------------`);

    topUsers.docs.forEach((doc, index) => {
      const data = doc.data();
      const rank = `${index + 1}`.padStart(4);
      const username = (data.username || 'Unknown').padEnd(26).substring(0, 26);
      const xp = `${data.xp || 0}`.padStart(6);
      const level = `${calculateLevel(data.xp || 0)}`.padStart(5);
      const achievements = `${(data.achievements || []).length}`.padStart(11);

      console.log(`${rank} | ${username} | ${xp} | ${level} | ${achievements}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateAllUsers()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
