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
    .setDescription('View stats graph with customizable metrics and timeframes')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view the graph for (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const targetUser = interaction.options.getUser('user') || interaction.user;

    await interaction.deferReply({ ephemeral: false });

    try {
      logger.info(`User ${interaction.user.username} viewing graph for ${targetUser.username}`);

      // Initialize services
      const statsService = new StatsService(db);

      // Get user stats and check light mode preference (use requesting user's preference)
      const requestingUserStats = await statsService.getUserStats(interaction.user.id);
      const useLightMode = requestingUserStats?.lightMode || false;

      // Choose appropriate image service based on preference
      const statsImageService = useLightMode
        ? new StatsImageLightService()
        : new StatsImageService();

      // Default: Hours over the past week
      const defaultMetric = 'hours';
      const defaultTimeframe = 'week';

      // Get historical data for the target user
      const chartData = await statsService.getHistoricalChartData(
        targetUser.id,
        defaultMetric,
        defaultTimeframe
      );

      logger.info(`Fetched chart data for ${targetUser.username}`, {
        dataPoints: chartData.data.length,
        currentValue: chartData.currentValue,
        previousValue: chartData.previousValue,
      });

      // Get avatar URL of the target user
      const avatarUrl = targetUser.displayAvatarURL({ size: 256, extension: 'png' });

      // Generate stats chart image
      const imageBuffer = await statsImageService.generateStatsImage(
        targetUser.username,
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
      // Use targetUser.id so the selectors work for the correct user
      const metricMenu = new StringSelectMenuBuilder()
        .setCustomId(`stats-metric:${targetUser.id}`)
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
        .setCustomId(`stats-timeframe:${targetUser.id}`)
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

      // Initialize the target user's selection state (if statsSelections is available on client)
      // @ts-ignore - statsSelections is extended in config/discord.ts
      if (!client.statsSelections) {
        // @ts-ignore
        client.statsSelections = new Map();
      }
      // @ts-ignore
      client.statsSelections.set(targetUser.id, { metric: defaultMetric, timeframe: defaultTimeframe });

      // Send the chart with dropdown menus below (timeframe first, then metric)
      await interaction.editReply({
        files: [attachment],
        components: [row1, row2],
      });

      logger.info(`Graph displayed for user ${targetUser.id} (requested by ${interaction.user.id})`);
    } catch (error) {
      logger.error('Error generating stats chart', error);
      await interaction.editReply({
        content: 'Failed to generate stats chart. Please try again later.',
      });
    }
  },
};
