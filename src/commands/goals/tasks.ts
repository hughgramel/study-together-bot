/**
 * /tasks Command
 *
 * Displays user's active tasks with interactive buttons to mark them complete.
 * Tasks are parsed from numbered lists posted in the goal channel.
 */

import {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TasksCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tasks')
    .setDescription('View and manage your active tasks'),

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

      // Create embed showing tasks
      const embed = new EmbedBuilder()
        .setColor(0x0080ff)
        .setTitle('📋 Your Active Tasks')
        .setDescription(
          activeTasks.map((task, index) => `${index + 1}. ${task.description}`).join('\n')
        )
        .setFooter({ text: `${activeTasks.length} active task${activeTasks.length !== 1 ? 's' : ''}` });

      // Create buttons for completing tasks
      // Discord limits: 5 buttons per row, 5 rows max (25 buttons total)
      const buttons: ButtonBuilder[] = [];
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];

      // Show up to 20 tasks (4 rows of 5 buttons)
      const maxTasks = Math.min(activeTasks.length, 20);

      for (let i = 0; i < maxTasks; i++) {
        const task = activeTasks[i];
        const button = new ButtonBuilder()
          .setCustomId(`complete_task_${task.id}`)
          .setLabel(`${i + 1}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✅');

        buttons.push(button);
      }

      // Add "Complete All" button if there are multiple tasks
      if (activeTasks.length > 1) {
        const completeAllButton = new ButtonBuilder()
          .setCustomId(`complete_all_tasks_${user.id}`)
          .setLabel('Complete All')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅');

        buttons.push(completeAllButton);
      }

      // Organize buttons into rows (5 per row)
      for (let i = 0; i < buttons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttons.slice(i, i + 5)
        );
        rows.push(row);
      }

      await interaction.reply({
        embeds: [embed],
        components: rows,
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
