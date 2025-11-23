/**
 * Unit tests for /leavegroup Command
 * Run with: npx ts-node src/commands/groups/__tests__/leavegroup.test.ts
 */

import { command } from '../leavegroup';
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
            delete: async () => {
              if (collectionName === 'active') {
                this.groups.delete(id);
              }
              if (collectionName === 'memberships') {
                this.memberships.delete(id);
              }
            },
            update: async (data: any) => {
              if (collectionName === 'active') {
                const existing = this.groups.get(id);
                if (existing) {
                  this.groups.set(id, { ...existing, ...data });
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
      delete: (ref: any) => {
        const parts = ref._path || [];
        const id = parts[parts.length - 1] || ref._id;

        if (parts.includes('active')) {
          this.groups.delete(id);
        }
        if (parts.includes('memberships')) {
          this.memberships.delete(id);
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

  getAllMemberships(): GroupMembership[] {
    return Array.from(this.memberships.values());
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
  console.log('🧪 Running /leavegroup Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Non-owner successfully leaves
  console.log('Test 1: Non-owner successfully leaves group');
  {
    mockDb.reset();

    // Create a group
    const group: Group = {
      groupId: 'GP-TEST',
      name: 'Test Group',
      ownerId: 'owner1',
      ownerUsername: 'owner',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 2,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-TEST', group);

    // Create membership for non-owner
    const membership: GroupMembership = {
      userId: 'user1',
      username: 'alice',
      groupId: 'GP-TEST',
      joinedAt: Timestamp.now(),
      isOwner: false,
    };
    mockDb.setMembership('user1', membership);

    const interaction = createMockInteraction({
      userId: 'user1',
      username: 'alice',
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
    assert(edits[0].includes('left'), 'Should show success message');
    assert(edits[0].includes('Test Group'), 'Should mention group name');

    const removedMembership = mockDb.getMembership('user1');
    assert(!removedMembership, 'Membership should be deleted');

    const updatedGroup = mockDb.getGroup('GP-TEST');
    assert(updatedGroup!.memberCount === 1, 'Group member count should decrease');
    testCount++;
  }

  // Test 2: Owner fails to leave (must transfer first)
  console.log('\nTest 2: Owner cannot leave without transferring ownership');
  {
    mockDb.reset();

    // Create a group
    const group: Group = {
      groupId: 'GP-OWNR',
      name: 'Owner Group',
      ownerId: 'user2',
      ownerUsername: 'bob',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 2,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-OWNR', group);

    // Create membership for owner
    const membership: GroupMembership = {
      userId: 'user2',
      username: 'bob',
      groupId: 'GP-OWNR',
      joinedAt: Timestamp.now(),
      isOwner: true,
    };
    mockDb.setMembership('user2', membership);

    const interaction = createMockInteraction({
      userId: 'user2',
      username: 'bob',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('owner'), 'Should indicate user is owner');
    assert(edits[0].includes('cannot leave'), 'Should reject owner leaving');
    assert(edits[0].includes('Transfer ownership'), 'Should suggest transferring');
    assert(edits[0].includes('Delete the group'), 'Should suggest deleting');

    const stillExists = mockDb.getMembership('user2');
    assert(!!stillExists, 'Membership should still exist');
    testCount++;
  }

  // Test 3: Group auto-deletes when last member leaves
  console.log('\nTest 3: Group auto-deletes when last member leaves');
  {
    mockDb.reset();

    // Create a group with one member
    const group: Group = {
      groupId: 'GP-LAST',
      name: 'Last Member Group',
      ownerId: 'owner3',
      ownerUsername: 'charlie',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-LAST', group);

    // Create membership for the only member (non-owner scenario)
    const membership: GroupMembership = {
      userId: 'user3',
      username: 'charlie',
      groupId: 'GP-LAST',
      joinedAt: Timestamp.now(),
      isOwner: false,
    };
    mockDb.setMembership('user3', membership);

    const interaction = createMockInteraction({
      userId: 'user3',
      username: 'charlie',
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

    const groupDeleted = !mockDb.getGroup('GP-LAST');
    assert(groupDeleted, 'Group should be auto-deleted when last member leaves');

    const membershipDeleted = !mockDb.getMembership('user3');
    assert(membershipDeleted, 'Membership should be deleted');
    testCount++;
  }

  // Test 4: Fails if user not in a group
  console.log('\nTest 4: Fails if user not in a group');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'david',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('not in a group'), 'Should reject if not in group');
    testCount++;
  }

  // Test 5: Command has correct name
  console.log('\nTest 5: Command has correct name');
  {
    assert(command.data.name === 'leavegroup', 'Command name should be leavegroup');
    testCount++;
  }

  // Test 6: Cleans up membership when group was deleted
  console.log('\nTest 6: Cleans up orphaned membership if group was deleted');
  {
    mockDb.reset();

    // Create orphaned membership (group doesn't exist)
    const membership: GroupMembership = {
      userId: 'user6',
      username: 'frank',
      groupId: 'GP-GONE',
      joinedAt: Timestamp.now(),
      isOwner: false,
    };
    mockDb.setMembership('user6', membership);
    // Note: Not creating the group, simulating it was deleted

    const interaction = createMockInteraction({
      userId: 'user6',
      username: 'frank',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    // The getUserGroup method should clean up orphaned memberships
    // and return null, so we should get "not in a group" message
    assert(edits[0].includes('not in a group'), 'Should handle orphaned membership');
    testCount++;
  }

  // Test 7: Multiple members can leave sequentially
  console.log('\nTest 7: Multiple members can leave sequentially');
  {
    mockDb.reset();

    // Create a group with 3 members
    const group: Group = {
      groupId: 'GP-MULT',
      name: 'Multi Member Group',
      ownerId: 'owner7',
      ownerUsername: 'owner',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 3,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-MULT', group);

    // Create memberships
    mockDb.setMembership('owner7', {
      userId: 'owner7',
      username: 'owner',
      groupId: 'GP-MULT',
      joinedAt: Timestamp.now(),
      isOwner: true,
    });

    mockDb.setMembership('user7a', {
      userId: 'user7a',
      username: 'grace',
      groupId: 'GP-MULT',
      joinedAt: Timestamp.now(),
      isOwner: false,
    });

    mockDb.setMembership('user7b', {
      userId: 'user7b',
      username: 'henry',
      groupId: 'GP-MULT',
      joinedAt: Timestamp.now(),
      isOwner: false,
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

    // First member leaves
    const interaction1 = createMockInteraction({
      userId: 'user7a',
      username: 'grace',
    });
    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction1 as any, context);

    assert(!mockDb.getMembership('user7a'), 'First member should be removed');
    assert(mockDb.getGroup('GP-MULT')!.memberCount === 2, 'Count should be 2');

    // Second member leaves
    const interaction2 = createMockInteraction({
      userId: 'user7b',
      username: 'henry',
    });
    await command.execute(interaction2 as any, context);

    assert(!mockDb.getMembership('user7b'), 'Second member should be removed');
    assert(mockDb.getGroup('GP-MULT')!.memberCount === 1, 'Count should be 1');
    assert(!!mockDb.getGroup('GP-MULT'), 'Group should still exist with owner');

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
