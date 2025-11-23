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

      // Create rows where each task gets its own row with a button
      // Discord limits: 5 rows max, 1 button per row for clean layout
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];

      // Show up to 4 tasks (leaving 1 row for "Complete All" if needed)
      const maxTasks = Math.min(activeTasks.length, 4);

      // Build embed with tasks as fields
      const embed = new EmbedBuilder()
        .setColor(0x0080ff)
        .setTitle('📋 Your Active Tasks');

      // Add each task as a field with a button below it
      for (let i = 0; i < maxTasks; i++) {
        const task = activeTasks[i];

        // Add task as embed field
        embed.addFields({
          name: `${i + 1}. ${task.description}`,
          value: '​', // Zero-width space to satisfy Discord's requirements
        });

        // Create button for this task
        const button = new ButtonBuilder()
          .setCustomId(`complete_task_${task.id}`)
          .setLabel(`✅ Complete`)
          .setStyle(ButtonStyle.Secondary);

        // Each task gets its own row
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        rows.push(row);
      }

      // If there are more than 4 tasks, show a note
      if (activeTasks.length > maxTasks) {
        embed.setFooter({
          text: `Showing ${maxTasks} of ${activeTasks.length} tasks. Complete some to see more!`
        });
      }

      // Add "Complete All" button if there are multiple tasks and we have room
      if (activeTasks.length > 1 && rows.length < 5) {
        const completeAllButton = new ButtonBuilder()
          .setCustomId(`complete_all_tasks_${user.id}`)
          .setLabel('Complete All')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅');

        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(completeAllButton));
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
