/**
 * One-time script: Reset #1
 *
 * Snapshots every user's current XP/hours into resetHistory[0], then zeros
 * out xp, totalDuration, totalSessions, and sessionsByDay.
 *
 * Run with:
 *   npx ts-node -e "require('./scripts/reset-xp-now.ts')"
 * or:
 *   npx tsx scripts/reset-xp-now.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// ── Firebase init ─────────────────────────────────────────────────────────────
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  console.error('FIREBASE_SERVICE_ACCOUNT env var not set');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount)),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

// ── Reset logic ───────────────────────────────────────────────────────────────
async function main() {
  const statsCollection = db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats');

  console.log('Fetching all user stats...');
  const allDocs = await statsCollection.get();

  if (allDocs.empty) {
    console.log('No user stats found. Nothing to reset.');
    return;
  }

  console.log(`Found ${allDocs.size} user documents. Starting reset...`);

  const now = Timestamp.now();
  const BATCH_SIZE = 400;
  const docs = allDocs.docs;
  let processedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      const data = doc.data();
      const currentXp       = data.xp || 0;
      const currentDuration = data.totalDuration || 0;
      const currentSessions = data.totalSessions || 0;

      if (currentXp === 0 && currentDuration === 0 && currentSessions === 0) {
        skippedCount++;
        continue;
      }

      const existingHistory = data.resetHistory || [];
      const resetNumber = existingHistory.length + 1;

      const snapshot = {
        resetNumber,
        resetAt: now,
        periodXp: currentXp,
        periodHours: currentDuration / 3600,
        periodSessions: currentSessions,
        longestStreakInPeriod: data.longestStreak || 0,
        longestSessionInPeriod: data.longestSessionDuration || 0,
      };

      batch.update(doc.ref, {
        xp: 0,
        totalDuration: 0,
        totalSessions: 0,
        sessionsByDay: {},
        resetHistory: [...existingHistory, snapshot],
      });

      console.log(
        `  [${doc.id}] ${data.username || 'unknown'}: ` +
        `${currentXp} XP, ${(currentDuration / 3600).toFixed(1)}h → saved as Period ${resetNumber}`
      );

      processedCount++;
    }

    await batch.commit();
    console.log(`Committed batch (${i + 1}–${Math.min(i + BATCH_SIZE, docs.length)} of ${docs.size})`);
  }

  console.log('\n✅ Reset complete!');
  console.log(`   Reset:   ${processedCount} users`);
  console.log(`   Skipped: ${skippedCount} users (already 0)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
