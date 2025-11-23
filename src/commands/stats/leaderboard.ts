/**
 * /leaderboard Command
 *
 * View server leaderboards with interactive timeframe selector.
 * Displays top performers with visual ranking and current user position.
 */

import {
  SlashCommandBuilder,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { ProfileImageService } from '../../services/profileImage';
import { getStartOfDayPacific, getStartOfWeekPacific, getStartOfMonthPacific } from '../../utils/timeHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LeaderboardCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server leaderboards with timeframe selector')
    .addStringOption(option =>
      option
        .setName('timeframe')
        .setDescription('Leaderboard timeframe')
        .setRequired(false)
        .addChoices(
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
          { name: 'Monthly', value: 'monthly' },
          { name: 'All-Time', value: 'all-time' }
        )
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      logger.info(`User ${user.username} (${user.id}) viewing leaderboard for guild ${guildId}`);

      // Initialize services
      const sessionService = new SessionService(db);
      const statsService = new StatsService(db);
      const profileImageService = new ProfileImageService();

      // Get timeframe parameter (default to daily)
      const timeframe = (interaction.options.getString('timeframe') || 'daily') as 'daily' | 'weekly' | 'monthly' | 'all-time';

      // Get data based on timeframe - ALL timeframes filter by server
      let topUsers: Array<{ userId: string; username: string; totalDuration: number; xp?: number }> = [];

      if (timeframe === 'all-time') {
        // Get all-time top users by XP - filtered by server
        const xpUsers = await statsService.getTopUsersByXP(20, guildId);
        topUsers = xpUsers.map(u => ({
          userId: u.userId,
          username: u.username,
          totalDuration: u.totalDuration || 0,
          xp: u.xp
        }));
      } else {
        // Get time-based leaderboard
        let startTime: Date;
        if (timeframe === 'daily') {
          startTime = getStartOfDayPacific();
        } else if (timeframe === 'weekly') {
          startTime = getStartOfWeekPacific();
        } else {
          startTime = getStartOfMonthPacific();
        }

        topUsers = await sessionService.getTopUsers(Timestamp.fromDate(startTime), 20, guildId);
      }

      // Prepare leaderboard entries for image generation
      let entries: Array<{ userId: string; username: string; avatarUrl: string; xp: number; totalDuration: number; rank: number }> = [];
      let currentUserEntry = undefined;

      if (topUsers.length === 0) {
        // No real data available - pass empty arrays, image generator will handle gracefully
        entries = [];
        currentUserEntry = undefined;
      } else {
        // Get top 10
        const top10 = topUsers.slice(0, 10);

        // Check if current user is in top 10
        const userPosition = topUsers.findIndex(u => u.userId === user.id);

        // Prepare leaderboard entries with avatars
        entries = await Promise.all(
          top10.map(async (u, index) => {
            try {
              const discordUser = await client.users.fetch(u.userId);
              const stats = await statsService.getUserStats(u.userId);
              return {
                userId: u.userId,
                username: u.username,
                avatarUrl: discordUser.displayAvatarURL({ size: 128, extension: 'png' }),
                xp: stats?.xp || 0,
                totalDuration: u.totalDuration,
                rank: index + 1,
              };
            } catch (error) {
              logger.error(`Failed to fetch user ${u.userId}`, error);
              return {
                userId: u.userId,
                username: u.username,
                avatarUrl: '', // Fallback
                xp: 0,
                totalDuration: u.totalDuration,
                rank: index + 1,
              };
            }
          })
        );

        // Prepare current user entry if they're not in top 10
        if (userPosition > 9) {
          const userStats = await statsService.getUserStats(user.id);
          currentUserEntry = {
            userId: user.id,
            username: user.username,
            avatarUrl: user.displayAvatarURL({ size: 128, extension: 'png' }),
            xp: userStats?.xp || 0,
            totalDuration: topUsers[userPosition].totalDuration,
            rank: userPosition + 1,
          };
        }
      }

      // Generate leaderboard image - pass current user ID for highlighting
      const imageBuffer = await profileImageService.generateLeaderboardImage(
        timeframe,
        entries,
        currentUserEntry,
        user.id // Pass current user ID for highlighting in top 10
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

      // Create select menu for switching timeframes
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_image_timeframe')
        .setPlaceholder('Select a timeframe')
        .addOptions([
          {
            label: 'Daily',
            description: 'Today\'s top performers',
            value: 'daily',
            emoji: '📅',
          },
          {
            label: 'Weekly',
            description: 'This week\'s leaders',
            value: 'weekly',
            emoji: '📊',
          },
          {
            label: 'Monthly',
            description: 'This month\'s champions',
            value: 'monthly',
            emoji: '🌟',
          },
          {
            label: 'All-Time',
            description: 'Lifetime XP rankings',
            value: 'all-time',
            emoji: '⚡',
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      // Send the image with dropdown
      await interaction.editReply({
        files: [attachment],
        components: [row],
      });

      logger.info(`Leaderboard (${timeframe}) displayed for guild ${guildId}`);
    } catch (error) {
      logger.error('Error generating leaderboard image', error);
      await interaction.editReply({
        content: 'Failed to generate leaderboard. Please try again later.',
      });
    }
  },
};
