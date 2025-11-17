import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { DailyGoal } from '../types';
import { getDateKey } from '../utils/formatters';

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
   * Sets a user's daily goal
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

      if (doc.exists) {
        const existingData = doc.data() as DailyGoal;
        goalsByDay = existingData.goalsByDay || {};
      }

      // Store goal for today
      goalsByDay[todayKey] = goal;

      const dailyGoalData: DailyGoal = {
        userId,
        username,
        currentGoal: goal,
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
   * Gets the goal for a specific date
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
