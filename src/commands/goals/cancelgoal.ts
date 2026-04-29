/**
 * /cancelgoal Command
 *
 * Cancels active goals by their numbers (as shown in /goals).
 * Supports single, comma-separated, and ranges — same format as /complete.
 * Examples: /cancelgoal 1, /cancelgoal 1,2,3, /cancelgoal 1-3, /cancelgoal 1-3,5
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CancelGoalCommand');

/**
 * Parse goal numbers from input string.
 * Supports: "1", "1,2,3", "1-3", "1, 2, 3", "1-3,5,7-9"
 */
function parseGoalNumbers(input: string): number[] {
  const numbers = new Set<number>();
  const parts = input.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
      if (isNaN(start) || isNaN(end)) {
        continue;
      }
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        numbers.add(i);
      }
    } else {
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
    .setName('cancelgoal')
    .setDescription('Cancel one or more active goals by number (e.g., 1, 1-3, 1,2,3)')
    .addStringOption((option) =>
      option
        .setName('numbers')
        .setDescription('Goal numbers to cancel (e.g., 1, 1-3, 1,2,3)')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const numbersInput = interaction.options.getString('numbers', true);

    logger.info(
      `User ${user.username} (${user.id}) cancelling goals: ${numbersInput}`
    );

    try {
      const goalNumbers = parseGoalNumbers(numbersInput);

      if (goalNumbers.length === 0) {
        await interaction.reply({
          content:
            '❌ Invalid goal numbers. Use formats like:\n' +
            '• Single: `/cancelgoal 1`\n' +
            '• Multiple: `/cancelgoal 1,2,3`\n' +
            '• Range: `/cancelgoal 1-3`\n' +
            '• Combined: `/cancelgoal 1-3,5,7-9`',
          ephemeral: true,
        });
        return;
      }

      const taskService = new TaskService(db);
      const { cancelled, invalid, activeCount } =
        await taskService.cancelActiveTasksByIndices(user.id, goalNumbers);

      if (cancelled.length === 0) {
        if (activeCount === 0) {
          await interaction.reply({
            content: '📋 You have no active goals to cancel.',
            ephemeral: true,
          });
          return;
        }
        await interaction.reply({
          content: `❌ Invalid goal number${invalid.length !== 1 ? 's' : ''}: ${invalid.join(', ')}. You have ${activeCount} active goal${activeCount !== 1 ? 's' : ''}. Use \`/goals\` to view them.`,
          ephemeral: true,
        });
        return;
      }

      let message = `🗑️ **Cancelled ${cancelled.length} goal${cancelled.length !== 1 ? 's' : ''}:**\n`;
      message += cancelled.map((task) => `• ${task.description}`).join('\n');

      if (invalid.length > 0) {
        message += `\n\n⚠️ Skipped invalid goal number${invalid.length !== 1 ? 's' : ''}: ${invalid.join(', ')}`;
      }

      await interaction.reply({
        content: message,
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error cancelling goals', error);
      await interaction.reply({
        content: '❌ An error occurred while cancelling your goals. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
