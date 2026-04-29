/**
 * /goals Command
 *
 * Displays user's active goals.
 * Goals are parsed from numbered lists posted in the goal channel.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService, TaskDifficulty } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GoalsCommand');

const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  1: 'Trivial',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Brutal',
};

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
        .map((task, index) => {
          const difficulty = (task.difficulty ?? 3) as TaskDifficulty;
          const xp = TaskService.getXpForDifficulty(difficulty);
          const label = DIFFICULTY_LABELS[difficulty];
          return `**${index + 1}.** ${task.description} — *${label} (${difficulty}/5, ${xp} XP)*`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x0080ff)
        .setTitle('📋 Your Active Goals')
        .setDescription(goalList)
        .setFooter({
          text: `${activeTasks.length} active goal${activeTasks.length !== 1 ? 's' : ''} • /complete [numbers] to finish • /cancelgoal [numbers] to remove`
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
