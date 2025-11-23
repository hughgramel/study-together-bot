import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Load service accounts
const oldServiceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account.json', 'utf8')
);
const newServiceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account-new.json', 'utf8')
);

// Initialize both Firebase apps
const oldApp = admin.initializeApp(
  {
    credential: admin.credential.cert(oldServiceAccount as admin.ServiceAccount),
    projectId: 'strava-but-productive',
  },
  'oldApp'
);

const newApp = admin.initializeApp(
  {
    credential: admin.credential.cert(newServiceAccount as admin.ServiceAccount),
    projectId: 'study-together-64095',
  },
  'newApp'
);

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

interface MigrationStats {
  collections: number;
  documents: number;
  subcollections: number;
}

const stats: MigrationStats = {
  collections: 0,
  documents: 0,
  subcollections: 0,
};

async function migrateDocumentPath(
  oldDocRef: admin.firestore.DocumentReference,
  newDocRef: admin.firestore.DocumentReference,
  depth: string = ''
) {
  console.log(`${depth}Checking document: ${oldDocRef.path}`);

  const docSnapshot = await oldDocRef.get();

  if (docSnapshot.exists) {
    console.log(`${depth}  - Copying document data`);
    const data = docSnapshot.data();
    await newDocRef.set(data!);
    stats.documents++;
  }

  // Check for subcollections regardless of whether document exists
  const subcollections = await oldDocRef.listCollections();
  for (const subcollection of subcollections) {
    console.log(`${depth}  - Found subcollection: ${subcollection.id}`);
    await migrateCollection(
      subcollection,
      newDocRef.collection(subcollection.id),
      depth + '    '
    );
  }
}

async function migrateCollection(
  oldCollectionRef: admin.firestore.CollectionReference,
  newCollectionRef: admin.firestore.CollectionReference,
  depth: string = ''
) {
  console.log(`${depth}Migrating collection: ${oldCollectionRef.path}`);

  const snapshot = await oldCollectionRef.get();

  if (snapshot.empty) {
    console.log(`${depth}  (no documents at this level)`);
    return;
  }

  stats.collections++;

  for (const doc of snapshot.docs) {
    console.log(`${depth}  - Document: ${doc.id}`);

    // Copy document data
    const data = doc.data();
    await newCollectionRef.doc(doc.id).set(data);
    stats.documents++;

    // Recursively migrate subcollections
    const subcollections = await doc.ref.listCollections();
    for (const subcollection of subcollections) {
      stats.subcollections++;
      await migrateCollection(
        subcollection,
        newCollectionRef.doc(doc.id).collection(subcollection.id),
        depth + '    '
      );
    }
  }
}

async function migrate() {
  console.log('========================================');
  console.log('Firebase Data Migration');
  console.log('========================================');
  console.log('FROM: strava-but-productive');
  console.log('TO:   study-together-64095');
  console.log('========================================\n');

  try {
    // First, discover all documents in discord-data collection
    console.log('Discovering all documents in discord-data collection...\n');

    const discordDataRef = oldDb.collection('discord-data');
    const allDocs = await discordDataRef.listDocuments();

    console.log(`Found ${allDocs.length} top-level documents in discord-data\n`);

    // Migrate each document and its subcollections
    for (const docRef of allDocs) {
      const oldDocRef = oldDb.collection('discord-data').doc(docRef.id);
      const newDocRef = newDb.collection('discord-data').doc(docRef.id);

      await migrateDocumentPath(oldDocRef, newDocRef);
    }

    console.log('\n========================================');
    console.log('Migration Complete!');
    console.log('========================================');
    console.log(`Collections migrated: ${stats.collections}`);
    console.log(`Documents migrated: ${stats.documents}`);
    console.log(`Subcollections migrated: ${stats.subcollections}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  // Clean up
  await oldApp.delete();
  await newApp.delete();
  process.exit(0);
}

migrate();
