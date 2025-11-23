/**
 * Unit tests for /unpause Command
 * Run with: npx ts-node src/commands/session/__tests__/unpause.test.ts
 */

import { command } from '../unpause';
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
  console.log('🧪 Running /unpause Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Successfully resumes paused session
  console.log('Test 1: Successfully resumes paused session');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user1',
      username: 'alice',
      serverId: 'guild123',
      activity: 'Math homework',
      startTime: Timestamp.now(),
      isPaused: true,
      pausedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 5), // paused 5 min ago
      pausedDuration: 0,
    };
    mockDb.setSession('user1', pausedSession);

    const interaction = createMockInteraction({
      userId: 'user1',
      username: 'alice',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send one reply');
    assert(replies[0].includes('▶️ Session resumed'), 'Should show resume confirmation');
    assert(replies[0].includes('Keep up the great work'), 'Should encourage user');

    const updatedSession = mockDb.getSession('user1');
    assert(updatedSession?.isPaused === false, 'Session should be resumed');
    assert(!updatedSession?.pausedAt, 'Should clear pausedAt timestamp');
    assert(updatedSession!.pausedDuration > 0, 'Should accumulate paused duration');
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

  // Test 3: Fails when session is not paused
  console.log('\nTest 3: Fails when session is not paused');
  {
    mockDb.reset();

    const activeSession: ActiveSession = {
      userId: 'user3',
      username: 'charlie',
      serverId: 'guild123',
      activity: 'Science project',
      startTime: Timestamp.now(),
      isPaused: false,
      pausedDuration: 0,
    };
    mockDb.setSession('user3', activeSession);

    const interaction = createMockInteraction({
      userId: 'user3',
      username: 'charlie',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send one reply');
    assert(replies[0].includes('not paused'), 'Should indicate session is not paused');
    testCount++;
  }

  // Test 4: Command has correct name
  console.log('\nTest 4: Command has correct name');
  {
    assert(command.data.name === 'unpause', 'Command name should be unpause');
    testCount++;
  }

  // Test 5: Accumulates paused duration correctly
  console.log('\nTest 5: Accumulates paused duration correctly');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user4',
      username: 'david',
      serverId: 'guild456',
      activity: 'Reading chapter 5',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 30), // 30 min ago
      isPaused: true,
      pausedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 10), // paused 10 min ago
      pausedDuration: 120, // 2 minutes already paused
    };
    mockDb.setSession('user4', pausedSession);

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'david',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const updatedSession = mockDb.getSession('user4');
    // Should have 2 minutes (120s) + 10 minutes (600s) = 720s total
    assert(updatedSession!.pausedDuration >= 700, 'Should accumulate paused duration (at least 700s)');
    assert(updatedSession!.pausedDuration <= 730, 'Should accumulate paused duration (at most 730s)');
    testCount++;
  }

  // Test 6: Preserves session data when resuming
  console.log('\nTest 6: Preserves session data when resuming');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user5',
      username: 'eve',
      serverId: 'guild789',
      activity: 'Writing essay',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 45), // 45 min ago
      isPaused: true,
      pausedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 3), // paused 3 min ago
      pausedDuration: 60,
    };
    mockDb.setSession('user5', pausedSession);

    const interaction = createMockInteraction({
      userId: 'user5',
      username: 'eve',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const updatedSession = mockDb.getSession('user5');
    assert(updatedSession?.activity === 'Writing essay', 'Should preserve activity');
    assert(updatedSession?.serverId === 'guild789', 'Should preserve serverId');
    assert(updatedSession?.startTime.toMillis() === pausedSession.startTime.toMillis(), 'Should preserve startTime');
    testCount++;
  }

  // Test 7: Handles session with no previous paused duration
  console.log('\nTest 7: Handles session with no previous paused duration');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user6',
      username: 'frank',
      serverId: 'guild123',
      activity: 'Coding practice',
      startTime: Timestamp.now(),
      isPaused: true,
      pausedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 2), // paused 2 min ago
      pausedDuration: 0, // No previous paused time
    };
    mockDb.setSession('user6', pausedSession);

    const interaction = createMockInteraction({
      userId: 'user6',
      username: 'frank',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const updatedSession = mockDb.getSession('user6');
    assert(updatedSession!.pausedDuration >= 110, 'Should set paused duration (at least 110s)');
    assert(updatedSession!.pausedDuration <= 130, 'Should set paused duration (at most 130s)');
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
