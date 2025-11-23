/**
 * /stats Command
 *
 * View productivity statistics with interactive timeframe and metric selection.
 * Displays visual overview with dropdown menu for different metrics and timeframes.
 */

import {
  SlashCommandBuilder,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { StatsOverviewImageService } from '../../services/statsOverviewImage';
import { getStartOfDayPacific, getStartOfMonthPacific } from '../../utils/timeHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StatsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your productivity statistics')
    .addStringOption((option) =>
      option
        .setName('timeframe')
        .setDescription('Time period to view')
        .setRequired(false)
        .addChoices(
          { name: 'Today', value: 'today' },
          { name: 'This Week', value: 'week' },
          { name: 'This Month', value: 'month' },
          { name: 'All Time', value: 'all-time' }
        )
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) viewing stats`);

    // Initialize services
    const statsService = new StatsService(db);
    const sessionService = new SessionService(db);
    const statsOverviewImageService = new StatsOverviewImageService();

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

      // Calculate stats for all timeframes
      const today = getStartOfDayPacific();
      const todaySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(today)
      );

      // Use rolling 7-day window (same as /graph)
      const now = new Date();
      const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const weeklySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(weekStart)
      );

      const monthStart = getStartOfMonthPacific();
      const monthlySessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(monthStart)
      );

      const allSessions = await sessionService.getCompletedSessions(user.id);

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

      // Generate stats image
      const imageBuffer = await statsOverviewImageService.generateStatsOverviewImage(
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
        name: 'stats-overview.png',
      });

      // Create dropdown menu for metric/timeframe selection
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`stats_select_${user.id}`)
        .setPlaceholder('Change metric or timeframe')
        .addOptions([
          {
            label: 'Hours - This Week',
            description: 'View your total hours for this week',
            value: 'hours_week',
            default: true,
          },
          {
            label: 'Hours - This Month',
            description: 'View your total hours for this month',
            value: 'hours_month',
          },
          {
            label: 'Hours - All Time',
            description: 'View your total hours all time',
            value: 'hours_all-time',
          },
          {
            label: 'Sessions - This Week',
            description: 'View your total sessions for this week',
            value: 'sessions_week',
          },
          {
            label: 'Sessions - This Month',
            description: 'View your total sessions for this month',
            value: 'sessions_month',
          },
          {
            label: 'Sessions - All Time',
            description: 'View your total sessions all time',
            value: 'sessions_all-time',
          },
          {
            label: 'XP - This Week',
            description: 'View your total XP for this week',
            value: 'xp_week',
          },
          {
            label: 'XP - This Month',
            description: 'View your total XP for this month',
            value: 'xp_month',
          },
          {
            label: 'XP - All Time',
            description: 'View your total XP all time',
            value: 'xp_all-time',
          },
        ]);

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      // Create "View Graph" button
      const graphButton = new ButtonBuilder()
        .setCustomId(`view_graph_${user.id}`)
        .setLabel('View Graph')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊');

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(graphButton);

      await interaction.editReply({
        files: [attachment],
        components: [selectRow, buttonRow],
      });

      logger.info(`Stats displayed for user ${user.id}`);
    } catch (error) {
      logger.error('Error generating stats overview', error);
      await interaction.editReply({
        content: 'Failed to generate stats overview. Please try again later.',
      });
    }
  },
};
