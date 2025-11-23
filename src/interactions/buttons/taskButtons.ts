/**
 * Task Button Handlers
 *
 * Handles button interactions for completing tasks and awarding XP.
 */

import { ButtonInteraction, Client, EmbedBuilder } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { TaskService } from '../../services/tasks';
import { XPService } from '../../services/xp';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TaskButtons');

/**
 * Handle complete single task button
 */
export async function handleCompleteTaskButton(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const taskId = interaction.customId.replace('complete_task_', '');
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  try {
    const taskService = new TaskService(db);
    const xpService = new XPService(db);
    const groupService = new GroupService(db);

    // Complete the task
    const { task, xpAwarded: baseXP } = await taskService.completeTask(user.id, taskId);

    // Calculate group bonus
    let groupXpBonus = 0;
    let finalXP = baseXP;

    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      if (userGroupData) {
        groupXpBonus = groupService.calculateXpModifier(userGroupData.group.level);
        finalXP = Math.ceil(baseXP * (1 + groupXpBonus));
      }
    } catch (error) {
      // User not in a group, use base XP
      logger.info(`User ${user.id} not in a group, using base XP`);
    }

    // Award XP
    const xpResult = await xpService.awardXP(user.id, finalXP, 'Task completed');

    // Build response message
    let message = `✅ **Task completed!**\n\n`;
    message += `*${task.description}*\n\n`;
    message += `**+${finalXP} XP**`;

    if (groupXpBonus > 0) {
      message += ` (${baseXP} base + ${Math.round(groupXpBonus * 100)}% group bonus)`;
    }

    if (xpResult.leveledUp) {
      message += `\n\n🎉 **LEVEL UP!** You reached level ${xpResult.newLevel}!`;
    }

    await interaction.editReply({
      content: message,
    });

    logger.info(
      `User ${user.username} (${user.id}) completed task ${taskId}, awarded ${finalXP} XP`
    );
  } catch (error) {
    logger.error('Error completing task', error);

    let errorMessage = '❌ An error occurred while completing the task.';

    if (error instanceof Error) {
      if (error.message === 'Task already completed') {
        errorMessage = '❌ This task has already been completed.';
      } else if (error.message === 'Task not found') {
        errorMessage = '❌ Task not found. It may have been deleted.';
      } else if (error.message === 'User has no tasks') {
        errorMessage = '❌ You have no tasks.';
      }
    }

    await interaction.editReply({
      content: errorMessage,
    });
  }
}

/**
 * Handle complete all tasks button
 */
export async function handleCompleteAllTasksButton(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const userId = interaction.customId.replace('complete_all_tasks_', '');
  const user = interaction.user;

  // Verify user is completing their own tasks
  if (user.id !== userId) {
    await interaction.reply({
      content: '❌ You can only complete your own tasks.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const taskService = new TaskService(db);
    const xpService = new XPService(db);
    const groupService = new GroupService(db);

    // Get all active tasks
    const activeTasks = await taskService.getActiveTasks(user.id);

    if (activeTasks.length === 0) {
      await interaction.editReply({
        content: '❌ You have no active tasks to complete.',
      });
      return;
    }

    // Complete all tasks
    const taskIds = activeTasks.map((task) => task.id);
    const { tasks: completedTasks, totalXpAwarded: baseXP } = await taskService.completeTasks(
      user.id,
      taskIds
    );

    if (completedTasks.length === 0) {
      await interaction.editReply({
        content: '❌ No tasks were completed. They may have already been completed.',
      });
      return;
    }

    // Calculate group bonus
    let groupXpBonus = 0;
    let finalXP = baseXP;

    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      if (userGroupData) {
        groupXpBonus = groupService.calculateXpModifier(userGroupData.group.level);
        finalXP = Math.ceil(baseXP * (1 + groupXpBonus));
      }
    } catch (error) {
      // User not in a group, use base XP
      logger.info(`User ${user.id} not in a group, using base XP`);
    }

    // Award XP
    const xpResult = await xpService.awardXP(user.id, finalXP, 'All tasks completed');

    // Build response message
    let message = `✅ **All tasks completed!**\n\n`;
    message += `Completed ${completedTasks.length} task${completedTasks.length !== 1 ? 's' : ''}:\n`;
    message += completedTasks.map((task, i) => `${i + 1}. ${task.description}`).join('\n');
    message += `\n\n**+${finalXP} XP**`;

    if (groupXpBonus > 0) {
      message += ` (${baseXP} base + ${Math.round(groupXpBonus * 100)}% group bonus)`;
    }

    if (xpResult.leveledUp) {
      message += `\n\n🎉 **LEVEL UP!** You reached level ${xpResult.newLevel}!`;
    }

    await interaction.editReply({
      content: message,
    });

    logger.info(
      `User ${user.username} (${user.id}) completed ${completedTasks.length} tasks, awarded ${finalXP} XP`
    );
  } catch (error) {
    logger.error('Error completing all tasks', error);
    await interaction.editReply({
      content: '❌ An error occurred while completing your tasks. Please try again later.',
    });
  }
}
