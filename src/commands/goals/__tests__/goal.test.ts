/**
 * Unit tests for /goal Command
 * Run with: npx ts-node src/commands/goals/__tests__/goal.test.ts
 */

import { command } from '../goal';
import { DailyGoal, Goal } from '../../../types';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firestore
class MockFirestore {
  private goals: Map<string, DailyGoal> = new Map();

  collection(name: string) {
    return {
      doc: (docName: string) => ({
        collection: (collectionName: string) => ({
          doc: (id: string) => ({
            get: async () => {
              if (collectionName === 'goals') {
                const goal = this.goals.get(id);
                return {
                  exists: !!goal,
                  data: () => goal,
                };
              }
              return { exists: false, data: () => null };
            },
            set: async (data: any) => {
              if (collectionName === 'goals') {
                this.goals.set(id, data);
              }
            },
            update: async (data: any) => {
              if (collectionName === 'goals') {
                const existing = this.goals.get(id);
                if (existing) {
                  this.goals.set(id, { ...existing, ...data });
                }
              }
            },
          }),
        }),
      }),
    };
  }

  // Helper methods for testing
  setGoals(userId: string, dailyGoal: DailyGoal) {
    this.goals.set(userId, dailyGoal);
  }

  getGoals(userId: string): DailyGoal | undefined {
    return this.goals.get(userId);
  }

  reset() {
    this.goals.clear();
  }
}

// Mock interaction for /goal add
function createAddInteraction(options: {
  userId?: string;
  username?: string;
  goalText?: string;
  difficulty?: string;
}) {
  const edits: any[] = [];

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    options: {
      getSubcommand: () => 'add',
      getString: (name: string, required?: boolean) => {
        if (name === 'goal') return options.goalText || 'Test goal';
        if (name === 'difficulty') return options.difficulty || 'medium';
        return null;
      },
    },
    deferReply: async () => {},
    editReply: async (msg: any) => {
      edits.push(msg);
    },
    _getEdits: () => edits,
  };
}

// Mock interaction for /goal complete
function createCompleteInteraction(options: {
  userId?: string;
  username?: string;
}) {
  const edits: any[] = [];

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    options: {
      getSubcommand: () => 'complete',
    },
    deferReply: async () => {},
    editReply: async (msg: any) => {
      edits.push(msg);
    },
    _getEdits: () => edits,
  };
}

// Mock interaction for /goal list
function createListInteraction(options: {
  userId?: string;
  username?: string;
}) {
  const edits: any[] = [];

  return {
    user: {
      id: options.userId || 'user123',
      username: options.username || 'testuser',
    },
    options: {
      getSubcommand: () => 'list',
    },
    deferReply: async () => {},
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
  console.log('🧪 Running /goal Command Tests...\n');

  const mockDb = new MockFirestore() as any;
  let testCount = 0;

  // Test 1: Successfully adds an easy goal
  console.log('Test 1: Successfully adds an easy goal');
  {
    mockDb.reset();

    const interaction = createAddInteraction({
      userId: 'user1',
      username: 'alice',
      goalText: 'Finish homework',
      difficulty: 'easy',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].embeds?.length === 1, 'Should include embed');
    assert(edits[0].embeds[0].data.title === 'Goal Added!', 'Should show goal added title');
    assert(edits[0].embeds[0].data.description.includes('Finish homework'), 'Should show goal text');

    const fields = edits[0].embeds[0].data.fields;
    const difficultyField = fields.find((f: any) => f.name === 'Difficulty');
    const rewardField = fields.find((f: any) => f.name === 'Reward');

    assert(difficultyField?.value.includes('Easy'), 'Should show easy difficulty');
    assert(rewardField?.value.includes('50 XP'), 'Should show 50 XP reward');

    const userGoals = mockDb.getGoals('user1');
    assert(!!userGoals, 'Should create daily goal record');
    assert(userGoals!.goals.length === 1, 'Should have one goal');
    testCount++;
  }

  // Test 2: Successfully adds a medium goal
  console.log('\nTest 2: Successfully adds a medium goal');
  {
    mockDb.reset();

    const interaction = createAddInteraction({
      userId: 'user2',
      username: 'bob',
      goalText: 'Study for test',
      difficulty: 'medium',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    const fields = edits[0].embeds[0].data.fields;
    const rewardField = fields.find((f: any) => f.name === 'Reward');

    assert(rewardField?.value.includes('100 XP'), 'Should show 100 XP reward for medium');
    testCount++;
  }

  // Test 3: Successfully adds a hard goal
  console.log('\nTest 3: Successfully adds a hard goal');
  {
    mockDb.reset();

    const interaction = createAddInteraction({
      userId: 'user3',
      username: 'charlie',
      goalText: 'Complete project',
      difficulty: 'hard',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    const fields = edits[0].embeds[0].data.fields;
    const rewardField = fields.find((f: any) => f.name === 'Reward');

    assert(rewardField?.value.includes('200 XP'), 'Should show 200 XP reward for hard');
    testCount++;
  }

  // Test 4: Shows select menu for /goal complete with active goals
  console.log('\nTest 4: Shows select menu for /goal complete with active goals');
  {
    mockDb.reset();

    const goals: Goal[] = [
      {
        id: 'goal1',
        text: 'Read chapter 5',
        difficulty: 'easy',
        createdAt: Timestamp.now(),
        isCompleted: false,
      },
      {
        id: 'goal2',
        text: 'Write essay',
        difficulty: 'hard',
        createdAt: Timestamp.now(),
        isCompleted: false,
      },
    ];

    const dailyGoal: DailyGoal = {
      userId: 'user4',
      username: 'david',
      goals,
      lastGoalSetAt: Timestamp.now(),
    };

    mockDb.setGoals('user4', dailyGoal);

    const interaction = createCompleteInteraction({
      userId: 'user4',
      username: 'david',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].embeds?.length === 1, 'Should include embed');
    assert(edits[0].embeds[0].data.title === 'Complete a Goal', 'Should show complete goal title');
    assert(edits[0].components?.length === 1, 'Should include select menu');

    if (edits[0].components && edits[0].components.length > 0) {
      const selectMenu = edits[0].components[0].components[0];
      if (selectMenu?.data?.options) {
        assert(selectMenu.data.options.length === 2, 'Should show 2 goal options');
      }
    }
    testCount++;
  }

  // Test 5: Shows message when no active goals for /goal complete
  console.log('\nTest 5: Shows message when no active goals for /goal complete');
  {
    mockDb.reset();

    const interaction = createCompleteInteraction({
      userId: 'user5',
      username: 'eve',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].content.includes('no active goals'), 'Should indicate no active goals');
    assert(edits[0].content.includes('/goal add'), 'Should suggest /goal add');
    testCount++;
  }

  // Test 6: Shows all goals for /goal list
  console.log('\nTest 6: Shows all goals for /goal list');
  {
    mockDb.reset();

    const goals: Goal[] = [
      {
        id: 'goal1',
        text: 'Active goal 1',
        difficulty: 'easy',
        createdAt: Timestamp.now(),
        isCompleted: false,
      },
      {
        id: 'goal2',
        text: 'Active goal 2',
        difficulty: 'medium',
        createdAt: Timestamp.now(),
        isCompleted: false,
      },
      {
        id: 'goal3',
        text: 'Completed goal',
        difficulty: 'hard',
        createdAt: Timestamp.now(),
        isCompleted: true,
        completedAt: Timestamp.now(),
      },
    ];

    const dailyGoal: DailyGoal = {
      userId: 'user6',
      username: 'frank',
      goals,
      lastGoalSetAt: Timestamp.now(),
    };

    mockDb.setGoals('user6', dailyGoal);

    const interaction = createListInteraction({
      userId: 'user6',
      username: 'frank',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].embeds?.length === 1, 'Should include embed');
    assert(edits[0].embeds[0].data.title === 'Your Goals', 'Should show goals title');

    const fields = edits[0].embeds[0].data.fields;
    const activeField = fields.find((f: any) => f.name === 'Active Goals');

    assert(!!activeField, 'Should have active goals field');
    assert(activeField.value.includes('Active goal 1'), 'Should list first active goal');
    assert(activeField.value.includes('Active goal 2'), 'Should list second active goal');

    const footer = edits[0].embeds[0].data.footer;
    assert(footer.text.includes('2 active'), 'Should show 2 active goals');
    assert(footer.text.includes('1 completed'), 'Should show 1 completed goal');
    testCount++;
  }

  // Test 7: Shows message when no goals for /goal list
  console.log('\nTest 7: Shows message when no goals for /goal list');
  {
    mockDb.reset();

    const interaction = createListInteraction({
      userId: 'user7',
      username: 'grace',
    });

    const context = { db: mockDb, client: {} as any };
    await command.execute(interaction as any, context);

    const edits = interaction._getEdits();
    assert(edits.length === 1, 'Should send one edit');
    assert(edits[0].content.includes('no goals yet'), 'Should indicate no goals');
    assert(edits[0].content.includes('/goal add'), 'Should suggest /goal add');
    testCount++;
  }

  // Test 8: Command has correct name
  console.log('\nTest 8: Command has correct name');
  {
    assert(command.data.name === 'goal', 'Command name should be goal');
    testCount++;
  }

  // Test 9: Command has three subcommands
  console.log('\nTest 9: Command has three subcommands');
  {
    const options = command.data.options;
    assert(options.length === 3, 'Should have 3 subcommands');

    const addSubcommand = options.find((o: any) => o.name === 'add');
    const completeSubcommand = options.find((o: any) => o.name === 'complete');
    const listSubcommand = options.find((o: any) => o.name === 'list');

    assert(!!addSubcommand, 'Should have add subcommand');
    assert(!!completeSubcommand, 'Should have complete subcommand');
    assert(!!listSubcommand, 'Should have list subcommand');
    testCount++;
  }

  // Test 10: Add subcommand has required options
  console.log('\nTest 10: Add subcommand has required options');
  {
    const options = command.data.options;
    const addSubcommand = options.find((o: any) => o.name === 'add');

    assert(!!addSubcommand, 'Should have add subcommand');
    assert(!!(addSubcommand as any).options, 'Add subcommand should have options');

    const goalOption = (addSubcommand as any).options.find((o: any) => o.name === 'goal');
    const difficultyOption = (addSubcommand as any).options.find((o: any) => o.name === 'difficulty');

    assert(!!goalOption, 'Should have goal option');
    assert(goalOption.required === true, 'Goal option should be required');

    assert(!!difficultyOption, 'Should have difficulty option');
    assert(difficultyOption.required === true, 'Difficulty option should be required');
    assert(difficultyOption.choices.length === 3, 'Should have 3 difficulty choices');
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
