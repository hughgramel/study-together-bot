/**
 * Integration tests for Group Commands
 * Run with: npx ts-node src/__tests__/groups.integration.test.ts
 *
 * Tests full workflows and interactions between multiple commands
 */

import { GroupService, Group, GroupMembership } from '../services/groups';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore with full transaction and batch support
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
            set: async (data: any) => {
              if (collectionName === 'active') {
                this.groups.set(id, data);
              }
              if (collectionName === 'memberships') {
                this.memberships.set(id, data);
              }
              if (collectionName === 'stats') {
                this.userStats.set(id, data);
              }
            },
            update: async (data: any) => {
              if (collectionName === 'active') {
                const existing = this.groups.get(id);
                if (existing) {
                  this.groups.set(id, { ...existing, ...data });
                }
              }
              if (collectionName === 'stats') {
                const existing = this.userStats.get(id);
                if (existing) {
                  this.userStats.set(id, { ...existing, ...data });
                }
              }
            },
            delete: async () => {
              if (collectionName === 'active') {
                this.groups.delete(id);
              }
              if (collectionName === 'memberships') {
                this.memberships.delete(id);
              }
            },
          }),
          where: (field: string, op: string, value: any) => ({
            get: async () => {
              if (collectionName === 'memberships' && field === 'groupId') {
                const results = Array.from(this.memberships.entries())
                  .filter(([_, m]) => m.groupId === value)
                  .map(([id, data]) => ({
                    ref: { id },
                    data: () => data,
                  }));
                return {
                  docs: results,
                  empty: results.length === 0,
                  size: results.length,
                };
              }
              return { docs: [], empty: true, size: 0 };
            },
            orderBy: (orderField: string, direction: string) => ({
              limit: (limitCount: number) => ({
                get: async () => {
                  if (collectionName === 'active') {
                    const filtered = Array.from(this.groups.values())
                      .filter(g => {
                        if (field === 'serverId') return g.serverId === value;
                        if (field === 'isPublic') return g.isPublic === value;
                        return true;
                      });

                    const sorted = [...filtered].sort((a, b) => {
                      if (direction === 'desc') {
                        return (b as any)[orderField] - (a as any)[orderField];
                      }
                      return (a as any)[orderField] - (b as any)[orderField];
                    });

                    const limited = sorted.slice(0, limitCount);

                    return {
                      docs: limited.map(g => ({
                        id: g.groupId,
                        data: () => g,
                      })),
                      empty: limited.length === 0,
                    };
                  }
                  return { docs: [], empty: true };
                },
              }),
            }),
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
  getGroup(id: string): Group | undefined {
    return this.groups.get(id);
  }

  getMembership(userId: string): GroupMembership | undefined {
    return this.memberships.get(userId);
  }

  setUserStats(userId: string, stats: any) {
    this.userStats.set(userId, stats);
  }

  getUserStats(userId: string): any {
    return this.userStats.get(userId);
  }

  countGroups(): number {
    return this.groups.size;
  }

  countMemberships(): number {
    return this.memberships.size;
  }

  reset() {
    this.groups.clear();
    this.memberships.clear();
    this.userStats.clear();
  }
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
  console.log('🧪 Running Group Integration Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // ===== WORKFLOW 1: Create → Join → Complete Session → Verify XP Bonus =====
  console.log('=== Workflow 1: Create → Join → Complete Session → Verify XP Bonus ===\n');
  {
    mockDb.reset();
    const groupService = new GroupService(mockDb);

    // Step 1: User creates a group
    console.log('Step 1: Creating group...');
    const group = await groupService.createGroup(
      'Study Warriors',
      'alice',
      'Alice',
      'server1',
      { isPublic: true, maxMembers: 5 }
    );

    assert(!!group, 'Group should be created');
    assert(group.memberCount === 1, 'Group should have 1 member');
    assert(group.level === 1, 'New group should be level 1');

    // Step 2: Another user joins the group
    console.log('Step 2: Second user joining...');
    await groupService.addMemberToGroup(group.groupId, 'bob', 'Bob');

    const updatedGroup = mockDb.getGroup(group.groupId);
    assert(updatedGroup!.memberCount === 2, 'Group should have 2 members');

    const bobMembership = mockDb.getMembership('bob');
    assert(!!bobMembership, 'Bob should have membership');
    assert(bobMembership.groupId === group.groupId, 'Bob should be in the correct group');

    // Step 3: Members complete sessions and accumulate hours
    console.log('Step 3: Simulating session completions...');

    // Alice completes 30 hours
    mockDb.setUserStats('alice', {
      totalDuration: 108000, // 30 hours in seconds
      totalSessions: 10,
    });

    // Bob completes 20 hours
    mockDb.setUserStats('bob', {
      totalDuration: 72000, // 20 hours in seconds
      totalSessions: 8,
    });

    // Step 4: Update group stats
    console.log('Step 4: Updating group stats...');
    await groupService.updateGroupStats(group.groupId);

    const statsUpdatedGroup = mockDb.getGroup(group.groupId);
    assert(statsUpdatedGroup!.totalHours === 50, 'Group should have 50 total hours');
    assert(statsUpdatedGroup!.level === 3, 'Group should be level 3 (50 hours / 25 = 2 + 1)');

    // Step 5: Verify XP bonus calculation
    console.log('Step 5: Verifying XP bonus...');
    const xpModifier = groupService.calculateXpModifier(3);
    assert(Math.abs(xpModifier - 0.03) < 0.001, 'Level 3 group should have 3% XP bonus');

    console.log('✅ Workflow 1 completed successfully!\n');
    testCount++;
  }

  // ===== WORKFLOW 2: Create → Leave → Verify Cleanup =====
  console.log('=== Workflow 2: Create → Leave → Verify Cleanup ===\n');
  {
    mockDb.reset();
    const groupService = new GroupService(mockDb);

    // Step 1: Create a group with 3 members
    console.log('Step 1: Creating group with multiple members...');
    const group = await groupService.createGroup(
      'Temp Group',
      'charlie',
      'Charlie',
      'server2',
      { isPublic: true, maxMembers: 5 }
    );

    await groupService.addMemberToGroup(group.groupId, 'david', 'David');
    await groupService.addMemberToGroup(group.groupId, 'eve', 'Eve');

    assert(mockDb.getGroup(group.groupId)!.memberCount === 3, 'Group should have 3 members');

    // Step 2: Non-owner members leave
    console.log('Step 2: Non-owners leaving...');
    await groupService.removeMemberFromGroup(group.groupId, 'david');
    assert(mockDb.getGroup(group.groupId)!.memberCount === 2, 'Group should have 2 members');
    assert(!mockDb.getMembership('david'), 'David should no longer have membership');

    await groupService.removeMemberFromGroup(group.groupId, 'eve');
    assert(mockDb.getGroup(group.groupId)!.memberCount === 1, 'Group should have 1 member');
    assert(!mockDb.getMembership('eve'), 'Eve should no longer have membership');

    // Step 3: Owner leaves (last member)
    console.log('Step 3: Last member leaving (auto-delete)...');
    await groupService.removeMemberFromGroup(group.groupId, 'charlie');

    assert(!mockDb.getGroup(group.groupId), 'Group should be auto-deleted');
    assert(!mockDb.getMembership('charlie'), 'Charlie should no longer have membership');
    assert(mockDb.countGroups() === 0, 'No groups should exist');
    assert(mockDb.countMemberships() === 0, 'No memberships should exist');

    console.log('✅ Workflow 2 completed successfully!\n');
    testCount++;
  }

  // ===== WORKFLOW 3: Create → Transfer → Leave → Verify =====
  console.log('=== Workflow 3: Create → Transfer Ownership → Original Owner Leaves ===\n');
  {
    mockDb.reset();
    const groupService = new GroupService(mockDb);

    // Step 1: Create group
    console.log('Step 1: Creating group...');
    const group = await groupService.createGroup(
      'Transfer Test',
      'frank',
      'Frank',
      'server3',
      { isPublic: true, maxMembers: 5 }
    );

    await groupService.addMemberToGroup(group.groupId, 'grace', 'Grace');

    assert(mockDb.getGroup(group.groupId)!.ownerId === 'frank', 'Frank should be owner');

    // Step 2: Transfer ownership
    console.log('Step 2: Transferring ownership...');
    await groupService.transferOwnership(group.groupId, 'grace', 'Grace');

    const transferredGroup = mockDb.getGroup(group.groupId);
    assert(transferredGroup!.ownerId === 'grace', 'Grace should be new owner');
    assert(transferredGroup!.ownerUsername === 'Grace', 'Owner username should be updated');

    const graceMembership = mockDb.getMembership('grace');
    const frankMembership = mockDb.getMembership('frank');

    assert(graceMembership!.isOwner === true, 'Grace should have isOwner = true');
    assert(frankMembership!.isOwner === false, 'Frank should have isOwner = false');

    // Step 3: Original owner (now member) leaves
    console.log('Step 3: Original owner leaving as member...');
    await groupService.removeMemberFromGroup(group.groupId, 'frank');

    assert(!mockDb.getMembership('frank'), 'Frank should no longer be in group');
    assert(mockDb.getGroup(group.groupId)!.memberCount === 1, 'Group should have 1 member');
    assert(!!mockDb.getGroup(group.groupId), 'Group should still exist with new owner');

    console.log('✅ Workflow 3 completed successfully!\n');
    testCount++;
  }

  // ===== WORKFLOW 4: Full Group Lifecycle =====
  console.log('=== Workflow 4: Full Group Lifecycle (Create → Fill → Members Leave → Auto-Delete) ===\n');
  {
    mockDb.reset();
    const groupService = new GroupService(mockDb);

    // Step 1: Create group with max 3 members
    console.log('Step 1: Creating group with max 3 members...');
    const group = await groupService.createGroup(
      'Full Lifecycle',
      'henry',
      'Henry',
      'server4',
      { isPublic: true, maxMembers: 3 }
    );

    // Step 2: Fill the group
    console.log('Step 2: Filling group to capacity...');
    await groupService.addMemberToGroup(group.groupId, 'iris', 'Iris');
    await groupService.addMemberToGroup(group.groupId, 'jack', 'Jack');

    assert(mockDb.getGroup(group.groupId)!.memberCount === 3, 'Group should be full');

    // Step 3: Try to add another member (should fail)
    console.log('Step 3: Attempting to add member to full group...');
    const hasSpace = await groupService.hasSpaceAvailable(group.groupId);
    assert(hasSpace === false, 'Group should have no space available');

    let addError = null;
    try {
      await groupService.addMemberToGroup(group.groupId, 'kate', 'Kate');
    } catch (error) {
      addError = error;
    }
    assert(!!addError, 'Adding to full group should throw error');

    // Step 4: Members leave one by one
    console.log('Step 4: Members leaving sequentially...');

    await groupService.removeMemberFromGroup(group.groupId, 'iris');
    assert(mockDb.getGroup(group.groupId)!.memberCount === 2, 'Should have 2 members');

    await groupService.removeMemberFromGroup(group.groupId, 'jack');
    assert(mockDb.getGroup(group.groupId)!.memberCount === 1, 'Should have 1 member');

    // Step 5: Last member leaves (auto-delete)
    console.log('Step 5: Last member leaving...');
    await groupService.removeMemberFromGroup(group.groupId, 'henry');

    assert(!mockDb.getGroup(group.groupId), 'Group should be auto-deleted');
    assert(mockDb.countMemberships() === 0, 'All memberships should be deleted');

    console.log('✅ Workflow 4 completed successfully!\n');
    testCount++;
  }

  // ===== WORKFLOW 5: Group Deletion with Batch Operations =====
  console.log('=== Workflow 5: Group Deletion (Multiple Members) ===\n');
  {
    mockDb.reset();
    const groupService = new GroupService(mockDb);

    // Step 1: Create group with 5 members
    console.log('Step 1: Creating group with 5 members...');
    const group = await groupService.createGroup(
      'Delete Test',
      'leo',
      'Leo',
      'server5',
      { isPublic: true, maxMembers: 5 }
    );

    const members = ['mary', 'nathan', 'olivia', 'paul'];
    for (const member of members) {
      await groupService.addMemberToGroup(group.groupId, member, member);
    }

    assert(mockDb.getGroup(group.groupId)!.memberCount === 5, 'Group should have 5 members');
    assert(mockDb.countMemberships() === 5, 'Should have 5 memberships');

    // Step 2: Delete the entire group
    console.log('Step 2: Deleting group with all members...');
    await groupService.deleteGroup(group.groupId);

    assert(!mockDb.getGroup(group.groupId), 'Group should be deleted');
    assert(mockDb.countMemberships() === 0, 'All memberships should be deleted');

    console.log('✅ Workflow 5 completed successfully!\n');
    testCount++;
  }

  // ===== WORKFLOW 6: Public Group Discovery =====
  console.log('=== Workflow 6: Public Group Discovery ===\n');
  {
    mockDb.reset();
    const groupService = new GroupService(mockDb);

    // Step 1: Create multiple public and private groups
    console.log('Step 1: Creating mixed public/private groups...');

    const publicGroup1 = await groupService.createGroup('Public 1', 'user1', 'User1', 'server6', {
      isPublic: true,
      maxMembers: 5,
    });
    await groupService.updateGroupStats(publicGroup1.groupId);
    await mockDb.getGroup(publicGroup1.groupId)!;

    const publicGroup2 = await groupService.createGroup('Public 2', 'user2', 'User2', 'server6', {
      isPublic: true,
      maxMembers: 5,
    });

    const privateGroup = await groupService.createGroup('Private 1', 'user3', 'User3', 'server6', {
      isPublic: false,
      maxMembers: 5,
    });

    // Manually set different levels for sorting
    const pg1 = mockDb.getGroup(publicGroup1.groupId);
    mockDb.collection('discord-data').doc('groups').collection('active').doc(publicGroup1.groupId).set({
      ...pg1,
      level: 10,
      totalHours: 250,
    });

    const pg2 = mockDb.getGroup(publicGroup2.groupId);
    mockDb.collection('discord-data').doc('groups').collection('active').doc(publicGroup2.groupId).set({
      ...pg2,
      level: 5,
      totalHours: 125,
    });

    // Step 2: Get public groups (should exclude private)
    console.log('Step 2: Fetching public groups...');
    const publicGroups = await groupService.getPublicGroups('server6', 10);

    assert(publicGroups.length === 2, 'Should return 2 public groups');
    assert(publicGroups[0].level === 10, 'First group should be highest level');
    assert(publicGroups[1].level === 5, 'Second group should be second highest level');
    assert(!publicGroups.some(g => g.name === 'Private 1'), 'Should not include private group');

    console.log('✅ Workflow 6 completed successfully!\n');
    testCount++;
  }

  // ===== WORKFLOW 7: Group Level Progression =====
  console.log('=== Workflow 7: Group Level Progression (XP Scaling) ===\n');
  {
    mockDb.reset();
    const groupService = new GroupService(mockDb);

    console.log('Step 1: Creating group...');
    const group = await groupService.createGroup('Level Up', 'user7', 'User7', 'server7', {
      isPublic: true,
      maxMembers: 5,
    });

    await groupService.addMemberToGroup(group.groupId, 'member7a', 'Member7A');

    // Simulate progressive hour accumulation
    const hourTests = [
      { hours: 0, expectedLevel: 1, expectedXP: 0.01 },
      { hours: 24, expectedLevel: 1, expectedXP: 0.01 },
      { hours: 25, expectedLevel: 2, expectedXP: 0.02 },
      { hours: 50, expectedLevel: 3, expectedXP: 0.03 },
      { hours: 100, expectedLevel: 5, expectedXP: 0.05 },
      { hours: 250, expectedLevel: 11, expectedXP: 0.11 },
      { hours: 500, expectedLevel: 21, expectedXP: 0.21 },
      { hours: 1250, expectedLevel: 51, expectedXP: 0.50 }, // Capped at 50%
    ];

    console.log('Step 2: Testing level progression...');
    for (const test of hourTests) {
      mockDb.setUserStats('user7', {
        totalDuration: test.hours * 3600,
        totalSessions: 10,
      });

      mockDb.setUserStats('member7a', {
        totalDuration: 0,
        totalSessions: 0,
      });

      await groupService.updateGroupStats(group.groupId);

      const updatedGroup = mockDb.getGroup(group.groupId);
      const xpModifier = groupService.calculateXpModifier(updatedGroup!.level);

      assert(
        updatedGroup!.level === test.expectedLevel,
        `${test.hours} hours should be level ${test.expectedLevel}`
      );

      assert(
        Math.abs(xpModifier - test.expectedXP) < 0.001,
        `Level ${test.expectedLevel} should have ${test.expectedXP * 100}% XP bonus`
      );
    }

    console.log('✅ Workflow 7 completed successfully!\n');
    testCount++;
  }

  console.log(`\n🎉 All ${testCount} integration tests passed!`);
  console.log('');
  console.log('📊 Integration Test Summary:');
  console.log('  ✅ Create → Join → Session → XP Bonus');
  console.log('  ✅ Create → Leave → Cleanup');
  console.log('  ✅ Create → Transfer → Leave');
  console.log('  ✅ Full Group Lifecycle');
  console.log('  ✅ Group Deletion (Batch)');
  console.log('  ✅ Public Group Discovery');
  console.log('  ✅ Level Progression & XP Scaling');
  console.log('');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
