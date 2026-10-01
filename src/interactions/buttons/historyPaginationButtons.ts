/**
 * History Pagination Button Handler
 *
 * Custom ID format: history_page:{viewerId}:{targetUserId}:{page}:{direction}
 *   direction = 'prev' | 'next'
 *
 * No in-memory state needed — page number and user IDs are encoded in the ID.
 */

import { ButtonInteraction, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { StatsService } from '../../services/stats';
import { HistoryImageService, calcTotalPages } from '../../services/historyImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('HistoryPaginationButtons');

export async function handleHistoryPagination(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  try {
    // Format: history_page:{viewerId}:{targetUserId}:{currentPage}:{direction}
    const parts = interaction.customId.split(':');
    const viewerId    = parts[1];
    const targetUserId = parts[2];
    const currentPage = parseInt(parts[3], 10);
    const direction   = parts[4]; // 'prev' | 'next'

    // Only the person who ran the command can paginate
    if (interaction.user.id !== viewerId) {
      await interaction.reply({
        content: '❌ Only the person who ran `/history` can use these buttons.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    const statsService   = new StatsService(db);
    const historyService = new HistoryImageService();

    const stats = await statsService.getUserStats(targetUserId);
    if (!stats) {
      await interaction.editReply({ content: '❌ Could not load user stats.', components: [] });
      return;
    }

    const pastPeriodCount = (stats.resetHistory ?? []).length;
    const totalPages = calcTotalPages(pastPeriodCount);

    const newPage = direction === 'next'
      ? Math.min(currentPage + 1, totalPages - 1)
      : Math.max(currentPage - 1, 0);

    // Fetch avatar
    const targetDiscordUser = await interaction.client.users.fetch(targetUserId);
    const avatarUrl = targetDiscordUser.displayAvatarURL({ size: 256, extension: 'png' });

    const imageBuffer = await historyService.generateHistoryImage(
      targetDiscordUser.username,
      stats,
      avatarUrl,
      newPage
    );

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'history.png' });
    const row = buildButtonRow(viewerId, targetUserId, newPage, totalPages);

    await interaction.editReply({ files: [attachment], components: row ? [row] : [] });

    logger.info(`${interaction.user.username} navigated history to page ${newPage + 1}/${totalPages}`);
  } catch (error) {
    logger.error('Error handling history pagination:', error);
    await interaction.followUp({
      content: '❌ Failed to navigate. Please run `/history` again.',
      ephemeral: true,
    }).catch(() => {});
  }
}

export function buildButtonRow(
  viewerId: string,
  targetUserId: string,
  page: number,
  totalPages: number
): ActionRowBuilder<ButtonBuilder> | null {
  if (totalPages <= 1) return null;

  const prev = new ButtonBuilder()
    .setCustomId(`history_page:${viewerId}:${targetUserId}:${page}:prev`)
    .setLabel('◀  Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page === 0);

  const next = new ButtonBuilder()
    .setCustomId(`history_page:${viewerId}:${targetUserId}:${page}:next`)
    .setLabel('Next  ▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next);
}
