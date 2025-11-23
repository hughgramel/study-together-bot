/**
 * Unit tests for /cancel Command
 * Run with: npx ts-node src/commands/session/__tests__/cancel.test.ts
 */

import { command } from '../cancel';
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
            delete: async () => {
              if (collectionName === 'sessions') {
                this.sessions.delete(id);
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

  hasSession(userId: string): boolean {
    return this.sessions.has(userId);
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
  console.log('🧪 Running /cancel Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Successfully cancels active session
  console.log('Test 1: Successfully cancels active session');
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
    assert(replies[0].includes('❌ Session cancelled'), 'Should show cancel confirmation');
    assert(replies[0].includes('No stats were updated'), 'Should confirm no stats update');
    assert(replies[0].includes('nothing was posted'), 'Should confirm no feed post');

    assert(!mockDb.hasSession('user1'), 'Session should be deleted');
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

  // Test 3: Command has correct name
  console.log('\nTest 3: Command has correct name');
  {
    assert(command.data.name === 'cancel', 'Command name should be cancel');
    testCount++;
  }

  // Test 4: Cancels paused session
  console.log('\nTest 4: Cancels paused session');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user3',
      username: 'charlie',
      serverId: 'guild456',
      activity: 'Reading chapter 5',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 30), // 30 min ago
      isPaused: true,
      pausedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 5), // paused 5 min ago
      pausedDuration: 120,
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
    assert(replies[0].includes('❌ Session cancelled'), 'Should show cancel confirmation');

    assert(!mockDb.hasSession('user3'), 'Session should be deleted');
    testCount++;
  }

  // Test 5: Cancels long-running session
  console.log('\nTest 5: Cancels long-running session');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user4',
      username: 'david',
      serverId: 'guild789',
      activity: 'Deep work marathon',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 180), // 3 hours ago
      isPaused: false,
      pausedDuration: 300, // 5 minutes paused
    };
    mockDb.setSession('user4', activeSession);

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'david',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send one reply');
    assert(replies[0].includes('cancelled'), 'Should show cancel confirmation');

    assert(!mockDb.hasSession('user4'), 'Session should be deleted');
    testCount++;
  }

  // Test 6: Multiple users can cancel their own sessions
  console.log('\nTest 6: Multiple users can cancel their own sessions');
  {
    mockDb.reset();

    // Create sessions for two users
    const session1: ActiveSession = {
      userId: 'user5',
      username: 'eve',
      serverId: 'guild123',
      activity: 'Coding',
      startTime: Timestamp.now(),
      isPaused: false,
      pausedDuration: 0,
    };

    const session2: ActiveSession = {
      userId: 'user6',
      username: 'frank',
      serverId: 'guild123',
      activity: 'Writing',
      startTime: Timestamp.now(),
      isPaused: false,
      pausedDuration: 0,
    };

    mockDb.setSession('user5', session1);
    mockDb.setSession('user6', session2);

    // User5 cancels their session
    const interaction1 = createMockInteraction({
      userId: 'user5',
      username: 'eve',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction1 as any, context);

    assert(!mockDb.hasSession('user5'), 'User5 session should be deleted');
    assert(mockDb.hasSession('user6'), 'User6 session should still exist');

    // User6 cancels their session
    const interaction2 = createMockInteraction({
      userId: 'user6',
      username: 'frank',
    });

    await command.execute(interaction2 as any, context);

    assert(!mockDb.hasSession('user6'), 'User6 session should be deleted');
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
