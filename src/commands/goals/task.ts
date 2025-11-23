/**
 * /task Command
 *
 * Complete tasks by number (supports single, multiple, and ranges).
 * Examples: /task complete 1, /task complete 1,2,3, /task complete 1-3
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { XPService } from '../../services/xp';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TaskCommand');

/**
 * Parse task numbers from input string
 * Supports: "1", "1,2,3", "1-3", "1, 2, 3", "1-3,5,7-9"
 */
function parseTaskNumbers(input: string): number[] {
  const numbers = new Set<number>();

  // Split by commas
  const parts = input.split(',').map(p => p.trim());

  for (const part of parts) {
    // Check if it's a range (e.g., "1-3")
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));

      if (isNaN(start) || isNaN(end)) {
        continue; // Skip invalid ranges
      }

      // Add all numbers in range
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        numbers.add(i);
      }
    } else {
      // Single number
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        numbers.add(num);
      }
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('Complete tasks')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('complete')
        .setDescription('Complete tasks by number (e.g., 1, 1-3, 1,2,3)')
        .addStringOption((option) =>
          option
            .setName('numbers')
            .setDescription('Task numbers to complete (e.g., 1, 1-3, 1,2,3)')
            .setRequired(true)
        )
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'complete') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const numbersInput = interaction.options.getString('numbers', true);
        const taskNumbers = parseTaskNumbers(numbersInput);

        if (taskNumbers.length === 0) {
          await interaction.editReply({
            content:
              '❌ Invalid task numbers. Use formats like:\n' +
              '• Single: `/task complete 1`\n' +
              '• Multiple: `/task complete 1,2,3`\n' +
              '• Range: `/task complete 1-3`\n' +
              '• Combined: `/task complete 1-3,5,7-9`',
          });
          return;
        }

        const taskService = new TaskService(db);
        const xpService = new XPService(db);
        const groupService = new GroupService(db);

        // Get user's active tasks
        const activeTasks = await taskService.getActiveTasks(user.id);

        if (activeTasks.length === 0) {
          await interaction.editReply({
            content: '📋 You have no active tasks.',
          });
          return;
        }

        // Validate task numbers and get task IDs
        const taskIds: string[] = [];
        const invalidNumbers: number[] = [];

        for (const num of taskNumbers) {
          if (num < 1 || num > activeTasks.length) {
            invalidNumbers.push(num);
          } else {
            // Task numbers are 1-indexed, array is 0-indexed
            taskIds.push(activeTasks[num - 1].id);
          }
        }

        if (taskIds.length === 0) {
          await interaction.editReply({
            content: `❌ Invalid task number${invalidNumbers.length > 1 ? 's' : ''}: ${invalidNumbers.join(', ')}\n\nYou have ${activeTasks.length} active task${activeTasks.length !== 1 ? 's' : ''}. Use \`/tasks\` to view them.`,
          });
          return;
        }

        // Complete the tasks
        const { tasks: completedTasks, totalXpAwarded: baseXP } =
          await taskService.completeTasks(user.id, taskIds);

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
        const xpResult = await xpService.awardXP(
          user.id,
          finalXP,
          `Completed ${completedTasks.length} task${completedTasks.length !== 1 ? 's' : ''}`
        );

        // Build response message
        let message = `✅ **Completed ${completedTasks.length} task${completedTasks.length !== 1 ? 's' : ''}!**\n\n`;
        message += completedTasks.map((task) => `• ${task.description}`).join('\n');
        message += `\n\n**+${finalXP} XP**`;

        if (groupXpBonus > 0) {
          message += ` (${baseXP} base + ${Math.round(groupXpBonus * 100)}% group bonus)`;
        }

        if (xpResult.leveledUp) {
          message += `\n\n🎉 **LEVEL UP!** You reached level ${xpResult.newLevel}!`;
        }

        // Show warning if some numbers were invalid
        if (invalidNumbers.length > 0) {
          message += `\n\n⚠️ Skipped invalid task number${invalidNumbers.length > 1 ? 's' : ''}: ${invalidNumbers.join(', ')}`;
        }

        await interaction.editReply({
          content: message,
        });

        logger.info(
          `User ${user.username} (${user.id}) completed ${completedTasks.length} tasks, awarded ${finalXP} XP`
        );
      } catch (error) {
        logger.error('Error completing tasks', error);
        await interaction.editReply({
          content: '❌ An error occurred while completing tasks. Please try again later.',
        });
      }
    }
  },
};
