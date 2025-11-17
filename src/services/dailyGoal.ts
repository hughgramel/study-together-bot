import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { DailyGoal, Goal } from '../types';
import { getDateKey } from '../utils/formatters';
import { randomUUID } from 'crypto';

export class DailyGoalService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Gets a user's daily goal data
   */
  async getDailyGoal(userId: string): Promise<DailyGoal | null> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('dailyGoals')
        .collection('goals')
        .doc(userId);

      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as DailyGoal;
    } catch (error) {
      console.error('Error getting daily goal:', error);
      throw error;
    }
  }

  /**
   * Adds a new goal for a user
   */
  async addGoal(
    userId: string,
    username: string,
    goalText: string,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<Goal> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('dailyGoals')
        .collection('goals')
        .doc(userId);

      const doc = await docRef.get();
      const now = Timestamp.now();

      // Create new goal
      const newGoal: Goal = {
        id: randomUUID(),
        text: goalText,
        difficulty,
        createdAt: now,
        isCompleted: false,
      };

      let existingGoals: Goal[] = [];
      if (doc.exists) {
        const existingData = doc.data() as DailyGoal;
        existingGoals = existingData.goals || [];
      }

      // Add new goal to the array
      const updatedGoals = [...existingGoals, newGoal];

      const dailyGoalData: DailyGoal = {
        userId,
        username,
        goals: updatedGoals,
        lastGoalSetAt: now,
      };

      await docRef.set(dailyGoalData);

      return newGoal;
    } catch (error) {
      console.error('Error adding goal:', error);
      throw error;
    }
  }

  /**
   * Marks a goal as completed and returns XP awarded
   */
  async completeGoal(userId: string, goalId: string): Promise<{ goal: Goal; xpAwarded: number }> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('dailyGoals')
        .collection('goals')
        .doc(userId);

      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error('User has no goals');
      }

      const data = doc.data() as DailyGoal;
      const goals = data.goals || [];

      // Find the goal
      const goalIndex = goals.findIndex((g) => g.id === goalId);
      if (goalIndex === -1) {
        throw new Error('Goal not found');
      }

      const goal = goals[goalIndex];

      if (goal.isCompleted) {
        throw new Error('Goal already completed');
      }

      // Calculate XP based on difficulty
      const xpAwarded = this.calculateXP(goal.difficulty);

      // Update goal
      goal.isCompleted = true;
      goal.completedAt = Timestamp.now();
      goal.xpAwarded = xpAwarded;

      // Update the goals array
      goals[goalIndex] = goal;

      await docRef.update({ goals });

      return { goal, xpAwarded };
    } catch (error) {
      console.error('Error completing goal:', error);
      throw error;
    }
  }

  /**
   * Gets all active (incomplete) goals for a user
   */
  async getActiveGoals(userId: string): Promise<Goal[]> {
    try {
      const dailyGoal = await this.getDailyGoal(userId);
      if (!dailyGoal) {
        return [];
      }

      return (dailyGoal.goals || []).filter((g) => !g.isCompleted);
    } catch (error) {
      console.error('Error getting active goals:', error);
      throw error;
    }
  }

  /**
   * Gets all goals (active and completed) for a user
   */
  async getAllGoals(userId: string): Promise<Goal[]> {
    try {
      const dailyGoal = await this.getDailyGoal(userId);
      if (!dailyGoal) {
        return [];
      }

      return dailyGoal.goals || [];
    } catch (error) {
      console.error('Error getting all goals:', error);
      throw error;
    }
  }

  /**
   * Calculate XP based on difficulty
   */
  private calculateXP(difficulty: 'easy' | 'medium' | 'hard'): number {
    switch (difficulty) {
      case 'easy':
        return 50;
      case 'medium':
        return 100;
      case 'hard':
        return 200;
      default:
        return 50;
    }
  }

  /**
   * Legacy method for /daily-goal command compatibility
   */
  async setDailyGoal(userId: string, username: string, goal: string): Promise<DailyGoal> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('dailyGoals')
        .collection('goals')
        .doc(userId);

      const doc = await docRef.get();
      const now = Timestamp.now();
      const todayKey = getDateKey(now);

      let goalsByDay: { [date: string]: string } = {};
      let existingGoals: Goal[] = [];

      if (doc.exists) {
        const existingData = doc.data() as DailyGoal;
        goalsByDay = existingData.goalsByDay || {};
        existingGoals = existingData.goals || [];
      }

      // Store goal for today
      goalsByDay[todayKey] = goal;

      const dailyGoalData: DailyGoal = {
        userId,
        username,
        goals: existingGoals,
        lastGoalSetAt: now,
        goalsByDay,
      };

      await docRef.set(dailyGoalData);

      return dailyGoalData;
    } catch (error) {
      console.error('Error setting daily goal:', error);
      throw error;
    }
  }

  /**
   * Gets the goal for a specific date (legacy)
   */
  async getGoalForDate(userId: string, date: Timestamp): Promise<string | null> {
    try {
      const dailyGoal = await this.getDailyGoal(userId);
      if (!dailyGoal || !dailyGoal.goalsByDay) {
        return null;
      }

      const dateKey = getDateKey(date);
      return dailyGoal.goalsByDay[dateKey] || null;
    } catch (error) {
      console.error('Error getting goal for date:', error);
      throw error;
    }
  }
}
