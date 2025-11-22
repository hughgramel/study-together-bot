import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Load old service account
const oldServiceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account.json', 'utf8')
);

// Initialize Firebase app
const app = admin.initializeApp({
  credential: admin.credential.cert(oldServiceAccount as admin.ServiceAccount),
  projectId: 'strava-but-productive',
});

const db = app.firestore();

async function listCollections() {
  console.log('Listing all root collections in strava-but-productive:\n');

  const collections = await db.listCollections();

  for (const collection of collections) {
    console.log(`Collection: ${collection.id}`);

    // Get first few documents to show structure
    const snapshot = await collection.limit(3).get();
    console.log(`  Documents: ${snapshot.size}`);

    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        console.log(`    - ${doc.id}`);

        // List subcollections
        const subcollections = await doc.ref.listCollections();
        if (subcollections.length > 0) {
          console.log(`      Subcollections: ${subcollections.map(s => s.id).join(', ')}`);
        }
      }
    }
    console.log('');
  }

  await app.delete();
}

listCollections();
