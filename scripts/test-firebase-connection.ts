import * as admin from 'firebase-admin';
import * as fs from 'fs';

// Load the service account (same way bot.ts does it)
const serviceAccount = JSON.parse(
  fs.readFileSync('./firebase-service-account-new.json', 'utf8')
);

// Initialize Firebase
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: 'study-together-64095',
});

const db = app.firestore();

async function testConnection() {
  console.log('Testing Firebase connection to study-together-64095...\n');

  try {
    // Test 1: Read active sessions
    console.log('1. Reading active sessions...');
    const activeSessions = await db
      .collection('discord-data')
      .doc('activeSessions')
      .collection('sessions')
      .get();
    console.log(`   ✓ Found ${activeSessions.size} active sessions\n`);

    // Test 2: Read user stats
    console.log('2. Reading user stats...');
    const userStats = await db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .get();
    console.log(`   ✓ Found ${userStats.size} user stat documents\n`);

    // Test 3: Read completed sessions
    console.log('3. Reading completed sessions...');
    const completedSessions = await db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .limit(5)
      .get();
    console.log(`   ✓ Found completed sessions (showing first 5)`);
    completedSessions.forEach(doc => {
      const data = doc.data();
      console.log(`     - Session ${doc.id}: ${data.userId}, duration: ${data.duration}ms`);
    });

    // Test 4: Read server configs
    console.log('\n4. Reading server configs...');
    const serverConfigs = await db
      .collection('discord-data')
      .doc('serverConfig')
      .collection('configs')
      .get();
    console.log(`   ✓ Found ${serverConfigs.size} server configs\n`);

    console.log('========================================');
    console.log('✅ All tests passed!');
    console.log('Firebase connection is working correctly.');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Error testing Firebase connection:', error);
    process.exit(1);
  }

  await app.delete();
  process.exit(0);
}

testConnection();
