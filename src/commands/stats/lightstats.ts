/**
 * /lightstats Command
 *
 * Displays productivity statistics in light mode (simplified version for testing).
 * Shows weekly hours breakdown by default.
 */

import {
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { StatsOverviewImageLightService } from '../../services/statsOverviewImageLight';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LightStatsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lightstats')
    .setDescription('View your productivity statistics (Light Mode)'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) viewing light mode stats`);

    // Initialize services
    const statsService = new StatsService(db);
    const sessionService = new SessionService(db);
    const statsOverviewImageLightService = new StatsOverviewImageLightService();

    // Get user stats
    const stats = await statsService.getUserStats(user.id);

    if (!stats) {
      await interaction.reply({
        content:
          'No stats yet! Complete your first session with /start and /stop.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      // Default to weekly hours
      const defaultMetric = 'hours';
      const defaultTimeframe = 'week';

      // Use rolling 7-day window
      const now = new Date();
      const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const weeklySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(weekStart)
      );

      // Get previous week sessions for comparison (7-13 days ago)
      const twoWeeksAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      twoWeeksAgo.setHours(0, 0, 0, 0);
      const allPreviousWeekSessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(twoWeeksAgo)
      );
      const previousWeekSessions = allPreviousWeekSessions.filter(s =>
        s.endTime.toDate() < weekStart
      );

      // Calculate current and previous values for weekly hours
      const currentValue = Math.round(weeklySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
      const previousValue = Math.round(previousWeekSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);

      // Calculate breakdown by day (last 7 days)
      const breakdown = [];
      const dayStart = new Date(weekStart);
      let highlightIndex = -1;

      for (let i = 0; i < 7; i++) {
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const daySessions = weeklySessions.filter(s => {
          const sessionDate = s.endTime.toDate();
          return sessionDate >= dayStart && sessionDate < dayEnd;
        });

        const dayHours = Math.round(daySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);

        // Check if this is today
        const isToday = dayStart.toDateString() === now.toDateString();
        if (isToday) {
          highlightIndex = i;
        }

        // Get day name - use "Today" for current day
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = isToday ? 'Today' : days[dayStart.getDay()];

        breakdown.push({ label: dayName, value: dayHours });

        dayStart.setDate(dayStart.getDate() + 1);
      }

      // Get user avatar
      const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

      // Generate light mode stats image
      const imageBuffer = await statsOverviewImageLightService.generateStatsOverviewImage(
        user.username,
        defaultMetric as 'hours' | 'sessions' | 'xp',
        defaultTimeframe as 'today' | 'week' | 'month' | 'all-time',
        currentValue,
        previousValue,
        breakdown,
        avatarUrl,
        highlightIndex
      );

      const attachment = new AttachmentBuilder(imageBuffer, {
        name: 'stats-overview-light.png',
      });

      await interaction.editReply({
        content: '☀️ **Light Mode Preview** - Weekly Hours',
        files: [attachment],
      });

      logger.info(`Light mode stats generated successfully for user ${user.id}`);
    } catch (error) {
      logger.error('Error generating light mode stats image', error);
      await interaction.editReply({
        content: '❌ Failed to generate light mode stats image. Please try again later.',
      });
    }
  },
};
