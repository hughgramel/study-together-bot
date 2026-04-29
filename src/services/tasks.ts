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
 * Difficulty level (1-5). 1 is easiest, 5 is hardest. Defaults to 3.
 */
export type TaskDifficulty = 1 | 2 | 3 | 4 | 5;

/**
 * Individual task interface
 */
export interface Task {
  id: string;
  description: string;
  difficulty: TaskDifficulty;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  isCompleted: boolean;
  xpAwarded?: number;
  messageId: string;
  channelId: string;
}

/**
 * Task description plus optional difficulty (defaults to 3 if omitted)
 */
export interface TaskInput {
  description: string;
  difficulty?: TaskDifficulty;
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

  // Linear difficulty weights (1-5) applied to BASE_XP_POOL.
  // Tuned so difficulty 3 (the default) = 75 XP, matching the previous
  // uniform per-task XP. Bumps/halves cleanly per level.
  private static readonly DIFFICULTY_XP_WEIGHTS: Record<TaskDifficulty, number> = {
    1: 0.01,
    2: 0.02,
    3: 0.03,
    4: 0.04,
    5: 0.05,
  };
  private static readonly BASE_XP_POOL = 2500;
  private static readonly DEFAULT_DIFFICULTY: TaskDifficulty = 3;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Coerce arbitrary input into a valid TaskDifficulty, falling back to default.
   */
  private static coerceDifficulty(value: unknown): TaskDifficulty {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      return n as TaskDifficulty;
    }
    return TaskService.DEFAULT_DIFFICULTY;
  }

  /**
   * Compute XP awarded for a task at the given difficulty.
   */
  static getXpForDifficulty(difficulty: TaskDifficulty): number {
    const weight = TaskService.DIFFICULTY_XP_WEIGHTS[difficulty];
    return Math.ceil(TaskService.BASE_XP_POOL * weight);
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
   * Creates tasks. Each input is a description and optional difficulty (1-5);
   * unspecified difficulty falls back to the default (3).
   *
   * @param userId - Discord user ID
   * @param username - Discord username
   * @param inputs - Array of task descriptions or {description, difficulty} objects
   * @param messageId - Discord message ID where tasks were posted
   * @param channelId - Discord channel ID
   * @returns Array of created tasks
   */
  async createTasks(
    userId: string,
    username: string,
    inputs: Array<string | TaskInput>,
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
      const newTasks: Task[] = inputs.map((input) => {
        const { description, difficulty } =
          typeof input === 'string' ? { description: input, difficulty: undefined } : input;
        return {
          id: randomUUID(),
          description,
          difficulty: TaskService.coerceDifficulty(difficulty),
          createdAt: now,
          isCompleted: false,
          messageId,
          channelId,
        };
      });

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

      const difficulty = TaskService.coerceDifficulty(task.difficulty);
      const xp = TaskService.getXpForDifficulty(difficulty);

      // Mark as completed
      task.difficulty = difficulty;
      task.isCompleted = true;
      task.completedAt = Timestamp.now();
      task.xpAwarded = xp;

      // Update the tasks array
      tasks[taskIndex] = task;

      await docRef.update({
        tasks,
        lastUpdatedAt: Timestamp.now()
      });

      logger.info(`Task ${taskId} completed by user ${userId} at difficulty ${difficulty}, awarded ${xp} XP`);

      return { task, xpAwarded: xp };
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

        const difficulty = TaskService.coerceDifficulty(task.difficulty);
        const xp = TaskService.getXpForDifficulty(difficulty);

        // Mark as completed
        task.difficulty = difficulty;
        task.isCompleted = true;
        task.completedAt = Timestamp.now();
        task.xpAwarded = xp;

        tasks[taskIndex] = task;
        completedTasks.push(task);
        totalXp += xp;
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
   * Cancels (deletes) one or more active tasks by their 1-indexed positions in
   * the user's active task list — same numbering shown by /goals and accepted
   * by /complete. Out-of-range numbers are returned in `invalid` and skipped.
   *
   * @param userId - Discord user ID
   * @param oneIndexedNumbers - Goal numbers as displayed to the user (1-based)
   * @returns Cancelled tasks and any invalid numbers
   */
  async cancelActiveTasksByIndices(
    userId: string,
    oneIndexedNumbers: number[]
  ): Promise<{ cancelled: Task[]; invalid: number[]; activeCount: number }> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();
      if (!doc.exists) {
        return { cancelled: [], invalid: oneIndexedNumbers, activeCount: 0 };
      }

      const data = doc.data() as UserTasks;
      const tasks = data.tasks || [];

      // Active goals are what the user sees numbered 1..N in /goals.
      const activeTasks = tasks.filter((t) => !t.isCompleted);

      const cancelled: Task[] = [];
      const cancelledIds = new Set<string>();
      const invalid: number[] = [];

      // Dedupe before processing — a user typing "1,1" or "1-3,2" should
      // only delete each goal once.
      const uniqueNumbers = Array.from(new Set(oneIndexedNumbers));

      for (const n of uniqueNumbers) {
        const zeroIndexed = n - 1;
        if (zeroIndexed < 0 || zeroIndexed >= activeTasks.length) {
          invalid.push(n);
          continue;
        }
        const target = activeTasks[zeroIndexed];
        if (cancelledIds.has(target.id)) {
          continue;
        }
        cancelledIds.add(target.id);
        cancelled.push(target);
      }

      if (cancelled.length === 0) {
        return { cancelled, invalid, activeCount: activeTasks.length };
      }

      const remaining = tasks.filter((t) => !cancelledIds.has(t.id));

      await docRef.update({
        tasks: remaining,
        lastUpdatedAt: Timestamp.now(),
      });

      logger.info(
        `Cancelled ${cancelled.length} active task${cancelled.length !== 1 ? 's' : ''} for user ${userId}`
      );

      return { cancelled, invalid, activeCount: activeTasks.length };
    } catch (error) {
      logger.error('Error cancelling tasks by index:', error);
      throw error;
    }
  }

  /**
   * Cancels (deletes) one or more active tasks by their IDs. Skips tasks that
   * are already completed or not found. Used by the select-menu cancel flow,
   * where the menu hands back stable IDs rather than positional numbers.
   *
   * @param userId - Discord user ID
   * @param taskIds - Task IDs to cancel
   * @returns Cancelled tasks
   */
  async cancelActiveTasksByIds(
    userId: string,
    taskIds: string[]
  ): Promise<Task[]> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('userTasks')
        .collection('tasks')
        .doc(userId);

      const doc = await docRef.get();
      if (!doc.exists) {
        return [];
      }

      const data = doc.data() as UserTasks;
      const tasks = data.tasks || [];

      const idSet = new Set(taskIds);
      const cancelled = tasks.filter(
        (t) => idSet.has(t.id) && !t.isCompleted
      );

      if (cancelled.length === 0) {
        return [];
      }

      const cancelledIds = new Set(cancelled.map((t) => t.id));
      const remaining = tasks.filter((t) => !cancelledIds.has(t.id));

      await docRef.update({
        tasks: remaining,
        lastUpdatedAt: Timestamp.now(),
      });

      logger.info(
        `Cancelled ${cancelled.length} active task${cancelled.length !== 1 ? 's' : ''} by id for user ${userId}`
      );

      return cancelled;
    } catch (error) {
      logger.error('Error cancelling tasks by id:', error);
      throw error;
    }
  }
}
