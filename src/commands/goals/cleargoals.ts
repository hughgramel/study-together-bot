/**
 * /cleargoals Command
 *
 * Clears all active (incomplete) goals for a user.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ClearGoalsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cleargoals')
    .setDescription('Clear all your active goals'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) clearing all goals`);

    try {
      const taskService = new TaskService(db);
      const clearedCount = await taskService.clearActiveTasks(user.id);

      if (clearedCount === 0) {
        await interaction.reply({
          content: '📋 You have no active goals to clear.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `🗑️ Cleared ${clearedCount} goal${clearedCount !== 1 ? 's' : ''}.`,
        ephemeral: true,
      });

      logger.info(`Cleared ${clearedCount} goals for user ${user.id}`);
    } catch (error) {
      logger.error('Error clearing goals', error);
      await interaction.reply({
        content: '❌ An error occurred while clearing your goals. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
