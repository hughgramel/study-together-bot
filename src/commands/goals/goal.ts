/**
 * /goal Command
 *
 * Create goals from comma-separated text or numbered lists.
 * Examples:
 * - /goal do math, take out trash
 * - /goal 1. Study 2. Exercise 3. Read
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { parseNumberedList } from '../../utils/taskParser';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GoalCommand');

/**
 * Parse goals from text - supports both comma-separated and numbered lists
 */
function parseGoals(text: string): string[] {
  // First try numbered list parsing (backwards compatibility)
  const numberedGoals = parseNumberedList(text);
  if (numberedGoals && numberedGoals.length > 0) {
    return numberedGoals;
  }

  // Fall back to comma-separated parsing
  const goals = text
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0);

  return goals;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Add goals (comma-separated or numbered list)')
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('Your goals (e.g., "do math, take out trash" or "1. Study 2. Exercise")')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      const text = interaction.options.getString('text', true);
      const goals = parseGoals(text);

      if (goals.length === 0) {
        await interaction.editReply({
          content:
            '❌ Could not parse any goals from your text.\n\n' +
            'Try:\n' +
            '• Comma-separated: `/goal do math, take out trash`\n' +
            '• Numbered list: `/goal 1. Study 2. Exercise`',
        });
        return;
      }

      logger.info(`User ${user.username} (${user.id}) adding ${goals.length} goals`);

      // Create goals using TaskService
      const taskService = new TaskService(db);
      await taskService.createTasks(
        user.id,
        user.username,
        goals,
        interaction.id, // Use interaction ID as message reference
        interaction.channelId
      );

      // Build confirmation embed
      const goalList = goals.map((goal, index) => `**${index + 1}.** ${goal}`).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x58CC02) // Green
        .setTitle('✅ Goals Added!')
        .setDescription(goalList)
        .setFooter({
          text: `${goals.length} goal${goals.length !== 1 ? 's' : ''} created • Use /goals to view • Use /complete [numbers] to finish`
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`${goals.length} goals created for user ${user.id}`);
    } catch (error) {
      logger.error('Error creating goals', error);
      await interaction.editReply({
        content: '❌ An error occurred while creating your goals. Please try again.',
      });
    }
  },
};
