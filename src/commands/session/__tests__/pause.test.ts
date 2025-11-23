/**
 * Unit tests for /pause Command
 * Run with: npx ts-node src/commands/session/__tests__/pause.test.ts
 */

import { command } from '../pause';
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
            update: async (data: any) => {
              if (collectionName === 'sessions') {
                const session = this.sessions.get(id);
                if (session) {
                  this.sessions.set(id, { ...session, ...data });
                }
              }
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
  const replies: string[] = [];

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    reply: async (msg: any) => {
      replies.push(typeof msg === 'string' ? msg : msg.content);
    },
    _getReplies: () => replies,
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
  console.log('🧪 Running /pause Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Successfully pauses active session
  console.log('Test 1: Successfully pauses active session');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user1',
      username: 'alice',
      serverId: 'guild123',
      activity: 'Math homework',
      startTime: Timestamp.now(),
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

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send one reply');
    assert(replies[0].includes('⏸️ Session paused'), 'Should show pause confirmation');
    assert(replies[0].includes('unpause'), 'Should mention unpause command');

    const updatedSession = mockDb.getSession('user1');
    assert(updatedSession?.isPaused === true, 'Session should be paused');
    assert(!!updatedSession?.pausedAt, 'Should set pausedAt timestamp');
    testCount++;
  }

  // Test 2: Fails when no active session exists
  console.log('\nTest 2: Fails when no active session exists');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      userId: 'user2',
      username: 'bob',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send one reply');
    assert(replies[0].includes('No active session'), 'Should indicate no active session');
    testCount++;
  }

  // Test 3: Fails when session is already paused
  console.log('\nTest 3: Fails when session is already paused');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user3',
      username: 'charlie',
      serverId: 'guild123',
      activity: 'Science project',
      startTime: Timestamp.now(),
      isPaused: true,
      pausedAt: Timestamp.now(),
      pausedDuration: 0,
    };
    mockDb.setSession('user3', pausedSession);

    const interaction = createMockInteraction({
      userId: 'user3',
      username: 'charlie',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send one reply');
    assert(replies[0].includes('already paused'), 'Should indicate session is already paused');
    testCount++;
  }

  // Test 4: Command has correct name
  console.log('\nTest 4: Command has correct name');
  {
    assert(command.data.name === 'pause', 'Command name should be pause');
    testCount++;
  }

  // Test 5: Preserves session data when pausing
  console.log('\nTest 5: Preserves session data when pausing');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user4',
      username: 'david',
      serverId: 'guild456',
      activity: 'Reading chapter 5',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 30), // 30 min ago
      isPaused: false,
      pausedDuration: 120, // 2 minutes already paused
    };
    mockDb.setSession('user4', activeSession);

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'david',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const updatedSession = mockDb.getSession('user4');
    assert(updatedSession?.activity === 'Reading chapter 5', 'Should preserve activity');
    assert(updatedSession?.pausedDuration === 120, 'Should preserve pausedDuration');
    assert(updatedSession?.startTime.toMillis() === activeSession.startTime.toMillis(), 'Should preserve startTime');
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
