/**
 * /help Command
 *
 * Displays all available commands and how to use them.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('HelpCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands and how to use them'),

  async execute(interaction) {
    logger.info(`User ${interaction.user.username} (${interaction.user.id}) requested help`);

    const embed = new EmbedBuilder()
      .setColor(0x1CB0F6) // Blue
      .setTitle('Study Together Bot - Commands')
      .setDescription('Track your productivity and compete with friends!')
      .addFields(
        {
          name: 'Session Management',
          value:
            '`/start {activity}` - Start a new session\n' +
            '`/time` - Check your current session status\n' +
            '`/pause` - Pause your active session\n' +
            '`/unpause` - Unpause your paused session\n' +
            '`/stop` - Complete and share your session\n' +
            '`/cancel` - Cancel session without saving\n' +
            '`/manual` - Log a past session manually',
          inline: false
        },
        {
          name: 'Statistics & Leaderboards',
          value:
            '`/stats` - View your personal statistics\n' +
            '`/leaderboard` - Interactive leaderboard with daily/weekly/monthly views\n' +
            '`/achievements` - View your achievements\n' +
            '`/profile [@user]` - View detailed user profile',
          inline: false
        },
        {
          name: 'Goals',
          value:
            '`/goal add {goal} {difficulty}` - Add a new goal (Easy: 50 XP, Medium: 100 XP, Hard: 200 XP)\n' +
            '`/goal complete` - Mark a goal as complete and earn XP\n' +
            '`/goal list` - View all your active goals',
          inline: false
        },
        {
          name: 'Social',
          value:
            '`/live` - See who\'s currently studying',
          inline: false
        },
        {
          name: 'Server Setup (Admin Only)',
          value:
            '`/setup-feed {channel}` - Set feed channel for session posts\n' +
            '`/set-welcome-channel {channel}` - Set welcome channel for new members\n' +
            '`/setup-events-channel {channel}` - Set events channel for study events',
          inline: false
        },
        {
          name: 'Tips',
          value:
            '• Earn XP and level up by completing sessions (10 XP/hour + bonuses)\n' +
            '• Unlock 20 achievements by hitting milestones\n' +
            '• React to others\' session posts to unlock social achievements\n' +
            '• Build streaks by completing sessions daily',
          inline: false
        }
      )
      .setFooter({ text: 'Start your journey with /start {activity}' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });

    logger.info(`Help command displayed to user ${interaction.user.id}`);
  },
};
