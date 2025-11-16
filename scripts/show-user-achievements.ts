/**
 * Show User Achievements
 *
 * Display detailed achievement information for all users
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

let serviceAccount: admin.ServiceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim().length > 0) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

const ACHIEVEMENT_NAMES: { [key: string]: string } = {
  first_steps: '🎯 First Steps',
  getting_started: '⏱️  Getting Started (10h)',
  academic: '🎓 Academic (25h)',
  dedicated: '⭐ Dedicated (50h)',
  centurion: '💯 Centurion (100h)',
  committed: '🕐 Committed (250h)',
  scholar: '📚 Scholar (500h)',
  master: '🧙 Master (1000h)',
  grandmaster: '👑 Grandmaster (2500h)',
  legend: '🏆 Legend (5000h)',
  hot_streak: '🔥 Hot Streak (3 days)',
  on_fire: '🔥 On Fire (7 days)',
  blazing: '🔥 Blazing (14 days)',
  unstoppable: '💫 Unstoppable (30 days)',
  relentless: '⭐ Relentless (60 days)',
  phenomenal: '🌟 Phenomenal (90 days)',
  immortal: '💎 Immortal (180 days)',
  eternal: '♾️  Eternal (365 days)',
  power_hour: '⚡ Power Hour (2h session)',
  marathon: '💪 Marathon (4h session)',
  deep_focus: '🎯 Deep Focus (6h session)',
  ultra_marathon: '🏃 Ultra Marathon (8h session)',
  iron_will: '🦾 Iron Will (12h session)',
};

function calculateLevel(xp: number): number {
  if (xp < 283) return 1;
  const level = Math.round(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level));
}

async function showUserAchievements() {
  console.log('🏆 User Achievements Summary\n');

  const statsSnapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .orderBy('xp', 'desc')
    .get();

  console.log(`Found ${statsSnapshot.size} users\n`);
  console.log('='.repeat(80));

  statsSnapshot.docs.forEach((doc, index) => {
    const stats = doc.data();
    const username = stats.username || 'Unknown';
    const xp = stats.xp || 0;
    const level = calculateLevel(xp);
    const achievements = stats.achievements || [];
    const hours = ((stats.totalDuration || 0) / 3600).toFixed(2);

    console.log(`\n#${index + 1} ${username}`);
    console.log(`   Level ${level} | ${xp} XP | ${hours}h | ${stats.totalSessions || 0} sessions | Streak: ${stats.longestStreak || 0}`);

    if (achievements.length > 0) {
      console.log(`   Achievements (${achievements.length}):`);
      achievements.forEach((achId: string) => {
        const name = ACHIEVEMENT_NAMES[achId] || achId;
        console.log(`     • ${name}`);
      });
    } else {
      console.log(`   No achievements yet`);
    }
  });

  console.log('\n' + '='.repeat(80));
}

showUserAchievements()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
