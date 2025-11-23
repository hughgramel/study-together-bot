/**
 * Migration Script: Remove GP- prefix from group IDs
 *
 * This script updates all existing groups and group memberships to remove
 * the "GP-" prefix from group IDs.
 *
 * Example: "GP-A1B2" -> "A1B2"
 *
 * Usage: npx ts-node scripts/migrate-group-ids.ts
 */

import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore() as Firestore;

interface MigrationStats {
  groupsUpdated: number;
  membershipsUpdated: number;
  errors: string[];
}

/**
 * Main migration function
 */
async function migrateGroupIds(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    groupsUpdated: 0,
    membershipsUpdated: 0,
    errors: [],
  };

  console.log('🔄 Starting group ID migration...');
  console.log('━'.repeat(50));

  try {
    // Step 1: Get all groups
    console.log('\n📂 Fetching all groups...');
    const groupsSnapshot = await db
      .collection('discord-data')
      .doc('groups')
      .collection('active')
      .get();

    console.log(`Found ${groupsSnapshot.size} groups to migrate\n`);

    // Step 2: Migrate each group
    for (const groupDoc of groupsSnapshot.docs) {
      const groupData = groupDoc.data();
      const oldGroupId = groupData.groupId;

      // Check if ID has GP- prefix
      if (!oldGroupId.startsWith('GP-')) {
        console.log(`⏭️  Skipping ${oldGroupId} (already migrated)`);
        continue;
      }

      const newGroupId = oldGroupId.replace('GP-', '');

      console.log(`\n🔧 Migrating group: ${oldGroupId} -> ${newGroupId}`);

      try {
        // Create new group document with updated ID
        const newGroupRef = db
          .collection('discord-data')
          .doc('groups')
          .collection('active')
          .doc(newGroupId);

        await newGroupRef.set({
          ...groupData,
          groupId: newGroupId,
        });

        // Step 3: Update all memberships for this group
        console.log(`  📝 Updating memberships for ${oldGroupId}...`);
        const membershipsSnapshot = await db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .where('groupId', '==', oldGroupId)
          .get();

        console.log(`    Found ${membershipsSnapshot.size} memberships`);

        const batch = db.batch();
        let batchCount = 0;

        for (const membershipDoc of membershipsSnapshot.docs) {
          const membershipData = membershipDoc.data();

          // Update the membership with new groupId
          batch.update(membershipDoc.ref, {
            groupId: newGroupId,
          });

          batchCount++;
          stats.membershipsUpdated++;

          // Firestore batch limit is 500 operations
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`    💾 Committed batch of ${batchCount} memberships`);
            batchCount = 0;
          }
        }

        // Commit remaining batch operations
        if (batchCount > 0) {
          await batch.commit();
          console.log(`    💾 Committed final batch of ${batchCount} memberships`);
        }

        // Step 4: Delete old group document
        await groupDoc.ref.delete();
        console.log(`  ✅ Deleted old group document: ${oldGroupId}`);

        stats.groupsUpdated++;
      } catch (error) {
        const errorMsg = `Failed to migrate ${oldGroupId}: ${error}`;
        console.error(`  ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log('\n' + '━'.repeat(50));
    console.log('✨ Migration complete!');
    console.log(`\n📊 Stats:`);
    console.log(`  Groups updated: ${stats.groupsUpdated}`);
    console.log(`  Memberships updated: ${stats.membershipsUpdated}`);
    console.log(`  Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    stats.errors.push(`Global error: ${error}`);
  }

  return stats;
}

// Run the migration
migrateGroupIds()
  .then(stats => {
    console.log('\n✅ Migration script completed');
    process.exit(stats.errors.length > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
