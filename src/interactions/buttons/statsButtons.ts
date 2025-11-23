/**
 * Stats Button Handlers
 *
 * Handles button interactions for stats, graphs, and analytics.
 */

import {
  ButtonInteraction,
  Client,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { StatsService } from '../../services/stats';
import { StatsImageService } from '../../services/statsImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StatsButtons');

/**
 * Handle view graph button
 */
export async function handleViewGraphButton(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const targetUserId = interaction.customId.replace('view_graph_', '');
  const user = interaction.user;

  if (user.id !== targetUserId) {
    await interaction.reply({
      content: '❌ You can only view your own graphs.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  try {
    const statsService = new StatsService(db);
    const statsImageService = new StatsImageService();

    // Default: Hours over the past week
    const defaultMetric = 'hours';
    const defaultTimeframe = 'week';

    // Get historical data
    const chartData = await statsService.getHistoricalChartData(
      user.id,
      defaultMetric,
      defaultTimeframe
    );

    // Get user avatar
    const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

    // Generate chart image
    const imageBuffer = await statsImageService.generateStatsImage(
      user.username,
      defaultMetric,
      defaultTimeframe,
      chartData.data,
      chartData.currentValue,
      chartData.previousValue,
      avatarUrl
    );

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats-chart.png' });

    // Create dropdown menus for switching metrics and timeframes
    const metricSelect = new StringSelectMenuBuilder()
      .setCustomId(`graph_metric_${user.id}`)
      .setPlaceholder('Change metric')
      .addOptions([
        { label: '⏱️ Hours', value: 'hours', default: true },
        { label: '📚 Sessions', value: 'sessions' },
        { label: '⚡ XP Earned', value: 'xp' },
      ]);

    const timeframeSelect = new StringSelectMenuBuilder()
      .setCustomId(`graph_timeframe_${user.id}`)
      .setPlaceholder('Change timeframe')
      .addOptions([
        { label: '📆 Past Week', value: 'week', default: true },
        { label: '📅 Past Month', value: 'month' },
        { label: '📊 Past Year', value: 'year' },
      ]);

    const metricRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      metricSelect
    );
    const timeframeRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      timeframeSelect
    );

    await interaction.editReply({
      files: [attachment],
      components: [metricRow, timeframeRow],
    });

    logger.info(`Generated graph for user ${user.username} (${user.id})`);
  } catch (error) {
    logger.error('Error generating graph:', error);
    await interaction.editReply({
      content: '❌ Failed to generate graph. Please try again later.',
    });
  }
}

/**
 * Handle view stats button
 */
export async function handleViewStatsButton(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const targetUserId = interaction.customId.replace('view_stats_', '');
  const user = interaction.user;

  if (user.id !== targetUserId) {
    await interaction.reply({
      content: '❌ You can only view your own stats.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  try {
    const statsService = new StatsService(db);
    const statsImageService = new StatsImageService();

    // Default: Hours, Week
    const defaultMetric = 'hours';
    const defaultTimeframe = 'week';

    // Get historical data
    const chartData = await statsService.getHistoricalChartData(
      user.id,
      defaultMetric,
      defaultTimeframe
    );

    // Get user avatar
    const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

    // Generate stats card image
    const imageBuffer = await statsImageService.generateStatsImage(
      user.username,
      defaultMetric,
      defaultTimeframe,
      chartData.data,
      chartData.currentValue,
      chartData.previousValue,
      avatarUrl
    );

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: 'stats-card.png',
    });

    // Create selector for switching metric/timeframe
    const selector = new StringSelectMenuBuilder()
      .setCustomId(`stats_select_${user.id}`)
      .setPlaceholder('Change view')
      .addOptions([
        { label: '⏱️ Hours - Today', value: 'hours_today', default: true },
        { label: '⏱️ Hours - This Week', value: 'hours_week' },
        { label: '⏱️ Hours - This Month', value: 'hours_month' },
        { label: '⏱️ Hours - All Time', value: 'hours_all-time' },
        { label: '📚 Sessions - Today', value: 'sessions_today' },
        { label: '📚 Sessions - This Week', value: 'sessions_week' },
        { label: '📚 Sessions - This Month', value: 'sessions_month' },
        { label: '📚 Sessions - All Time', value: 'sessions_all-time' },
        { label: '⚡ XP - Today', value: 'xp_today' },
        { label: '⚡ XP - This Week', value: 'xp_week' },
        { label: '⚡ XP - This Month', value: 'xp_month' },
        { label: '⚡ XP - All Time', value: 'xp_all-time' },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selector);

    await interaction.editReply({
      files: [attachment],
      components: [row],
    });

    logger.info(`Generated stats card for user ${user.username} (${user.id})`);
  } catch (error) {
    logger.error('Error generating stats card:', error);
    await interaction.editReply({
      content: '❌ Failed to generate stats card. Please try again later.',
    });
  }
}
