/**
 * Stats Select Menu Handlers
 *
 * Handles stats metric and timeframe selection interactions for graph generation.
 */

import {
  StringSelectMenuInteraction,
  Client,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { StatsService } from '../../services/stats';
import { StatsImageService } from '../../services/statsImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StatsSelect');

// In-memory store for user's current metric/timeframe selection
// This could be moved to a proper cache/session store if needed
const statsSelections = new Map<
  string,
  { metric: 'hours' | 'xp' | 'sessions' | 'totalHours'; timeframe: 'week' | 'month' | 'year' }
>();

/**
 * Handle stats metric or timeframe select menu
 */
export async function handleStatsMetricTimeframeSelect(
  interaction: StringSelectMenuInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  // Extract user ID from custom ID
  const parts = interaction.customId.split(':');
  const userId = parts[1];

  // Only allow the owner to interact with their stats menu
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: 'This stats menu belongs to someone else!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const statsService = new StatsService(db);
    const statsImageService = new StatsImageService();

    const currentSelection = statsSelections.get(userId) || {
      metric: 'hours' as const,
      timeframe: 'week' as const,
    };

    if (interaction.customId.startsWith('stats-metric:')) {
      currentSelection.metric = interaction.values[0] as 'hours' | 'xp' | 'sessions' | 'totalHours';
    } else {
      currentSelection.timeframe = interaction.values[0] as 'week' | 'month' | 'year';
    }

    statsSelections.set(userId, currentSelection);

    // Get historical data
    const chartData = await statsService.getHistoricalChartData(
      userId,
      currentSelection.metric,
      currentSelection.timeframe
    );

    // Get avatar URL
    const avatarUrl = interaction.user.displayAvatarURL({ size: 256, extension: 'png' });

    // Generate stats chart image
    const imageBuffer = await statsImageService.generateStatsImage(
      interaction.user.username,
      currentSelection.metric,
      currentSelection.timeframe,
      chartData.data,
      chartData.currentValue,
      chartData.previousValue,
      avatarUrl
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'stats-chart.png' });

    // Recreate dropdown menus with updated defaults
    const metricMenu = new StringSelectMenuBuilder()
      .setCustomId(`stats-metric:${userId}`)
      .setPlaceholder('Change metric')
      .addOptions([
        {
          label: 'Hours Studied',
          description: 'View your study hours over time',
          value: 'hours',
          emoji: '⏱️',
          default: currentSelection.metric === 'hours',
        },
        {
          label: 'Total Hours',
          description: 'View cumulative hours studied',
          value: 'totalHours',
          emoji: '📈',
          default: currentSelection.metric === 'totalHours',
        },
        {
          label: 'XP Earned',
          description: 'View your XP gains over time',
          value: 'xp',
          emoji: '⚡',
          default: currentSelection.metric === 'xp',
        },
        {
          label: 'Sessions Completed',
          description: 'View your session count over time',
          value: 'sessions',
          emoji: '📚',
          default: currentSelection.metric === 'sessions',
        },
      ]);

    const timeframeMenu = new StringSelectMenuBuilder()
      .setCustomId(`stats-timeframe:${userId}`)
      .setPlaceholder('Change timeframe')
      .addOptions([
        {
          label: 'Past 7 Days',
          description: "View last week's stats",
          value: 'week',
          emoji: '📅',
          default: currentSelection.timeframe === 'week',
        },
        {
          label: 'Past 30 Days',
          description: "View last month's stats",
          value: 'month',
          emoji: '📆',
          default: currentSelection.timeframe === 'month',
        },
        {
          label: 'Past Year',
          description: 'View yearly stats',
          value: 'year',
          emoji: '📊',
          default: currentSelection.timeframe === 'year',
        },
      ]);

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      timeframeMenu
    );
    const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(metricMenu);

    // Update the message with the new chart (timeframe first, then metric)
    await interaction.editReply({
      files: [attachment],
      components: [row1, row2],
    });

    logger.info(
      `User ${userId} updated stats: metric=${currentSelection.metric}, timeframe=${currentSelection.timeframe}`
    );
  } catch (error) {
    logger.error('Error generating stats chart:', error);
    await interaction.followUp({
      content: '❌ Failed to generate stats chart. Please try again later.',
      ephemeral: true,
    });
  }
}
