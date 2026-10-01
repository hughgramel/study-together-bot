/**
 * One-time script: Reset all group totalHours and level after the XP reset
 *
 * After /admin-reset-xp zeroed everyone's totalDuration, group documents still
 * hold their old totalHours/level values. This script syncs them back to reality
 * by re-summing each group's members' current totalDuration (now 0).
 *
 * Groups level back up naturally as members complete sessions.
 *
 * Run with:
 *   npx tsx scripts/reset-groups-now.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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

function calculateGroupLevel(totalHours: number): number {
  return Math.floor(totalHours / 25) + 1;
}

async function main() {
  const groupsCollection = db
    .collection('discord-data')
    .doc('groups')
    .collection('active');

  const membershipsCollection = db
    .collection('discord-data')
    .doc('groupMembers')
    .collection('memberships');

  const statsCollection = db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats');

  console.log('Fetching all active groups...');
  const groupDocs = await groupsCollection.get();

  if (groupDocs.empty) {
    console.log('No active groups found.');
    return;
  }

  console.log(`Found ${groupDocs.size} groups. Recalculating from live member hours...`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const groupDoc of groupDocs.docs) {
    const groupData = groupDoc.data();
    const groupId   = groupDoc.id;
    const groupName = groupData.name || groupId;

    // Fetch all memberships for this group
    const memberships = await membershipsCollection
      .where('groupId', '==', groupId)
      .get();

    if (memberships.empty) {
      console.log(`  [${groupName}] No members found — setting to 0h level 1`);
    }

    // Sum each member's current totalDuration
    let totalHours = 0;
    for (const memberDoc of memberships.docs) {
      const userId   = memberDoc.data().userId;
      const statsDoc = await statsCollection.doc(userId).get();
      if (statsDoc.exists) {
        const userHours = (statsDoc.data()?.totalDuration || 0) / 3600;
        totalHours += userHours;
      }
    }

    const newLevel    = calculateGroupLevel(totalHours);
    const oldLevel    = groupData.level || 1;
    const oldHours    = groupData.totalHours || 0;

    if (Math.abs(oldHours - totalHours) < 0.01 && oldLevel === newLevel) {
      console.log(`  [${groupName}] Already correct (${totalHours.toFixed(1)}h, lv${newLevel}) — skipped`);
      skippedCount++;
      continue;
    }

    await groupDoc.ref.update({
      totalHours,
      level: newLevel,
      updatedAt: Timestamp.now(),
    });

    console.log(
      `  [${groupName}] ${oldHours.toFixed(1)}h lv${oldLevel}` +
      ` → ${totalHours.toFixed(1)}h lv${newLevel}`
    );
    updatedCount++;
  }

  console.log('\n✅ Group sync complete!');
  console.log(`   Updated: ${updatedCount} groups`);
  console.log(`   Skipped: ${skippedCount} groups (already correct)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
