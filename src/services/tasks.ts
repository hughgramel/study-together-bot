/**
 * Task Service - Manages user task tracking and completion
 *
 * Handles creation, tracking, and completion of user tasks. Tasks are parsed
 * from numbered lists posted in designated goal channels. Awards uniform XP
 * for each completed task with group bonus multipliers.
 *
 * @module services/tasks
 */

import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('TaskService');

/**
 * Individual task interface
 */
export interface Task {
  id: string;
  description: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  isCompleted: boolean;
  xpAwarded?: number;
  messageId: string;
  channelId: string;
}

/**
 * User tasks document interface
 */
export interface UserTasks {
  userId: string;
  username: string;
  tasks: Task[];
  lastUpdatedAt: Timestamp;
}

/**
 * Service for managing user tasks
 */
export class TaskService {
  private db: Firestore;

  // XP awarded per completed task (uniform difficulty)
  private static readonly TASK_XP = 75;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Gets all tasks for a user
   *
   * @param userId - Discord user ID
   * @returns User's task data or null if no tasks exist
   */
  async getUserTasks(userId: string): Promise<UserTasks | null> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as UserTasks;
    } catch (error) {
      logger.error('Error getting user tasks:', error);
      throw error;
    }
  }

  /**
   * Gets all active (incomplete) tasks for a user
   *
   * @param userId - Discord user ID
   * @returns Array of incomplete tasks
   */
  async getActiveTasks(userId: string): Promise<Task[]> {
    try {
      const userTasks = await this.getUserTasks(userId);
      if (!userTasks) {
        return [];
      }

      return userTasks.tasks.filter((task) => !task.isCompleted);
    } catch (error) {
      logger.error('Error getting active tasks:', error);
      throw error;
    }
  }

  /**
   * Creates tasks from a numbered list
   *
   * @param userId - Discord user ID
   * @param username - Discord username
   * @param taskDescriptions - Array of task descriptions
   * @param messageId - Discord message ID where tasks were posted
   * @param channelId - Discord channel ID
   * @returns Array of created tasks
   */
  async createTasks(
    userId: string,
    username: string,
    taskDescriptions: string[],
    messageId: string,
    channelId: string
  ): Promise<Task[]> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();
      const now = Timestamp.now();

      // Create new tasks
      const newTasks: Task[] = taskDescriptions.map((description) => ({
        id: randomUUID(),
        description,
        createdAt: now,
        isCompleted: false,
        messageId,
        channelId,
      }));

      let existingTasks: Task[] = [];
      if (doc.exists) {
        const existingData = doc.data() as UserTasks;
        existingTasks = existingData.tasks || [];
      }

      // Add new tasks to existing tasks
      const updatedTasks = [...existingTasks, ...newTasks];

      const userTasksData: UserTasks = {
        userId,
        username,
        tasks: updatedTasks,
        lastUpdatedAt: now,
      };

      await docRef.set(userTasksData);

      logger.info(`Created ${newTasks.length} tasks for user ${userId}`);

      return newTasks;
    } catch (error) {
      logger.error('Error creating tasks:', error);
      throw error;
    }
  }

  /**
   * Marks a task as completed
   *
   * @param userId - Discord user ID
   * @param taskId - Task ID to complete
   * @returns Completed task with XP awarded
   */
  async completeTask(userId: string, taskId: string): Promise<{ task: Task; xpAwarded: number }> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error('User has no tasks');
      }

      const data = doc.data() as UserTasks;
      const tasks = data.tasks || [];

      // Find the task
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) {
        throw new Error('Task not found');
      }

      const task = tasks[taskIndex];

      if (task.isCompleted) {
        throw new Error('Task already completed');
      }

      // Mark as completed
      task.isCompleted = true;
      task.completedAt = Timestamp.now();
      task.xpAwarded = TaskService.TASK_XP;

      // Update the tasks array
      tasks[taskIndex] = task;

      await docRef.update({
        tasks,
        lastUpdatedAt: Timestamp.now()
      });

      logger.info(`Task ${taskId} completed by user ${userId}, awarded ${TaskService.TASK_XP} XP`);

      return { task, xpAwarded: TaskService.TASK_XP };
    } catch (error) {
      logger.error('Error completing task:', error);
      throw error;
    }
  }

  /**
   * Marks multiple tasks as completed
   *
   * @param userId - Discord user ID
   * @param taskIds - Array of task IDs to complete
   * @returns Array of completed tasks with total XP awarded
   */
  async completeTasks(
    userId: string,
    taskIds: string[]
  ): Promise<{ tasks: Task[]; totalXpAwarded: number }> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error('User has no tasks');
      }

      const data = doc.data() as UserTasks;
      const tasks = data.tasks || [];

      const completedTasks: Task[] = [];
      let totalXp = 0;

      // Complete each task
      for (const taskId of taskIds) {
        const taskIndex = tasks.findIndex((t) => t.id === taskId);
        if (taskIndex === -1) {
          logger.warn(`Task ${taskId} not found, skipping`);
          continue;
        }

        const task = tasks[taskIndex];

        if (task.isCompleted) {
          logger.warn(`Task ${taskId} already completed, skipping`);
          continue;
        }

        // Mark as completed
        task.isCompleted = true;
        task.completedAt = Timestamp.now();
        task.xpAwarded = TaskService.TASK_XP;

        tasks[taskIndex] = task;
        completedTasks.push(task);
        totalXp += TaskService.TASK_XP;
      }

      if (completedTasks.length > 0) {
        await docRef.update({
          tasks,
          lastUpdatedAt: Timestamp.now()
        });

        logger.info(
          `Completed ${completedTasks.length} tasks for user ${userId}, awarded ${totalXp} XP`
        );
      }

      return { tasks: completedTasks, totalXpAwarded: totalXp };
    } catch (error) {
      logger.error('Error completing tasks:', error);
      throw error;
    }
  }

  /**
   * Deletes a task (for cleanup/corrections)
   *
   * @param userId - Discord user ID
   * @param taskId - Task ID to delete
   */
  async deleteTask(userId: string, taskId: string): Promise<void> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error('User has no tasks');
      }

      const data = doc.data() as UserTasks;
      const tasks = data.tasks || [];

      // Remove the task
      const filteredTasks = tasks.filter((t) => t.id !== taskId);

      await docRef.update({
        tasks: filteredTasks,
        lastUpdatedAt: Timestamp.now()
      });

      logger.info(`Deleted task ${taskId} for user ${userId}`);
    } catch (error) {
      logger.error('Error deleting task:', error);
      throw error;
    }
  }

  /**
   * Clears all active (incomplete) tasks for a user
   *
   * @param userId - Discord user ID
   * @returns Number of tasks cleared
   */
  async clearActiveTasks(userId: string): Promise<number> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();

      if (!doc.exists) {
        return 0;
      }

      const data = doc.data() as UserTasks;
      const tasks = data.tasks || [];

      // Keep only completed tasks
      const completedTasks = tasks.filter((t) => t.isCompleted);
      const clearedCount = tasks.length - completedTasks.length;

      if (clearedCount === 0) {
        return 0;
      }

      await docRef.update({
        tasks: completedTasks,
        lastUpdatedAt: Timestamp.now(),
      });

      logger.info(`Cleared ${clearedCount} active tasks for user ${userId}`);

      return clearedCount;
    } catch (error) {
      logger.error('Error clearing active tasks:', error);
      throw error;
    }
  }

  /**
   * Gets the base XP awarded per task (before group bonuses)
   */
  static getTaskXP(): number {
    return TaskService.TASK_XP;
  }
}
