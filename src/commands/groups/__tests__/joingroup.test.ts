/**
 * Unit tests for /joingroup Command
 * Run with: npx ts-node src/commands/groups/__tests__/joingroup.test.ts
 */

import { command } from '../joingroup';
import { Group, GroupMembership } from '../../../services/groups';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore with transaction support
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
                  id,
                };
              }
              if (collectionName === 'memberships') {
                const membership = this.memberships.get(id);
                return {
                  exists: !!membership,
                  data: () => membership,
                  id,
                };
              }
              return { exists: false, data: () => null, id };
            },
            set: async (data: any) => {
              if (collectionName === 'active') {
                this.groups.set(id, data);
              }
              if (collectionName === 'memberships') {
                this.memberships.set(id, data);
              }
            },
            update: async (data: any) => {
              if (collectionName === 'active') {
                const existing = this.groups.get(id);
                if (existing) {
                  this.groups.set(id, { ...existing, ...data });
                }
              }
              if (collectionName === 'memberships') {
                const existing = this.memberships.get(id);
                if (existing) {
                  this.memberships.set(id, { ...existing, ...data });
                }
              }
            },
          }),
        }),
      }),
    };
  }

  async runTransaction(callback: any) {
    const transaction = {
      get: async (ref: any) => {
        const parts = ref._path || [];
        const id = parts[parts.length - 1] || ref._id;

        if (parts.includes('active')) {
          const group = this.groups.get(id);
          return {
            exists: !!group,
            data: () => group,
            ref,
          };
        }
        if (parts.includes('memberships')) {
          const membership = this.memberships.get(id);
          return {
            exists: !!membership,
            data: () => membership,
            ref,
          };
        }
        return { exists: false, data: () => null, ref };
      },
      set: (ref: any, data: any) => {
        const parts = ref._path || [];
        const id = parts[parts.length - 1] || ref._id;

        if (parts.includes('active')) {
          this.groups.set(id, data);
        }
        if (parts.includes('memberships')) {
          this.memberships.set(id, data);
        }
      },
      update: (ref: any, data: any) => {
        const parts = ref._path || [];
        const id = parts[parts.length - 1] || ref._id;

        if (parts.includes('active')) {
          const existing = this.groups.get(id);
          if (existing) {
            this.groups.set(id, { ...existing, ...data });
          }
        }
      },
    };

    await callback(transaction);
  }

  // Helper methods for testing
  setGroup(id: string, group: Group) {
    this.groups.set(id, group);
  }

  getGroup(id: string): Group | undefined {
    return this.groups.get(id);
  }

  setMembership(userId: string, membership: GroupMembership) {
    this.memberships.set(userId, membership);
  }

  getMembership(userId: string): GroupMembership | undefined {
    return this.memberships.get(userId);
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
  groupId?: string;
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
        if (name === 'group_id') return options.groupId?.toUpperCase() || 'GP-TEST';
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
  console.log('🧪 Running /joingroup Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Successfully joins public group
  console.log('Test 1: Successfully joins public group');
  {
    mockDb.reset();

    // Create a public group
    const group: Group = {
      groupId: 'GP-TEST',
      name: 'Test Group',
      ownerId: 'owner1',
      ownerUsername: 'owner',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-TEST', group);

    const interaction = createMockInteraction({
      userId: 'user1',
      username: 'alice',
      groupId: 'gp-test', // Test case insensitivity
    });

    // Mock the collection().doc().collection().doc() chain for transaction
    const originalCollection = mockDb.collection.bind(mockDb);
    mockDb.collection = (name: string) => {
      const col = originalCollection(name);
      col.doc = (docName: string) => {
        const doc = {
          collection: (collectionName: string) => {
            const subCol = {
              doc: (id: string) => {
                const ref = {
                  _path: ['discord-data', docName, collectionName, id],
                  _id: id,
                };
                return ref;
              },
            };
            return subCol;
          },
        };
        return doc;
      };
      return col;
    };

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit reply');
    assert(edits[0].includes('Joined'), 'Should show success message');
    assert(edits[0].includes('Test Group'), 'Should include group name');

    const membership = mockDb.getMembership('user1');
    assert(!!membership, 'Should create membership for user');
    assert(membership.groupId === 'GP-TEST', 'Membership should reference correct group');
    assert(membership.isOwner === false, 'New member should not be owner');

    const updatedGroup = mockDb.getGroup('GP-TEST');
    assert(updatedGroup!.memberCount === 2, 'Group member count should increase');
    testCount++;
  }

  // Test 2: Fails to join private group
  console.log('\nTest 2: Fails to join private group');
  {
    mockDb.reset();

    // Create a private group
    const group: Group = {
      groupId: 'GP-PRIV',
      name: 'Private Group',
      ownerId: 'owner2',
      ownerUsername: 'owner',
      serverId: 'guild123',
      isPublic: false,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-PRIV', group);

    const interaction = createMockInteraction({
      userId: 'user2',
      username: 'bob',
      groupId: 'GP-PRIV',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('private group'), 'Should reject private group join');
    assert(edits[0].includes('Private Group'), 'Should mention group name');
    testCount++;
  }

  // Test 3: Fails if group is full
  console.log('\nTest 3: Fails if group is full');
  {
    mockDb.reset();

    // Create a full group
    const group: Group = {
      groupId: 'GP-FULL',
      name: 'Full Group',
      ownerId: 'owner3',
      ownerUsername: 'owner',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 5,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-FULL', group);

    const interaction = createMockInteraction({
      userId: 'user3',
      username: 'charlie',
      groupId: 'GP-FULL',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('full'), 'Should reject full group');
    assert(edits[0].includes('5/5'), 'Should show capacity');
    testCount++;
  }

  // Test 4: Fails if user already in a group
  console.log('\nTest 4: Fails if user already in a group');
  {
    mockDb.reset();

    // Create target group
    const targetGroup: Group = {
      groupId: 'GP-TARG',
      name: 'Target Group',
      ownerId: 'owner4',
      ownerUsername: 'owner',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-TARG', targetGroup);

    // Create existing group
    const existingGroup: Group = {
      groupId: 'GP-EXST',
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
    mockDb.setGroup('GP-EXST', existingGroup);

    // User already in a group
    const existingMembership: GroupMembership = {
      userId: 'user4',
      username: 'david',
      groupId: 'GP-EXST',
      joinedAt: Timestamp.now(),
      isOwner: true,
    };
    mockDb.setMembership('user4', existingMembership);

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'david',
      groupId: 'GP-TARG',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('already in a group'), 'Should reject if already in group');
    assert(edits[0].includes('Existing Group'), 'Should mention current group name');
    testCount++;
  }

  // Test 5: Fails if group doesn't exist
  console.log('\nTest 5: Fails if group doesn\'t exist');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      userId: 'user5',
      username: 'eve',
      groupId: 'GP-NONE',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('not found'), 'Should reject non-existent group');
    assert(edits[0].includes('GP-NONE'), 'Should mention group ID');
    testCount++;
  }

  // Test 6: Fails if not in a guild
  console.log('\nTest 6: Fails if not in a guild');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      userId: 'user6',
      username: 'frank',
      guildId: null,
      groupId: 'GP-TEST',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send a reply');
    assert(replies[0].includes('only be used in a server'), 'Should reject DM usage');
    testCount++;
  }

  // Test 7: Fails if group belongs to different server
  console.log('\nTest 7: Fails if group belongs to different server');
  {
    mockDb.reset();

    // Create group in different server
    const group: Group = {
      groupId: 'GP-OTHR',
      name: 'Other Server Group',
      ownerId: 'owner7',
      ownerUsername: 'owner',
      serverId: 'guild999', // Different server
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-OTHR', group);

    const interaction = createMockInteraction({
      userId: 'user7',
      username: 'grace',
      guildId: 'guild123',
      groupId: 'GP-OTHR',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('different server'), 'Should reject cross-server join');
    testCount++;
  }

  // Test 8: Command has correct name
  console.log('\nTest 8: Command has correct name');
  {
    assert(command.data.name === 'joingroup', 'Command name should be joingroup');
    testCount++;
  }

  // Test 9: Converts group ID to uppercase
  console.log('\nTest 9: Converts group ID to uppercase');
  {
    mockDb.reset();

    // Create a public group
    const group: Group = {
      groupId: 'GP-UPPR',
      name: 'Uppercase Group',
      ownerId: 'owner9',
      ownerUsername: 'owner',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-UPPR', group);

    const interaction = createMockInteraction({
      userId: 'user9',
      username: 'henry',
      groupId: 'gp-uppr', // lowercase input
    });

    // Mock the collection().doc().collection().doc() chain for transaction
    const originalCollection = mockDb.collection.bind(mockDb);
    mockDb.collection = (name: string) => {
      const col = originalCollection(name);
      col.doc = (docName: string) => {
        const doc = {
          collection: (collectionName: string) => {
            const subCol = {
              doc: (id: string) => {
                const ref = {
                  _path: ['discord-data', docName, collectionName, id],
                  _id: id,
                };
                return ref;
              },
            };
            return subCol;
          },
        };
        return doc;
      };
      return col;
    };

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('Joined'), 'Should successfully join with lowercase input');
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
