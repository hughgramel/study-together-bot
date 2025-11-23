/**
 * /complete Command
 *
 * Complete goals by number (supports single, multiple, and ranges).
 * Examples: /complete 1, /complete 1,2,3, /complete 1-3
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { XPService } from '../../services/xp';
import { GroupService } from '../../services/groups';
import { StatsService } from '../../services/stats';
import { calculateUserLevelBonus } from '../../utils/xp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CompleteCommand');

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
    .setName('complete')
    .setDescription('Complete goals by number (e.g., 1, 1-3, 1,2,3)')
    .addStringOption((option) =>
      option
        .setName('numbers')
        .setDescription('Goal numbers to complete (e.g., 1, 1-3, 1,2,3)')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    {
      await interaction.deferReply({ ephemeral: true });

      try {
        const numbersInput = interaction.options.getString('numbers', true);
        const taskNumbers = parseTaskNumbers(numbersInput);

        if (taskNumbers.length === 0) {
          await interaction.editReply({
            content:
              '❌ Invalid goal numbers. Use formats like:\n' +
              '• Single: `/complete 1`\n' +
              '• Multiple: `/complete 1,2,3`\n' +
              '• Range: `/complete 1-3`\n' +
              '• Combined: `/complete 1-3,5,7-9`',
          });
          return;
        }

        const taskService = new TaskService(db);
        const xpService = new XPService(db);
        const groupService = new GroupService(db);
        const statsService = new StatsService(db);

        // Get user's active goals
        const activeTasks = await taskService.getActiveTasks(user.id);

        if (activeTasks.length === 0) {
          await interaction.editReply({
            content: '📋 You have no active goals.',
          });
          return;
        }

        // Validate goal numbers and get task IDs
        const taskIds: string[] = [];
        const invalidNumbers: number[] = [];

        for (const num of taskNumbers) {
          if (num < 1 || num > activeTasks.length) {
            invalidNumbers.push(num);
          } else {
            // Goal numbers are 1-indexed, array is 0-indexed
            taskIds.push(activeTasks[num - 1].id);
          }
        }

        if (taskIds.length === 0) {
          await interaction.editReply({
            content: `❌ Invalid goal number${invalidNumbers.length > 1 ? 's' : ''}: ${invalidNumbers.join(', ')}\n\nYou have ${activeTasks.length} active goal${activeTasks.length !== 1 ? 's' : ''}. Use \`/goals\` to view them.`,
          });
          return;
        }

        // Complete the goals
        const { tasks: completedTasks, totalXpAwarded: baseXP } =
          await taskService.completeTasks(user.id, taskIds);

        if (completedTasks.length === 0) {
          await interaction.editReply({
            content: '❌ No goals were completed. They may have already been completed.',
          });
          return;
        }

        // Calculate user level bonus
        const userStats = await statsService.getUserStats(user.id);
        const userLevelBonus = (userStats && userStats.xp) ? calculateUserLevelBonus(userStats.xp) : 0;

        // Calculate group bonus
        let groupXpBonus = 0;
        let finalXP = Math.ceil(baseXP * (1 + userLevelBonus));

        try {
          const userGroupData = await groupService.getUserGroup(user.id);
          if (userGroupData) {
            groupXpBonus = groupService.calculateXpModifier(userGroupData.group.level);
            finalXP = Math.ceil(finalXP * (1 + groupXpBonus));
          }
        } catch (error) {
          // User not in a group, use base XP with user level bonus only
          logger.info(`User ${user.id} not in a group, using base XP with user level bonus`);
        }

        // Award XP
        const xpResult = await xpService.awardXP(
          user.id,
          finalXP,
          `Completed ${completedTasks.length} goal${completedTasks.length !== 1 ? 's' : ''}`
        );

        // Build response message
        let message = `✅ **Completed ${completedTasks.length} goal${completedTasks.length !== 1 ? 's' : ''}!**\n\n`;
        message += completedTasks.map((task) => `• ${task.description}`).join('\n');
        message += `\n\n**+${finalXP} XP**`;

        if (userLevelBonus > 0 || groupXpBonus > 0) {
          const bonuses = [];
          if (userLevelBonus > 0) {
            bonuses.push(`${Math.round(userLevelBonus * 1000) / 10}% level`);
          }
          if (groupXpBonus > 0) {
            bonuses.push(`${Math.round(groupXpBonus * 100)}% group`);
          }
          message += ` (${baseXP} base + ${bonuses.join(' + ')} bonus)`;
        }

        if (xpResult.leveledUp) {
          message += `\n\n🎉 **LEVEL UP!** You reached level ${xpResult.newLevel}!`;
        }

        // Show warning if some numbers were invalid
        if (invalidNumbers.length > 0) {
          message += `\n\n⚠️ Skipped invalid goal number${invalidNumbers.length > 1 ? 's' : ''}: ${invalidNumbers.join(', ')}`;
        }

        await interaction.editReply({
          content: message,
        });

        logger.info(
          `User ${user.username} (${user.id}) completed ${completedTasks.length} goals, awarded ${finalXP} XP`
        );
      } catch (error) {
        logger.error('Error completing goals', error);
        await interaction.editReply({
          content: '❌ An error occurred while completing goals. Please try again later.',
        });
      }
    }
  },
};
