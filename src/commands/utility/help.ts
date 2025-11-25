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

    try {
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
              '`/manual` - Log a past session manually\n' +
              '`/reduce-time` - Reduce your own time (self-correction)\n' +
              '`/reduce-xp` - Reduce your own XP (self-correction)',
            inline: false
          },
          {
            name: 'Statistics & Leaderboards',
            value:
              '`/stats` - View your personal statistics\n' +
              '`/leaderboard` - Interactive leaderboard with daily/weekly/monthly views\n' +
              '`/achievements` - View your achievements\n' +
              '`/profile [@user]` - View detailed user profile\n' +
              '`/graph [@user]` - View stats graph with customizable metrics\n' +
              '`/live` - See who\'s currently studying',
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
            name: 'Study Groups',
            value:
              '`/creategroup` - Create a new study group\n' +
              '`/joingroup` - Join an existing group\n' +
              '`/leavegroup` - Leave your current group\n' +
              '`/group` - View your group info\n' +
              '`/findgroups` - Browse available groups\n' +
              '`/groupleaderboard` - View group leaderboard',
            inline: false
          },
          {
            name: 'Events',
            value:
              '`/createevent` - Create a study event\n' +
              '`/events` - View active events\n' +
              '`/myevents` - View your joined events\n' +
              '`/cancelevent` - Cancel an event you created',
            inline: false
          },
          {
            name: 'Admin Commands',
            value:
              '`/setup-feed {channel}` - Set feed channel for session posts\n' +
              '`/set-welcome-channel {channel}` - Set welcome channel for new members\n' +
              '`/setup-events-channel {channel}` - Set events channel\n' +
              '`/setup-timezone {timezone}` - Set server timezone\n' +
              '`/admin-delete-xp` - Delete XP from a user (corrections)\n' +
              '`/admin-delete-time` - Delete time from a user (corrections)',
            inline: false
          },
          {
            name: 'Tips',
            value:
              '• Earn XP and level up by completing sessions (10 XP/hour + bonuses)\n' +
              '• Join a study group to earn bonus XP (1% per group level, max 50%)\n' +
              '• Unlock achievements by hitting milestones\n' +
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
    } catch (error) {
      logger.error('Error displaying help command:', error);
      await interaction.reply({
        content: 'Failed to display help information. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};
