/**
 * /graph Command
 *
 * Auto-generate historical stats chart with interactive dropdown selectors.
 * Displays data visualization for different metrics and timeframes.
 */

import {
  SlashCommandBuilder,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { StatsImageService } from '../../services/statsImage';
import { StatsImageLightService } from '../../services/statsImageLight';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GraphCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('graph')
    .setDescription('View your stats graph with customizable metrics and timeframes'),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: false });

    try {
      logger.info(`User ${user.username} (${user.id}) viewing graph`);

      // Initialize services
      const statsService = new StatsService(db);

      // Get user stats and check light mode preference
      const userStats = await statsService.getUserStats(user.id);
      const useLightMode = userStats?.lightMode || false;

      // Choose appropriate image service based on preference
      const statsImageService = useLightMode
        ? new StatsImageLightService()
        : new StatsImageService();

      // Default: Hours over the past week
      const defaultMetric = 'hours';
      const defaultTimeframe = 'week';

      // Get historical data
      const chartData = await statsService.getHistoricalChartData(
        user.id,
        defaultMetric,
        defaultTimeframe
      );

      logger.info(`Fetched chart data for ${user.username}`, {
        dataPoints: chartData.data.length,
        currentValue: chartData.currentValue,
        previousValue: chartData.previousValue,
      });

      // Get avatar URL
      const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

      // Generate stats chart image
      const imageBuffer = await statsImageService.generateStatsImage(
        user.username,
        defaultMetric,
        defaultTimeframe,
        chartData.data,
        chartData.currentValue,
        chartData.previousValue,
        avatarUrl
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats-chart.png' });

      // Create dropdown menus for metric and timeframe selection
      const metricMenu = new StringSelectMenuBuilder()
        .setCustomId(`stats-metric:${user.id}`)
        .setPlaceholder('Change metric')
        .addOptions([
          {
            label: 'Hours Studied',
            description: 'View your study hours over time',
            value: 'hours',
            emoji: '⏱️',
            default: true,
          },
          {
            label: 'Total Hours',
            description: 'View cumulative hours studied',
            value: 'totalHours',
            emoji: '📈',
          },
          {
            label: 'XP Earned',
            description: 'View your XP gains over time',
            value: 'xp',
            emoji: '⚡',
          },
          {
            label: 'Sessions Completed',
            description: 'View your session count over time',
            value: 'sessions',
            emoji: '📚',
          },
        ]);

      const timeframeMenu = new StringSelectMenuBuilder()
        .setCustomId(`stats-timeframe:${user.id}`)
        .setPlaceholder('Change timeframe')
        .addOptions([
          {
            label: 'Past 7 Days',
            description: 'View last week\'s stats',
            value: 'week',
            emoji: '📅',
            default: true,
          },
          {
            label: 'Past 30 Days',
            description: 'View last month\'s stats',
            value: 'month',
            emoji: '📆',
          },
          {
            label: 'Past Year',
            description: 'View yearly stats',
            value: 'year',
            emoji: '📊',
          },
        ]);

      const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(timeframeMenu);
      const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(metricMenu);

      // Initialize the user's selection state (if statsSelections is available on client)
      // @ts-ignore - statsSelections is extended in config/discord.ts
      if (!client.statsSelections) {
        // @ts-ignore
        client.statsSelections = new Map();
      }
      // @ts-ignore
      client.statsSelections.set(user.id, { metric: defaultMetric, timeframe: defaultTimeframe });

      // Send the chart with dropdown menus below (timeframe first, then metric)
      await interaction.editReply({
        files: [attachment],
        components: [row1, row2],
      });

      logger.info(`Graph displayed for user ${user.id}`);
    } catch (error) {
      logger.error('Error generating stats chart', error);
      await interaction.editReply({
        content: 'Failed to generate stats chart. Please try again later.',
      });
    }
  },
};
