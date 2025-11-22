/**
 * Unit tests for /creategroup Command
 * Run with: npx ts-node src/commands/groups/__tests__/creategroup.test.ts
 */

import { command } from '../creategroup';
import { GroupService, Group, GroupMembership } from '../../../services/groups';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore
class MockFirestore {
  private groups: Map<string, Group> = new Map();
  private memberships: Map<string, GroupMembership> = new Map();

  collection(name: string) {
    return {
      doc: (docName: string) => ({
        collection: (collectionName: string) => ({
          doc: (id: string) => ({
            get: async () => {
              if (collectionName === 'active') {
                const group = this.groups.get(id);
                return {
                  exists: !!group,
                  data: () => group,
                };
              }
              if (collectionName === 'memberships') {
                const membership = this.memberships.get(id);
                return {
                  exists: !!membership,
                  data: () => membership,
                };
              }
              return { exists: false, data: () => null };
            },
            set: async (data: any) => {
              if (collectionName === 'active') {
                this.groups.set(id, data);
              }
              if (collectionName === 'memberships') {
                this.memberships.set(id, data);
              }
            },
          }),
        }),
      }),
    };
  }

  // Helper methods for testing
  getGroup(id: string): Group | undefined {
    return this.groups.get(id);
  }

  getMembership(userId: string): GroupMembership | undefined {
    return this.memberships.get(userId);
  }

  setMembership(userId: string, membership: GroupMembership) {
    this.memberships.set(userId, membership);
  }

  reset() {
    this.groups.clear();
    this.memberships.clear();
  }
}

// Mock interaction
function createMockInteraction(options: {
  userId?: string;
  username?: string;
  guildId?: string | null;
  groupName?: string;
  isPublic?: boolean;
}) {
  const replies: string[] = [];
  const edits: string[] = [];

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    guildId: options.guildId !== undefined ? options.guildId : 'guild123',
    options: {
      getString: (name: string, required?: boolean) => {
        if (name === 'name') return options.groupName || 'Test Group';
        return null;
      },
      getBoolean: (name: string) => {
        if (name === 'public') return options.isPublic;
        return null;
      },
    },
    reply: async (msg: any) => {
      replies.push(typeof msg === 'string' ? msg : msg.content);
    },
    deferReply: async () => {},
    editReply: async (msg: any) => {
      edits.push(typeof msg === 'string' ? msg : msg.content);
    },
    _getReplies: () => replies,
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
  console.log('🧪 Running /creategroup Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Successfully creates public group
  console.log('Test 1: Successfully creates public group');
  {
    mockDb.reset();
    const interaction = createMockInteraction({
      userId: 'user1',
      username: 'alice',
      groupName: 'Study Squad',
      isPublic: true,
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit reply');
    assert(edits[0].includes('Group Created'), 'Should show success message');
    assert(edits[0].includes('Study Squad'), 'Should include group name');
    assert(edits[0].includes('Public'), 'Should indicate public group');

    const membership = mockDb.getMembership('user1');
    assert(!!membership, 'Should create membership for user');
    assert(membership.isOwner === true, 'User should be owner');
    testCount++;
  }

  // Test 2: Successfully creates private group
  console.log('\nTest 2: Successfully creates private group');
  {
    mockDb.reset();
    const interaction = createMockInteraction({
      userId: 'user2',
      username: 'bob',
      groupName: 'Private Study',
      isPublic: false,
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('Private'), 'Should indicate private group');
    testCount++;
  }

  // Test 3: Defaults to public when isPublic not specified
  console.log('\nTest 3: Defaults to public when isPublic not specified');
  {
    mockDb.reset();
    const interaction = createMockInteraction({
      userId: 'user3',
      username: 'charlie',
      groupName: 'Default Group',
      isPublic: undefined,
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('Public'), 'Should default to public');
    testCount++;
  }

  // Test 4: Fails if user already in a group
  console.log('\nTest 4: Fails if user already in a group');
  {
    mockDb.reset();

    // Create existing membership
    const existingMembership: GroupMembership = {
      userId: 'user4',
      username: 'david',
      groupId: 'GP-TEST',
      joinedAt: Timestamp.now(),
      isOwner: true,
    };
    mockDb.setMembership('user4', existingMembership);

    // Create existing group
    const groupService = new GroupService(mockDb);
    const existingGroup: Group = {
      groupId: 'GP-TEST',
      name: 'Existing Group',
      ownerId: 'user4',
      ownerUsername: 'david',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await mockDb.collection('discord-data').doc('groups').collection('active').doc('GP-TEST').set(existingGroup);

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'david',
      groupName: 'New Group',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('already in a group'), 'Should reject if already in group');
    assert(edits[0].includes('Existing Group'), 'Should mention current group name');
    testCount++;
  }

  // Test 5: Validates group name length
  console.log('\nTest 5: Command defines max length for group name');
  {
    assert(
      command.data.options.some((opt: any) => opt.name === 'name' && opt.max_length === 50),
      'Group name should have 50 character limit'
    );
    testCount++;
  }

  // Test 6: Fails if not in a guild
  console.log('\nTest 6: Fails if not in a guild');
  {
    mockDb.reset();
    const interaction = createMockInteraction({
      userId: 'user5',
      username: 'eve',
      guildId: null,
      groupName: 'Test Group',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send a reply');
    assert(replies[0].includes('only be used in a server'), 'Should reject DM usage');
    testCount++;
  }

  // Test 7: Creates unique group IDs
  console.log('\nTest 7: Creates unique group IDs');
  {
    mockDb.reset();
    const groupIds = new Set<string>();

    for (let i = 0; i < 5; i++) {
      const interaction = createMockInteraction({
        userId: `user${i}`,
        username: `user${i}`,
        groupName: `Group ${i}`,
      });

      const context = { db: mockDb, client: {} as any };
      await command.execute(interaction as any, context);

      const membership = mockDb.getMembership(`user${i}`);
      assert(!!membership, `Should create membership for user${i}`);

      const groupId = membership.groupId;
      assert(!groupIds.has(groupId), `Group ID ${groupId} should be unique`);
      assert(groupId.startsWith('GP-'), 'Group ID should start with GP-');
      assert(groupId.length === 7, 'Group ID should be 7 characters (GP-XXXX)');
      groupIds.add(groupId);
    }
    testCount++;
  }

  // Test 8: Command has correct name
  console.log('\nTest 8: Command has correct name');
  {
    assert(command.data.name === 'creategroup', 'Command name should be creategroup');
    testCount++;
  }

  // Test 9: Sets maxMembers to 5
  console.log('\nTest 9: Sets maxMembers to 5');
  {
    mockDb.reset();
    const interaction = createMockInteraction({
      userId: 'user6',
      username: 'frank',
      groupName: 'Test Group',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('Max 5 members'), 'Should indicate max 5 members');
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
