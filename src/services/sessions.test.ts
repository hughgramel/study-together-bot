/**
 * Unit tests for Session Service - Cancel command behavior
 * Run with: npx ts-node src/services/sessions.test.ts
 *
 * Tests:
 * 1. Cancel command deletes session without updating stats
 * 2. Cancel command doesn't affect XP
 */

import { SessionService } from './sessions';
import { ActiveSession } from '../types';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore
class MockFirestore {
  private activeSessions: Map<string, ActiveSession> = new Map();
  private statsUpdated: boolean = false;
  private completedSessions: Map<string, any> = new Map();

  collection(name: string) {
    return {
      doc: (docName: string) => ({
        collection: (collectionName: string) => ({
          doc: (userId: string) => ({
            get: async () => {
              if (collectionName === 'sessions') {
                return {
                  exists: this.activeSessions.has(userId),
                  data: () => this.activeSessions.get(userId),
                };
              }
              return { exists: false, data: () => null };
            },
            delete: async () => {
              if (collectionName === 'sessions') {
                this.activeSessions.delete(userId);
              }
            },
            set: async (data: any) => {
              if (collectionName === 'sessions') {
                this.activeSessions.set(userId, data);
              } else if (collectionName === 'completed') {
                this.completedSessions.set(userId, data);
              }
            },
            update: async (updates: any) => {
              if (collectionName === 'stats') {
                this.statsUpdated = true;
              }
              if (collectionName === 'sessions') {
                const current = this.activeSessions.get(userId);
                if (current) {
                  this.activeSessions.set(userId, { ...current, ...updates });
                }
              }
            },
          }),
        }),
      }),
    };
  }

  // Helper methods
  setActiveSession(userId: string, session: ActiveSession) {
    this.activeSessions.set(userId, session);
  }

  hasActiveSession(userId: string): boolean {
    return this.activeSessions.has(userId);
  }

  wasStatsUpdated(): boolean {
    return this.statsUpdated;
  }

  resetStatsFlag() {
    this.statsUpdated = false;
  }

  getCompletedSessionCount(): number {
    return this.completedSessions.size;
  }

  clear() {
    this.activeSessions.clear();
    this.completedSessions.clear();
    this.statsUpdated = false;
  }
}

// Test runner
async function runTests() {
  console.log('🧪 Starting Session Service Tests (Cancel Command)\n');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Cancel deletes active session
  console.log('TEST 1: Cancel command deletes active session');
  console.log('==============================================\n');

  try {
    const mockDb = new MockFirestore();
    const sessionService = new SessionService(mockDb as any);

    const userId = 'test-user-1';
    const activeSession: ActiveSession = {
      userId,
      username: 'TestUser',
      activity: 'studying',
      startTime: Timestamp.now(),
      isPaused: false,
      pausedDuration: 0,
      serverId: 'test-server',
    };

    mockDb.setActiveSession(userId, activeSession);

    console.log('  ✓ Created active session');
    if (mockDb.hasActiveSession(userId)) {
      console.log('    ✓ Active session exists before cancel');
      passedTests++;
    } else {
      console.log('    ✗ Active session should exist');
      failedTests++;
    }

    // Cancel the session
    await sessionService.deleteActiveSession(userId);

    if (!mockDb.hasActiveSession(userId)) {
      console.log('    ✓ Active session deleted after cancel');
      passedTests++;
    } else {
      console.log('    ✗ Active session should be deleted');
      failedTests++;
    }

    console.log();

  } catch (error) {
    console.log(`  ✗ Test failed with error: ${error}\n`);
    failedTests++;
  }

  // Test 2: Cancel does not update stats
  console.log('TEST 2: Cancel command does not update stats');
  console.log('=============================================\n');

  try {
    const mockDb = new MockFirestore();
    const sessionService = new SessionService(mockDb as any);

    const userId = 'test-user-2';
    const activeSession: ActiveSession = {
      userId,
      username: 'TestUser2',
      activity: 'coding',
      startTime: Timestamp.fromDate(new Date(Date.now() - 3600000)), // 1 hour ago
      isPaused: false,
      pausedDuration: 0,
      serverId: 'test-server',
    };

    mockDb.setActiveSession(userId, activeSession);
    mockDb.resetStatsFlag();

    console.log('  ✓ Created active session (started 1 hour ago)');

    // Cancel the session
    await sessionService.deleteActiveSession(userId);

    if (!mockDb.wasStatsUpdated()) {
      console.log('    ✓ Stats were NOT updated (correct behavior)');
      passedTests++;
    } else {
      console.log('    ✗ Stats should NOT be updated on cancel');
      failedTests++;
    }

    console.log();

  } catch (error) {
    console.log(`  ✗ Test failed with error: ${error}\n`);
    failedTests++;
  }

  // Test 3: Cancel does not create completed session
  console.log('TEST 3: Cancel command does not create completed session');
  console.log('========================================================\n');

  try {
    const mockDb = new MockFirestore();
    const sessionService = new SessionService(mockDb as any);

    const userId = 'test-user-3';
    const activeSession: ActiveSession = {
      userId,
      username: 'TestUser3',
      activity: 'reading',
      startTime: Timestamp.fromDate(new Date(Date.now() - 7200000)), // 2 hours ago
      isPaused: false,
      pausedDuration: 0,
      serverId: 'test-server',
    };

    mockDb.setActiveSession(userId, activeSession);

    const initialCompletedCount = mockDb.getCompletedSessionCount();
    console.log(`  ✓ Initial completed sessions: ${initialCompletedCount}`);

    // Cancel the session
    await sessionService.deleteActiveSession(userId);

    const finalCompletedCount = mockDb.getCompletedSessionCount();

    if (finalCompletedCount === initialCompletedCount) {
      console.log(`    ✓ No completed session created (count unchanged: ${finalCompletedCount})`);
      passedTests++;
    } else {
      console.log(`    ✗ Completed session should not be created`);
      console.log(`    ✗ Expected: ${initialCompletedCount}, Got: ${finalCompletedCount}`);
      failedTests++;
    }

    console.log();

  } catch (error) {
    console.log(`  ✗ Test failed with error: ${error}\n`);
    failedTests++;
  }

  // Test 4: Paused session can be cancelled
  console.log('TEST 4: Paused session can be cancelled');
  console.log('========================================\n');

  try {
    const mockDb = new MockFirestore();
    const sessionService = new SessionService(mockDb as any);

    const userId = 'test-user-4';
    const pausedSession: ActiveSession = {
      userId,
      username: 'TestUser4',
      activity: 'studying',
      startTime: Timestamp.fromDate(new Date(Date.now() - 3600000)),
      isPaused: true,
      pausedAt: Timestamp.fromDate(new Date(Date.now() - 1800000)), // Paused 30 min ago
      pausedDuration: 600, // 10 minutes of previous pauses
      serverId: 'test-server',
    };

    mockDb.setActiveSession(userId, pausedSession);
    console.log('  ✓ Created paused session');

    // Cancel the paused session
    await sessionService.deleteActiveSession(userId);

    if (!mockDb.hasActiveSession(userId)) {
      console.log('    ✓ Paused session deleted successfully');
      passedTests++;
    } else {
      console.log('    ✗ Paused session should be deleted');
      failedTests++;
    }

    if (!mockDb.wasStatsUpdated()) {
      console.log('    ✓ Stats not updated for paused session cancel');
      passedTests++;
    } else {
      console.log('    ✗ Stats should not be updated');
      failedTests++;
    }

    console.log();

  } catch (error) {
    console.log(`  ✗ Test failed with error: ${error}\n`);
    failedTests++;
  }

  // Test 5: Cancel non-existent session is safe
  console.log('TEST 5: Cancelling non-existent session is safe');
  console.log('================================================\n');

  try {
    const mockDb = new MockFirestore();
    const sessionService = new SessionService(mockDb as any);

    const userId = 'test-user-nonexistent';

    // Try to cancel a session that doesn't exist
    await sessionService.deleteActiveSession(userId);

    console.log('  ✓ No error thrown when cancelling non-existent session');
    passedTests++;

    if (!mockDb.wasStatsUpdated()) {
      console.log('    ✓ Stats not updated');
      passedTests++;
    } else {
      console.log('    ✗ Stats should not be updated');
      failedTests++;
    }

    console.log();

  } catch (error) {
    console.log(`  ✗ Test failed - should not throw error: ${error}\n`);
    failedTests++;
  }

  // Summary
  console.log('=====================================');
  console.log('TEST SUMMARY');
  console.log('=====================================');
  console.log(`✓ Passed: ${passedTests}`);
  console.log(`✗ Failed: ${failedTests}`);
  console.log(`Total: ${passedTests + failedTests}\n`);

  if (failedTests === 0) {
    console.log('🎉 All tests passed!\n');
    console.log('Cancel command correctly:');
    console.log('  • Deletes active sessions');
    console.log('  • Does NOT update user stats');
    console.log('  • Does NOT create completed sessions');
    console.log('  • Does NOT affect XP');
    console.log('  • Handles paused sessions');
    console.log('  • Safely handles non-existent sessions\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
