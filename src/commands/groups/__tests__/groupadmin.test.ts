/**
 * Unit tests for /groupadmin Command
 * Run with: npx ts-node src/commands/groups/__tests__/groupadmin.test.ts
 */

import { command } from '../groupadmin';
import { Group, GroupMembership } from '../../../services/groups';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore with transaction and batch support
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
              if (collectionName === 'memberships') {
                const existing = this.memberships.get(id);
                if (existing) {
                  this.memberships.set(id, { ...existing, ...data });
                }
              }
            },
          }),
          where: (field: string, op: string, value: any) => ({
            get: async () => {
              let results: any[] = [];
              if (collectionName === 'memberships' && field === 'groupId') {
                results = Array.from(this.memberships.entries())
                  .filter(([_, m]) => m.groupId === value)
                  .map(([id, data]) => ({
                    ref: { id },
                    data: () => data,
                  }));
              }
              return {
                docs: results,
                empty: results.length === 0,
                size: results.length,
              };
            },
          }),
        }),
      }),
    };
  }

  batch() {
    const operations: Array<() => void> = [];
    return {
      delete: (ref: any) => {
        operations.push(() => {
          const id = ref.id || ref._id;
          if (ref._path?.includes('active')) {
            this.groups.delete(id);
          }
          if (ref._path?.includes('memberships')) {
            this.memberships.delete(id);
          }
        });
      },
      commit: async () => {
        operations.forEach(op => op());
      },
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
      update: (ref: any, data: any) => {
        const parts = ref._path || [];
        const id = parts[parts.length - 1] || ref._id;

        if (parts.includes('active')) {
          const existing = this.groups.get(id);
          if (existing) {
            this.groups.set(id, { ...existing, ...data });
          }
        }
        if (parts.includes('memberships')) {
          const existing = this.memberships.get(id);
          if (existing) {
            this.memberships.set(id, { ...existing, ...data });
          }
        }
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
    };

    await callback(transaction);
  }

  // Helper methods
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

  countMemberships(): number {
    return this.memberships.size;
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
  subcommand: string;
  targetUserId?: string;
  targetUsername?: string;
}) {
  const replies: string[] = [];
  const edits: string[] = [];
  const components: any[] = [];

  const mockTargetUser = options.targetUserId ? {
    id: options.targetUserId,
    username: options.targetUsername || 'targetuser',
  } : null;

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    options: {
      getSubcommand: () => options.subcommand,
      getUser: (name: string, required?: boolean) => {
        if (name === 'user') return mockTargetUser;
        return null;
      },
    },
    reply: async (msg: any) => {
      replies.push(typeof msg === 'string' ? msg : msg.content);
      if (msg.components) {
        components.push(...msg.components);
      }
    },
    deferReply: async () => {},
    editReply: async (msg: any) => {
      edits.push(typeof msg === 'string' ? msg : msg.content);
    },
    _getReplies: () => replies,
    _getEdits: () => edits,
    _getComponents: () => components,
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
  console.log('🧪 Running /groupadmin Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // ===== DELETE SUBCOMMAND TESTS =====
  console.log('=== Testing DELETE subcommand ===\n');

  // Test 1: Owner can initiate delete with confirmation
  console.log('Test 1: Owner can initiate delete with confirmation');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-DEL1',
      name: 'Delete Test Group',
      ownerId: 'owner1',
      ownerUsername: 'alice',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-DEL1', group);

    const membership: GroupMembership = {
      userId: 'owner1',
      username: 'alice',
      groupId: 'GP-DEL1',
      joinedAt: Timestamp.now(),
      isOwner: true,
    };
    mockDb.setMembership('owner1', membership);

    const interaction = createMockInteraction({
      userId: 'owner1',
      username: 'alice',
      subcommand: 'delete',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send confirmation message');
    assert(replies[0].includes('Are you sure'), 'Should ask for confirmation');
    assert(replies[0].includes('Delete Test Group'), 'Should mention group name');
    assert(replies[0].includes('irreversible'), 'Should warn about irreversibility');

    const components = interaction._getComponents();
    assert(components.length > 0, 'Should include confirmation buttons');
    testCount++;
  }

  // Test 2: Non-owner cannot delete
  console.log('\nTest 2: Non-owner cannot delete group');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-DEL2',
      name: 'Protected Group',
      ownerId: 'owner2',
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
    mockDb.setGroup('GP-DEL2', group);

    const membership: GroupMembership = {
      userId: 'user2',
      username: 'bob',
      groupId: 'GP-DEL2',
      joinedAt: Timestamp.now(),
      isOwner: false,
    };
    mockDb.setMembership('user2', membership);

    const interaction = createMockInteraction({
      userId: 'user2',
      username: 'bob',
      subcommand: 'delete',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies[0].includes('Only the group owner'), 'Should reject non-owner');
    testCount++;
  }

  // ===== KICK SUBCOMMAND TESTS =====
  console.log('\n=== Testing KICK subcommand ===\n');

  // Test 3: Owner can kick member
  console.log('Test 3: Owner can kick member from group');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-KICK',
      name: 'Kick Test Group',
      ownerId: 'owner3',
      ownerUsername: 'charlie',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 2,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-KICK', group);

    mockDb.setMembership('owner3', {
      userId: 'owner3',
      username: 'charlie',
      groupId: 'GP-KICK',
      joinedAt: Timestamp.now(),
      isOwner: true,
    });

    mockDb.setMembership('target3', {
      userId: 'target3',
      username: 'david',
      groupId: 'GP-KICK',
      joinedAt: Timestamp.now(),
      isOwner: false,
    });

    const interaction = createMockInteraction({
      userId: 'owner3',
      username: 'charlie',
      subcommand: 'kick',
      targetUserId: 'target3',
      targetUsername: 'david',
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
    assert(edits[0].includes('removed'), 'Should confirm removal');
    assert(edits[0].includes('david'), 'Should mention kicked user');

    assert(!mockDb.getMembership('target3'), 'Member should be removed');
    assert(mockDb.getGroup('GP-KICK')!.memberCount === 1, 'Member count should decrease');
    testCount++;
  }

  // Test 4: Owner cannot kick self
  console.log('\nTest 4: Owner cannot kick themselves');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-SELF',
      name: 'Self Kick Group',
      ownerId: 'owner4',
      ownerUsername: 'eve',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-SELF', group);

    mockDb.setMembership('owner4', {
      userId: 'owner4',
      username: 'eve',
      groupId: 'GP-SELF',
      joinedAt: Timestamp.now(),
      isOwner: true,
    });

    const interaction = createMockInteraction({
      userId: 'owner4',
      username: 'eve',
      subcommand: 'kick',
      targetUserId: 'owner4',
      targetUsername: 'eve',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('cannot kick yourself'), 'Should reject self-kick');
    testCount++;
  }

  // Test 5: Only owner can kick
  console.log('\nTest 5: Only owner can kick members');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-PERM',
      name: 'Permission Group',
      ownerId: 'owner5',
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
    mockDb.setGroup('GP-PERM', group);

    mockDb.setMembership('member5', {
      userId: 'member5',
      username: 'frank',
      groupId: 'GP-PERM',
      joinedAt: Timestamp.now(),
      isOwner: false,
    });

    const interaction = createMockInteraction({
      userId: 'member5',
      username: 'frank',
      subcommand: 'kick',
      targetUserId: 'other5',
      targetUsername: 'grace',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('Only the group owner'), 'Should reject non-owner');
    testCount++;
  }

  // ===== TRANSFER SUBCOMMAND TESTS =====
  console.log('\n=== Testing TRANSFER subcommand ===\n');

  // Test 6: Owner can transfer to member
  console.log('Test 6: Owner can transfer ownership to member');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-TRAN',
      name: 'Transfer Group',
      ownerId: 'owner6',
      ownerUsername: 'henry',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 2,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-TRAN', group);

    mockDb.setMembership('owner6', {
      userId: 'owner6',
      username: 'henry',
      groupId: 'GP-TRAN',
      joinedAt: Timestamp.now(),
      isOwner: true,
    });

    mockDb.setMembership('newowner6', {
      userId: 'newowner6',
      username: 'iris',
      groupId: 'GP-TRAN',
      joinedAt: Timestamp.now(),
      isOwner: false,
    });

    const interaction = createMockInteraction({
      userId: 'owner6',
      username: 'henry',
      subcommand: 'transfer',
      targetUserId: 'newowner6',
      targetUsername: 'iris',
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
    assert(edits[0].includes('now the owner'), 'Should confirm transfer');
    assert(edits[0].includes('iris'), 'Should mention new owner');

    const newOwnerMembership = mockDb.getMembership('newowner6');
    const oldOwnerMembership = mockDb.getMembership('owner6');

    assert(newOwnerMembership!.isOwner === true, 'New owner should have isOwner = true');
    assert(oldOwnerMembership!.isOwner === false, 'Old owner should have isOwner = false');

    const updatedGroup = mockDb.getGroup('GP-TRAN');
    assert(updatedGroup!.ownerId === 'newowner6', 'Group ownerId should be updated');
    assert(updatedGroup!.ownerUsername === 'iris', 'Group ownerUsername should be updated');
    testCount++;
  }

  // Test 7: Cannot transfer to non-member
  console.log('\nTest 7: Cannot transfer to non-member');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-NONM',
      name: 'Non-Member Group',
      ownerId: 'owner7',
      ownerUsername: 'jack',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-NONM', group);

    mockDb.setMembership('owner7', {
      userId: 'owner7',
      username: 'jack',
      groupId: 'GP-NONM',
      joinedAt: Timestamp.now(),
      isOwner: true,
    });

    const interaction = createMockInteraction({
      userId: 'owner7',
      username: 'jack',
      subcommand: 'transfer',
      targetUserId: 'outsider7',
      targetUsername: 'kate',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('not in any group'), 'Should reject transfer to non-member');
    testCount++;
  }

  // Test 8: Cannot transfer to self
  console.log('\nTest 8: Cannot transfer to self');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-SELF2',
      name: 'Self Transfer Group',
      ownerId: 'owner8',
      ownerUsername: 'leo',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 0,
      level: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-SELF2', group);

    mockDb.setMembership('owner8', {
      userId: 'owner8',
      username: 'leo',
      groupId: 'GP-SELF2',
      joinedAt: Timestamp.now(),
      isOwner: true,
    });

    const interaction = createMockInteraction({
      userId: 'owner8',
      username: 'leo',
      subcommand: 'transfer',
      targetUserId: 'owner8',
      targetUsername: 'leo',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('already the owner'), 'Should reject self-transfer');
    testCount++;
  }

  // Test 9: Command has correct name and subcommands
  console.log('\nTest 9: Command has correct name and subcommands');
  {
    assert(command.data.name === 'groupadmin', 'Command name should be groupadmin');

    const subcommands = (command.data as any).options.filter((opt: any) => opt.type === 1);
    const subcommandNames = subcommands.map((sc: any) => sc.name);

    assert(subcommandNames.includes('delete'), 'Should have delete subcommand');
    assert(subcommandNames.includes('kick'), 'Should have kick subcommand');
    assert(subcommandNames.includes('transfer'), 'Should have transfer subcommand');
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
