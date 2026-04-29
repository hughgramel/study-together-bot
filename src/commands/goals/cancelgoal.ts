/**
 * /cancelgoal Command
 *
 * Cancels a single active goal by its number (as shown in /goals).
 * Numbers are 1-indexed for the user; the service converts to a 0-indexed
 * lookup against the user's active task list before deleting.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CancelGoalCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cancelgoal')
    .setDescription('Cancel a single active goal by its number (see /goals)')
    .addIntegerOption((option) =>
      option
        .setName('number')
        .setDescription('Goal number to cancel (as shown in /goals)')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const number = interaction.options.getInteger('number', true);

    logger.info(`User ${user.username} (${user.id}) cancelling goal #${number}`);

    try {
      const taskService = new TaskService(db);
      const cancelled = await taskService.cancelActiveTaskByIndex(user.id, number);

      if (!cancelled) {
        const activeTasks = await taskService.getActiveTasks(user.id);
        if (activeTasks.length === 0) {
          await interaction.reply({
            content: '📋 You have no active goals to cancel.',
            ephemeral: true,
          });
          return;
        }
        await interaction.reply({
          content: `❌ Invalid goal number: ${number}. You have ${activeTasks.length} active goal${activeTasks.length !== 1 ? 's' : ''}. Use \`/goals\` to view them.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `🗑️ Cancelled goal #${number}: **${cancelled.description}**`,
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error cancelling goal', error);
      await interaction.reply({
        content: '❌ An error occurred while cancelling your goal. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
