/**
 * /tasks Command
 *
 * Displays user's active tasks.
 * Tasks are parsed from numbered lists posted in the goal channel.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TasksCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tasks')
    .setDescription('View your active tasks'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) viewing tasks`);

    try {
      const taskService = new TaskService(db);
      const activeTasks = await taskService.getActiveTasks(user.id);

      if (activeTasks.length === 0) {
        await interaction.reply({
          content:
            '📋 You have no active tasks.\n\n' +
            'Post a numbered list in the goal channel to create tasks!',
          ephemeral: true,
        });
        return;
      }

      // Build task list
      const taskList = activeTasks
        .map((task, index) => `**${index + 1}.** ${task.description}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x0080ff)
        .setTitle('📋 Your Active Tasks')
        .setDescription(taskList)
        .setFooter({
          text: `${activeTasks.length} active task${activeTasks.length !== 1 ? 's' : ''} • Use /task complete [numbers] to complete tasks`
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error displaying tasks', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching your tasks. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
