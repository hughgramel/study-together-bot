/**
 * /goals Command
 *
 * Displays user's active goals.
 * Goals are parsed from numbered lists posted in the goal channel.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GoalsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('goals')
    .setDescription('View your active goals'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) viewing goals`);

    try {
      const taskService = new TaskService(db);
      const activeTasks = await taskService.getActiveTasks(user.id);

      if (activeTasks.length === 0) {
        await interaction.reply({
          content:
            '📋 You have no active goals.\n\n' +
            'Post a numbered list in the goal channel to create goals!',
          ephemeral: true,
        });
        return;
      }

      // Build goal list
      const goalList = activeTasks
        .map((task, index) => `**${index + 1}.** ${task.description}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x0080ff)
        .setTitle('📋 Your Active Goals')
        .setDescription(goalList)
        .setFooter({
          text: `${activeTasks.length} active goal${activeTasks.length !== 1 ? 's' : ''} • Use /complete [numbers] to complete goals`
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error displaying goals', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching your goals. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
