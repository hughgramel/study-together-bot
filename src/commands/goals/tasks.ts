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

      // Build task list as description
      const taskList = activeTasks
        .map((task, index) => `**${index + 1}.** ${task.description}`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0x0080ff)
        .setTitle('📋 Your Active Tasks')
        .setDescription(taskList)
        .setFooter({ text: `${activeTasks.length} active task${activeTasks.length !== 1 ? 's' : ''}` });

      // Create rows with one button per task (placed on the same line)
      // Discord limits: 5 buttons per row, 5 rows max (25 buttons total)
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];

      // Show up to 25 tasks (5 rows of 5 buttons max)
      const maxTasks = Math.min(activeTasks.length, 25);

      // Create individual task buttons
      for (let i = 0; i < maxTasks; i++) {
        const task = activeTasks[i];
        const button = new ButtonBuilder()
          .setCustomId(`complete_task_${task.id}`)
          .setLabel(`Complete ${i + 1}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✅');

        // Add to current row or create new row
        const currentRowIndex = Math.floor(i / 5);

        if (!rows[currentRowIndex]) {
          rows[currentRowIndex] = new ActionRowBuilder<ButtonBuilder>();
        }

        rows[currentRowIndex].addComponents(button);
      }

      // Add "Complete All" button on the last row if there are multiple tasks
      if (activeTasks.length > 1) {
        const completeAllButton = new ButtonBuilder()
          .setCustomId(`complete_all_tasks_${user.id}`)
          .setLabel('Complete All')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅');

        // Try to add to last row, or create new row if last row is full
        const lastRowIndex = rows.length - 1;
        if (rows[lastRowIndex] && rows[lastRowIndex].components.length < 5) {
          rows[lastRowIndex].addComponents(completeAllButton);
        } else if (rows.length < 5) {
          // Create new row for Complete All button
          rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(completeAllButton));
        }
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
