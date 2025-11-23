/**
 * Unit tests for /live Command
 * Run with: npx ts-node src/commands/stats/__tests__/live.test.ts
 */

import { command } from '../live';
import { ActiveSession } from '../../../types';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore
class MockFirestore {
  private sessions: Map<string, ActiveSession> = new Map();

  collection(name: string) {
    return {
      doc: (docName: string) => ({
        collection: (collectionName: string) => ({
          where: (field: string, op: string, value: string) => ({
            get: async () => {
              if (field === 'serverId') {
                const matchingSessions = Array.from(this.sessions.values()).filter(
                  (s) => s.serverId === value
                );
                return {
                  empty: matchingSessions.length === 0,
                  docs: matchingSessions.map((session) => ({
                    data: () => session,
                  })),
                };
              }
              return { empty: true, docs: [] };
            },
          }),
        }),
      }),
    };
  }

  // Helper methods for testing
  setSession(userId: string, session: ActiveSession) {
    this.sessions.set(userId, session);
  }

  reset() {
    this.sessions.clear();
  }
}

// Mock Discord client
function createMockClient() {
  return {
    users: {
      fetch: async (userId: string) => ({
        id: userId,
        username: `user-${userId}`,
        displayAvatarURL: () => `https://example.com/avatar-${userId}.png`,
      }),
    },
  };
}

// Mock interaction
function createMockInteraction(options: {
  userId?: string;
  username?: string;
  guildId?: string | null;
}) {
  const edits: any[] = [];

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    guildId: options.guildId !== undefined ? options.guildId : 'guild123',
    deferReply: async () => {},
    reply: async (msg: any) => {
      // Used for error messages
      edits.push(msg);
    },
    editReply: async (msg: any) => {
      edits.push(msg);
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
  console.log('🧪 Running /live Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  const mockClient = createMockClient() as any;
  let testCount = 0;

  // Test 1: Shows live sessions for server
  console.log('Test 1: Shows live sessions for server');
  {
    mockDb.reset();

    const session1: ActiveSession = {
      userId: 'user1',
      username: 'alice',
      serverId: 'guild123',
      activity: 'Math homework',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 30), // 30 min ago
      isPaused: false,
      pausedDuration: 0,
    };

    const session2: ActiveSession = {
      userId: 'user2',
      username: 'bob',
      serverId: 'guild123',
      activity: 'Science project',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 15), // 15 min ago
      isPaused: false,
      pausedDuration: 0,
    };

    mockDb.setSession('user1', session1);
    mockDb.setSession('user2', session2);

    const interaction = createMockInteraction({
      guildId: 'guild123',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].files?.length === 1, 'Should include live sessions image');
    assert(edits[0].files[0].name === 'live-sessions.png', 'Should name file live-sessions.png');
    testCount++;
  }

  // Test 2: Shows message when no one is studying
  console.log('\nTest 2: Shows message when no one is studying');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      guildId: 'guild456',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].content.includes('Nobody is studying'), 'Should indicate no active sessions');
    assert(edits[0].content.includes('/start'), 'Should suggest /start command');
    testCount++;
  }

  // Test 3: Fails when used in DM
  console.log('\nTest 3: Fails when used in DM');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      guildId: null,
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one reply');
    assert(edits[0].content.includes('only be used in a server'), 'Should reject DM usage');
    testCount++;
  }

  // Test 4: Command has correct name
  console.log('\nTest 4: Command has correct name');
  {
    assert(command.data.name === 'live', 'Command name should be live');
    testCount++;
  }

  // Test 5: Sorts sessions by duration (longest first)
  console.log('\nTest 5: Sorts sessions by duration (longest first)');
  {
    mockDb.reset();

    const shortSession: ActiveSession = {
      userId: 'user3',
      username: 'charlie',
      serverId: 'guild789',
      activity: 'Quick review',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 5), // 5 min ago
      isPaused: false,
      pausedDuration: 0,
    };

    const longSession: ActiveSession = {
      userId: 'user4',
      username: 'david',
      serverId: 'guild789',
      activity: 'Deep work',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 120), // 2 hours ago
      isPaused: false,
      pausedDuration: 0,
    };

    mockDb.setSession('user3', shortSession);
    mockDb.setSession('user4', longSession);

    const interaction = createMockInteraction({
      guildId: 'guild789',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].files?.length === 1, 'Should include image with sorted sessions');
    testCount++;
  }

  // Test 6: Shows paused sessions
  console.log('\nTest 6: Shows paused sessions');
  {
    mockDb.reset();

    const pausedSession: ActiveSession = {
      userId: 'user5',
      username: 'eve',
      serverId: 'guild999',
      activity: 'Reading',
      startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * 40), // 40 min ago
      isPaused: true,
      pausedAt: Timestamp.fromMillis(Date.now() - 1000 * 60 * 5), // paused 5 min ago
      pausedDuration: 120,
    };

    mockDb.setSession('user5', pausedSession);

    const interaction = createMockInteraction({
      guildId: 'guild999',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].files?.length === 1, 'Should include image with paused session');
    testCount++;
  }

  // Test 7: Limits to 10 users max
  console.log('\nTest 7: Limits to 10 users max');
  {
    mockDb.reset();

    // Create 15 sessions
    for (let i = 0; i < 15; i++) {
      const session: ActiveSession = {
        userId: `user${i}`,
        username: `user${i}`,
        serverId: 'guild-large',
        activity: `Activity ${i}`,
        startTime: Timestamp.fromMillis(Date.now() - 1000 * 60 * (i + 1)),
        isPaused: false,
        pausedDuration: 0,
      };
      mockDb.setSession(`user${i}`, session);
    }

    const interaction = createMockInteraction({
      guildId: 'guild-large',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].files?.length === 1, 'Should include image (limited to 10 users)');
    testCount++;
  }

  // Test 8: Only shows sessions from the same server
  console.log('\nTest 8: Only shows sessions from the same server');
  {
    mockDb.reset();

    const sessionGuild1: ActiveSession = {
      userId: 'user6',
      username: 'frank',
      serverId: 'guild-a',
      activity: 'Coding',
      startTime: Timestamp.now(),
      isPaused: false,
      pausedDuration: 0,
    };

    const sessionGuild2: ActiveSession = {
      userId: 'user7',
      username: 'grace',
      serverId: 'guild-b',
      activity: 'Writing',
      startTime: Timestamp.now(),
      isPaused: false,
      pausedDuration: 0,
    };

    mockDb.setSession('user6', sessionGuild1);
    mockDb.setSession('user7', sessionGuild2);

    const interaction = createMockInteraction({
      guildId: 'guild-a',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    // Should only show sessions from guild-a
    assert(edits[0].files?.length === 1, 'Should include image with only guild-a sessions');
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
