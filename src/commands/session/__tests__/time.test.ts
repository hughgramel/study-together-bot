/**
 * Unit tests for /time Command
 * Run with: npx ts-node src/commands/session/__tests__/time.test.ts
 */

import { command } from '../time';
import { ActiveSession } from '../../../types';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore
class MockFirestore {
  private sessions: Map<string, ActiveSession> = new Map();

  collection(name: string) {
    return {
      doc: (docName: string) => ({
        collection: (collectionName: string) => ({
          doc: (id: string) => ({
            get: async () => {
              if (collectionName === 'sessions') {
                const session = this.sessions.get(id);
                return {
                  exists: !!session,
                  data: () => session,
                };
              }
              return { exists: false, data: () => null };
            },
          }),
        }),
      }),
    };
  }

  // Helper methods for testing
  getSession(userId: string): ActiveSession | undefined {
    return this.sessions.get(userId);
  }

  setSession(userId: string, session: ActiveSession) {
    this.sessions.set(userId, session);
  }

  reset() {
    this.sessions.clear();
  }
}

// Mock interaction
function createMockInteraction(options: {
  userId?: string;
  username?: string;
}) {
  const edits: string[] = [];

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    deferReply: async () => {},
    editReply: async (msg: any) => {
      edits.push(typeof msg === 'string' ? msg : msg.content);
    },
    _getEdits: () => edits,
  };
}

// Test helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

// Main test runner
async function runTests() {
  console.log('🧪 Running /time Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Shows active session time
  console.log('Test 1: Shows active session time');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user1',
      username: 'alice',
      serverId: 'guild123',
      activity: 'Math homework',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 30), // 30 min ago
      isPaused: false,
      pausedDuration: 0,
    };
    mockDb.setSession('user1', activeSession);

    const interaction = createMockInteraction({
      userId: 'user1',
      username: 'alice',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].includes('Current Session'), 'Should show current session header');
    assert(edits[0].includes('▶️ Active'), 'Should show active status');
    assert(edits[0].includes('Math homework'), 'Should show activity');
    assert(edits[0].includes('Elapsed Time'), 'Should show elapsed time label');
    testCount++;
  }

  // Test 2: Shows paused session time
  console.log('\nTest 2: Shows paused session time');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user2',
      username: 'bob',
      serverId: 'guild123',
      activity: 'Science project',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 45), // 45 min ago
      isPaused: true,
      pausedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 5), // paused 5 min ago
      pausedDuration: 120, // 2 min paused duration
    };
    mockDb.setSession('user2', pausedSession);

    const interaction = createMockInteraction({
      userId: 'user2',
      username: 'bob',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].includes('⏸️ Paused'), 'Should show paused status');
    assert(edits[0].includes('Science project'), 'Should show activity');
    testCount++;
  }

  // Test 3: Fails when no active session exists
  console.log('\nTest 3: Fails when no active session exists');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      userId: 'user3',
      username: 'charlie',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].includes('No active session'), 'Should indicate no active session');
    assert(edits[0].includes('/start'), 'Should suggest /start command');
    testCount++;
  }

  // Test 4: Command has correct name
  console.log('\nTest 4: Command has correct name');
  {
    assert(command.data.name === 'time', 'Command name should be time');
    testCount++;
  }

  // Test 5: Shows elapsed time accounting for paused duration
  console.log('\nTest 5: Shows elapsed time accounting for paused duration');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user4',
      username: 'david',
      serverId: 'guild456',
      activity: 'Reading chapter 5',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 60), // 60 min ago
      isPaused: false,
      pausedDuration: 600, // 10 minutes paused
    };
    mockDb.setSession('user4', activeSession);

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'david',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    // Elapsed should be ~50 minutes (60 - 10 paused)
    assert(edits[0].includes('Reading chapter 5'), 'Should show activity');
    testCount++;
  }

  // Test 6: Shows short duration sessions correctly
  console.log('\nTest 6: Shows short duration sessions correctly');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user5',
      username: 'eve',
      serverId: 'guild789',
      activity: 'Quick review',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 90), // 90 seconds ago
      isPaused: false,
      pausedDuration: 0,
    };
    mockDb.setSession('user5', activeSession);

    const interaction = createMockInteraction({
      userId: 'user5',
      username: 'eve',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].includes('Quick review'), 'Should show activity');
    assert(edits[0].includes('▶️ Active'), 'Should show active status');
    testCount++;
  }

  // Test 7: Shows long duration sessions correctly
  console.log('\nTest 7: Shows long duration sessions correctly');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user6',
      username: 'frank',
      serverId: 'guild123',
      activity: 'Deep work session',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 150), // 2.5 hours ago
      isPaused: false,
      pausedDuration: 0,
    };
    mockDb.setSession('user6', activeSession);

    const interaction = createMockInteraction({
      userId: 'user6',
      username: 'frank',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].includes('Deep work session'), 'Should show activity');
    testCount++;
  }

  console.log(`\n🎉 All ${testCount} tests passed!`);
  console.log('');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
