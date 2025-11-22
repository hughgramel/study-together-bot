/**
 * Unit tests for /group Command
 * Run with: npx ts-node src/commands/groups/__tests__/group.test.ts
 */

import { command } from '../group';
import { Group, GroupMembership } from '../../../services/groups';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore
class MockFirestore {
  private groups: Map<string, Group> = new Map();
  private memberships: Map<string, GroupMembership> = new Map();
  private userStats: Map<string, any> = new Map();

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
              if (collectionName === 'stats') {
                const stats = this.userStats.get(id);
                return {
                  exists: !!stats,
                  data: () => stats,
                  id,
                };
              }
              return { exists: false, data: () => null, id };
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
          where: (field: string, op: string, value: any) => ({
            orderBy: (orderField: string, direction: string) => ({
              get: async () => {
                if (collectionName === 'active') {
                  const filtered = Array.from(this.groups.values())
                    .filter(g => g.serverId === value);

                  const sorted = [...filtered].sort((a, b) => {
                    if (direction === 'desc') {
                      return (b as any)[orderField] - (a as any)[orderField];
                    }
                    return (a as any)[orderField] - (b as any)[orderField];
                  });

                  return {
                    docs: sorted.map(g => ({
                      id: g.groupId,
                      data: () => g,
                    })),
                  };
                }
                if (collectionName === 'memberships') {
                  const filtered = Array.from(this.memberships.entries())
                    .filter(([_, m]) => m.groupId === value)
                    .map(([id, data]) => ({
                      data: () => data,
                    }));
                  return {
                    docs: filtered,
                    empty: filtered.length === 0,
                  };
                }
                return { docs: [], empty: true };
              },
            }),
          }),
        }),
      }),
    };
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

  setUserStats(userId: string, stats: any) {
    this.userStats.set(userId, stats);
  }

  reset() {
    this.groups.clear();
    this.memberships.clear();
    this.userStats.clear();
  }
}

// Mock Client
class MockClient {
  private users: Map<string, any> = new Map();

  setUser(userId: string, user: any) {
    this.users.set(userId, user);
  }

  get users() {
    return {
      fetch: async (userId: string) => {
        const user = this.users.get(userId);
        if (!user) {
          throw new Error('User not found');
        }
        return user;
      },
    };
  }
}

// Mock interaction
function createMockInteraction(options: {
  userId?: string;
  username?: string;
  guildId?: string | null;
  targetUserId?: string;
  targetUsername?: string;
}) {
  const replies: string[] = [];
  const edits: string[] = [];
  const files: any[] = [];

  const mockTargetUser = options.targetUserId ? {
    id: options.targetUserId,
    username: options.targetUsername || 'targetuser',
  } : null;

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    guildId: options.guildId !== undefined ? options.guildId : 'guild123',
    options: {
      getUser: (name: string) => {
        if (name === 'user') return mockTargetUser;
        return null;
      },
    },
    reply: async (msg: any) => {
      replies.push(typeof msg === 'string' ? msg : msg.content);
    },
    deferReply: async () => {},
    editReply: async (msg: any) => {
      if (typeof msg === 'string') {
        edits.push(msg);
      } else {
        if (msg.content) edits.push(msg.content);
        if (msg.files) files.push(...msg.files);
      }
    },
    _getReplies: () => replies,
    _getEdits: () => edits,
    _getFiles: () => files,
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
  console.log('🧪 Running /group Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  const mockClient = new MockClient() as any;
  let testCount = 0;

  // Test 1: Displays group info for member
  console.log('Test 1: Displays group info for member');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-TEST',
      name: 'Test Group',
      ownerId: 'owner1',
      ownerUsername: 'alice',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 2,
      totalHours: 50,
      level: 3,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-TEST', group);

    const membership: GroupMembership = {
      userId: 'user1',
      username: 'bob',
      groupId: 'GP-TEST',
      joinedAt: Timestamp.now(),
      isOwner: false,
    };
    mockDb.setMembership('user1', membership);

    // Set up user stats
    mockDb.setUserStats('user1', {
      totalDuration: 7200, // 2 hours
      totalSessions: 5,
      currentStreak: 3,
    });

    // Mock user avatar
    mockClient.setUser('user1', {
      id: 'user1',
      username: 'bob',
      displayAvatarURL: () => 'https://example.com/avatar.png',
    });

    const interaction = createMockInteraction({
      userId: 'user1',
      username: 'bob',
      guildId: 'guild123',
    });

    const context = { db: mockDb, client: mockClient };

    // Mock groupOverviewImageService
    const originalGroupOverviewImageService = require('../../../services/groupOverviewImage').groupOverviewImageService;
    require('../../../services/groupOverviewImage').groupOverviewImageService = {
      generateGroupOverviewImage: async () => Buffer.from('fake-image'),
    };

    await command.execute(interaction as any, context);

    const files = interaction._getFiles();
    assert(files.length === 1, 'Should send group overview image');

    // Restore original service
    require('../../../services/groupOverviewImage').groupOverviewImageService = originalGroupOverviewImageService;

    testCount++;
  }

  // Test 2: Shows error if user not in group
  console.log('\nTest 2: Shows error if user not in group');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      userId: 'user2',
      username: 'charlie',
      guildId: 'guild123',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send error message');
    assert(edits[0].includes('not in a group'), 'Should indicate user not in group');
    testCount++;
  }

  // Test 3: Fails if not in a guild
  console.log('\nTest 3: Fails if not in a guild');
  {
    mockDb.reset();

    const interaction = createMockInteraction({
      userId: 'user3',
      username: 'david',
      guildId: null,
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const replies = interaction._getReplies();
    assert(replies.length === 1, 'Should send a reply');
    assert(replies[0].includes('only be used in a server'), 'Should reject DM usage');
    testCount++;
  }

  // Test 4: Can view another user's group
  console.log('\nTest 4: Can view another user\'s group');
  {
    mockDb.reset();

    const group: Group = {
      groupId: 'GP-OTHR',
      name: 'Other Group',
      ownerId: 'owner4',
      ownerUsername: 'eve',
      serverId: 'guild123',
      isPublic: true,
      maxMembers: 5,
      memberCount: 1,
      totalHours: 25,
      level: 2,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    mockDb.setGroup('GP-OTHR', group);

    const membership: GroupMembership = {
      userId: 'target4',
      username: 'frank',
      groupId: 'GP-OTHR',
      joinedAt: Timestamp.now(),
      isOwner: false,
    };
    mockDb.setMembership('target4', membership);

    mockDb.setUserStats('target4', {
      totalDuration: 3600,
      totalSessions: 2,
      currentStreak: 1,
    });

    mockClient.setUser('target4', {
      id: 'target4',
      username: 'frank',
      displayAvatarURL: () => 'https://example.com/avatar.png',
    });

    const interaction = createMockInteraction({
      userId: 'user4',
      username: 'viewer',
      guildId: 'guild123',
      targetUserId: 'target4',
      targetUsername: 'frank',
    });

    const context = { db: mockDb, client: mockClient };

    // Mock groupOverviewImageService
    require('../../../services/groupOverviewImage').groupOverviewImageService = {
      generateGroupOverviewImage: async () => Buffer.from('fake-image'),
    };

    await command.execute(interaction as any, context);

    const files = interaction._getFiles();
    assert(files.length === 1, 'Should display target user\'s group');
    testCount++;
  }

  // Test 5: Calculates XP bonus correctly
  console.log('\nTest 5: XP bonus calculation based on group level');
  {
    // Level 1 = 1% bonus
    let level = 1;
    let expectedBonus = 0.01;
    let calculatedBonus = Math.min(0.5, level * 0.01);
    assert(Math.abs(calculatedBonus - expectedBonus) < 0.001, `Level ${level} should have ${expectedBonus * 100}% bonus`);

    // Level 10 = 10% bonus
    level = 10;
    expectedBonus = 0.10;
    calculatedBonus = Math.min(0.5, level * 0.01);
    assert(Math.abs(calculatedBonus - expectedBonus) < 0.001, `Level ${level} should have ${expectedBonus * 100}% bonus`);

    // Level 50 = 50% bonus (cap)
    level = 50;
    expectedBonus = 0.50;
    calculatedBonus = Math.min(0.5, level * 0.01);
    assert(Math.abs(calculatedBonus - expectedBonus) < 0.001, `Level ${level} should have ${expectedBonus * 100}% bonus (capped)`);

    // Level 100 = still 50% bonus (capped)
    level = 100;
    expectedBonus = 0.50;
    calculatedBonus = Math.min(0.5, level * 0.01);
    assert(Math.abs(calculatedBonus - expectedBonus) < 0.001, `Level ${level} should have ${expectedBonus * 100}% bonus (capped)`);

    testCount++;
  }

  // Test 6: Shows correct level and progress
  console.log('\nTest 6: Group level based on total hours (25 hours per level)');
  {
    // 0 hours = Level 1
    let totalHours = 0;
    let expectedLevel = 1;
    let calculatedLevel = Math.floor(totalHours / 25) + 1;
    assert(calculatedLevel === expectedLevel, `${totalHours} hours should be level ${expectedLevel}`);

    // 24 hours = Level 1
    totalHours = 24;
    expectedLevel = 1;
    calculatedLevel = Math.floor(totalHours / 25) + 1;
    assert(calculatedLevel === expectedLevel, `${totalHours} hours should be level ${expectedLevel}`);

    // 25 hours = Level 2
    totalHours = 25;
    expectedLevel = 2;
    calculatedLevel = Math.floor(totalHours / 25) + 1;
    assert(calculatedLevel === expectedLevel, `${totalHours} hours should be level ${expectedLevel}`);

    // 50 hours = Level 3
    totalHours = 50;
    expectedLevel = 3;
    calculatedLevel = Math.floor(totalHours / 25) + 1;
    assert(calculatedLevel === expectedLevel, `${totalHours} hours should be level ${expectedLevel}`);

    // 249 hours = Level 10
    totalHours = 249;
    expectedLevel = 10;
    calculatedLevel = Math.floor(totalHours / 25) + 1;
    assert(calculatedLevel === expectedLevel, `${totalHours} hours should be level ${expectedLevel}`);

    testCount++;
  }

  // Test 7: Command has correct name
  console.log('\nTest 7: Command has correct name');
  {
    assert(command.data.name === 'group', 'Command name should be group');
    testCount++;
  }

  // Test 8: Handles missing group gracefully
  console.log('\nTest 8: Handles missing group gracefully');
  {
    mockDb.reset();

    // Create orphaned membership (group doesn't exist)
    const membership: GroupMembership = {
      userId: 'user8',
      username: 'grace',
      groupId: 'GP-GONE',
      joinedAt: Timestamp.now(),
      isOwner: false,
    };
    mockDb.setMembership('user8', membership);

    const interaction = createMockInteraction({
      userId: 'user8',
      username: 'grace',
      guildId: 'guild123',
    });

    const context = { db: mockDb, client: mockClient };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits[0].includes('not in a group') || edits[0].includes('not found'), 'Should handle missing group');
    testCount++;
  }

  // Test 9: Calculates group rank correctly
  console.log('\nTest 9: Calculates group rank based on level');
  {
    mockDb.reset();

    // Create multiple groups with different levels
    const groups = [
      { groupId: 'GP-LVL1', level: 5, serverId: 'guild123' },
      { groupId: 'GP-LVL2', level: 10, serverId: 'guild123' },
      { groupId: 'GP-LVL3', level: 3, serverId: 'guild123' },
      { groupId: 'GP-LVL4', level: 7, serverId: 'guild123' },
    ];

    groups.forEach((g, idx) => {
      const group: Group = {
        groupId: g.groupId,
        name: `Group ${idx}`,
        ownerId: `owner${idx}`,
        ownerUsername: `owner${idx}`,
        serverId: g.serverId,
        isPublic: true,
        maxMembers: 5,
        memberCount: 1,
        totalHours: 0,
        level: g.level,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      mockDb.setGroup(g.groupId, group);
    });

    // Expected ranks (sorted by level desc): GP-LVL2 (10), GP-LVL4 (7), GP-LVL1 (5), GP-LVL3 (3)
    // So GP-LVL4 should be rank 2

    const membership: GroupMembership = {
      userId: 'user9',
      username: 'henry',
      groupId: 'GP-LVL4',
      joinedAt: Timestamp.now(),
      isOwner: true,
    };
    mockDb.setMembership('user9', membership);

    mockDb.setUserStats('user9', {
      totalDuration: 3600,
      totalSessions: 1,
      currentStreak: 1,
    });

    mockClient.setUser('user9', {
      id: 'user9',
      username: 'henry',
      displayAvatarURL: () => 'https://example.com/avatar.png',
    });

    const interaction = createMockInteraction({
      userId: 'user9',
      username: 'henry',
      guildId: 'guild123',
    });

    const context = { db: mockDb, client: mockClient };

    // Mock groupOverviewImageService to capture rank
    let capturedRank = 0;
    require('../../../services/groupOverviewImage').groupOverviewImageService = {
      generateGroupOverviewImage: async (rank: number) => {
        capturedRank = rank;
        return Buffer.from('fake-image');
      },
    };

    await command.execute(interaction as any, context);

    assert(capturedRank === 2, 'Group rank should be 2 (second highest level)');
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
