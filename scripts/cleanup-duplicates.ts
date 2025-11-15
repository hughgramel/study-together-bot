/**
 * Cleanup script to remove duplicate sessions from Firestore
 *
 * This script identifies and removes duplicate sessions that were created
 * due to the race condition bug. It groups sessions by:
 * - Same userId
 * - Same duration (within 1 second tolerance)
 * - Same activity
 * - Created within 1 second of each other
 *
 * Run with: npm run cleanup-duplicates
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Initialize Firebase
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

interface CompletedSession {
  userId: string;
  username: string;
  serverId: string;
  activity: string;
  title: string;
  description: string;
  duration: number;
  startTime: Timestamp;
  endTime: Timestamp;
  createdAt: Timestamp;
}

interface SessionWithId extends CompletedSession {
  id: string;
}

interface DuplicateGroup {
  sessions: SessionWithId[];
  toKeep: SessionWithId;
  toDelete: SessionWithId[];
}

async function findDuplicateSessions(): Promise<DuplicateGroup[]> {
  console.log('\n📊 Fetching all completed sessions...');

  const snapshot = await db
    .collection('discord-data')
    .doc('sessions')
    .collection('completed')
    .orderBy('createdAt', 'asc')
    .get();

  console.log(`Found ${snapshot.size} total sessions`);

  const allSessions: SessionWithId[] = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as CompletedSession)
  }));

  // Group sessions by userId
  const sessionsByUser = new Map<string, SessionWithId[]>();

  for (const session of allSessions) {
    if (!sessionsByUser.has(session.userId)) {
      sessionsByUser.set(session.userId, []);
    }
    sessionsByUser.get(session.userId)!.push(session);
  }

  console.log(`\n📈 Sessions grouped by ${sessionsByUser.size} unique users`);

  // Find duplicates within each user's sessions
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [userId, sessions] of sessionsByUser.entries()) {
    // Sort by creation time
    sessions.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

    const processed = new Set<string>();

    for (let i = 0; i < sessions.length; i++) {
      if (processed.has(sessions[i].id)) continue;

      const group: SessionWithId[] = [sessions[i]];
      processed.add(sessions[i].id);

      // Look for duplicates within the next few sessions
      for (let j = i + 1; j < sessions.length; j++) {
        if (processed.has(sessions[j].id)) continue;

        const session1 = sessions[i];
        const session2 = sessions[j];

        // Check if they're duplicates:
        // 1. Same duration (within 1 second tolerance for timing differences)
        const durationMatch = Math.abs(session1.duration - session2.duration) <= 1;

        // 2. Same activity
        const activityMatch = session1.activity === session2.activity;

        // 3. Created within 1 second of each other
        const timeDiff = Math.abs(session1.createdAt.toMillis() - session2.createdAt.toMillis());
        const createdCloselyMatch = timeDiff <= 1000; // 1 second

        if (durationMatch && activityMatch && createdCloselyMatch) {
          group.push(session2);
          processed.add(session2.id);
        } else if (timeDiff > 5000) {
          // If we're more than 5 seconds apart, stop looking
          // (duplicates were created within milliseconds)
          break;
        }
      }

      // If we found duplicates (group size > 1), add to duplicate groups
      if (group.length > 1) {
        duplicateGroups.push({
          sessions: group,
          toKeep: group[0], // Keep the first one (earliest created)
          toDelete: group.slice(1) // Delete the rest
        });
      }
    }
  }

  return duplicateGroups;
}

async function displayDuplicates(groups: DuplicateGroup[]): Promise<void> {
  console.log(`\n🔍 Found ${groups.length} duplicate groups\n`);

  let totalDuplicates = 0;

  for (const group of groups) {
    totalDuplicates += group.toDelete.length;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`User: ${group.toKeep.username} (${group.toKeep.userId})`);
    console.log(`Activity: ${group.toKeep.activity}`);
    console.log(`Duration: ${group.toKeep.duration}s (${(group.toKeep.duration / 3600).toFixed(2)}h)`);
    console.log(`Duplicates: ${group.sessions.length} copies`);
    console.log(`\nSessions:`);

    for (let i = 0; i < group.sessions.length; i++) {
      const session = group.sessions[i];
      const status = i === 0 ? '✅ KEEP' : '❌ DELETE';
      console.log(`  ${status} - ID: ${session.id}, Created: ${session.createdAt.toDate().toISOString()}`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Duplicate groups: ${groups.length}`);
  console.log(`   Sessions to delete: ${totalDuplicates}`);
  console.log(`   Sessions to keep: ${groups.length}`);
}

async function deleteDuplicates(groups: DuplicateGroup[], dryRun: boolean = true): Promise<number> {
  if (dryRun) {
    console.log('\n🔒 DRY RUN MODE - No changes will be made\n');
    return 0;
  }

  console.log('\n🗑️  Deleting duplicates...\n');

  const batch = db.batch();
  let deleteCount = 0;

  for (const group of groups) {
    for (const session of group.toDelete) {
      const ref = db
        .collection('discord-data')
        .doc('sessions')
        .collection('completed')
        .doc(session.id);

      batch.delete(ref);
      deleteCount++;

      console.log(`  ❌ Deleting ${session.id} (${session.username}, ${session.activity})`);
    }
  }

  await batch.commit();
  console.log(`\n✅ Deleted ${deleteCount} duplicate sessions`);

  return deleteCount;
}

async function recalculateUserStats(): Promise<void> {
  console.log('\n♻️  Recalculating user stats...\n');

  // Get all completed sessions
  const snapshot = await db
    .collection('discord-data')
    .doc('sessions')
    .collection('completed')
    .orderBy('createdAt', 'asc')
    .get();

  // Group by user
  const userSessions = new Map<string, CompletedSession[]>();

  for (const doc of snapshot.docs) {
    const session = doc.data() as CompletedSession;
    if (!userSessions.has(session.userId)) {
      userSessions.set(session.userId, []);
    }
    userSessions.get(session.userId)!.push(session);
  }

  console.log(`Recalculating stats for ${userSessions.size} users...`);

  for (const [userId, sessions] of userSessions.entries()) {
    const username = sessions[0].username;

    // Sort by creation time
    sessions.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

    // Calculate total duration and session count
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalSessions = sessions.length;

    // Calculate streaks
    const firstSession = sessions[0].createdAt;
    const lastSession = sessions[sessions.length - 1].createdAt;

    // Simple streak calculation (would need more complex logic for accurate streaks)
    let currentStreak = 1;
    let longestStreak = 1;

    // Update user stats
    await db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId)
      .set({
        username,
        totalSessions,
        totalDuration,
        currentStreak,
        longestStreak,
        lastSessionAt: lastSession,
        firstSessionAt: firstSession,
      });

    console.log(`  ✅ ${username}: ${totalSessions} sessions, ${(totalDuration / 3600).toFixed(2)}h total`);
  }

  console.log('\n✅ User stats recalculated');
}

async function main() {
  console.log('🧹 Duplicate Session Cleanup Script');
  console.log('====================================\n');

  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  if (dryRun) {
    console.log('⚠️  Running in DRY RUN mode. Use --execute to actually delete duplicates.\n');
  } else {
    console.log('⚠️  EXECUTING MODE - Changes will be permanent!\n');
  }

  try {
    // Find duplicates
    const duplicateGroups = await findDuplicateSessions();

    // Display what we found
    await displayDuplicates(duplicateGroups);

    if (duplicateGroups.length === 0) {
      console.log('\n✅ No duplicates found!');
      process.exit(0);
    }

    // Delete duplicates
    const deletedCount = await deleteDuplicates(duplicateGroups, dryRun);

    if (!dryRun && deletedCount > 0) {
      // Recalculate user stats
      await recalculateUserStats();
    }

    console.log('\n✅ Cleanup complete!');

    if (dryRun) {
      console.log('\n💡 Run with --execute to actually perform the cleanup');
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
