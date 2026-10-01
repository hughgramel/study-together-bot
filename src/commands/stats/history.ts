/**
 * /history Command
 *
 * Generates a paginated image card showing a user's XP and hours across every
 * reset period. Arrow buttons let anyone page through older seasons.
 *
 * Page 0:  cumulative totals + current period + most recent past period
 * Page 1+: 3 past periods per page
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { HistoryImageService, calcTotalPages } from '../../services/historyImage';
import { buildButtonRow } from '../../interactions/buttons/historyPaginationButtons';
import { createLogger } from '../../utils/logger';

const logger = createLogger('HistoryCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View XP and hours history across all reset periods')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to view (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { db } = context;

    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const isSelf     = targetUser.id === interaction.user.id;

    await interaction.deferReply({ ephemeral: false });

    try {
      const statsService   = new StatsService(db);
      const historyService = new HistoryImageService();

      const stats = await statsService.getUserStats(targetUser.id);

      if (!stats) {
        await interaction.editReply({
          content: isSelf
            ? '❌ You have no stats yet. Complete a session to get started!'
            : `❌ ${targetUser.username} hasn't logged any sessions yet.`,
        });
        return;
      }

      const pastPeriodCount = (stats.resetHistory ?? []).length;
      const hasCurrent = (stats.xp ?? 0) > 0 || (stats.totalDuration ?? 0) > 0;

      if (pastPeriodCount === 0 && !hasCurrent) {
        await interaction.editReply({
          content: isSelf
            ? 'You have no history yet — stats are snapshotted automatically when a reset is performed.'
            : `${targetUser.username} has no history yet.`,
        });
        return;
      }

      const avatarUrl  = targetUser.displayAvatarURL({ size: 256, extension: 'png' });
      const totalPages = calcTotalPages(pastPeriodCount);

      logger.info(`Generating history p1/${totalPages} for ${targetUser.username} (${pastPeriodCount} past periods)`);

      const imageBuffer = await historyService.generateHistoryImage(
        targetUser.username,
        stats,
        avatarUrl,
        0   // always start on page 0
      );

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'history.png' });
      const buttonRow  = buildButtonRow(interaction.user.id, targetUser.id, 0, totalPages);

      await interaction.editReply({
        files: [attachment],
        components: buttonRow ? [buttonRow] : [],
      });
    } catch (error) {
      logger.error('Error generating history image:', error);
      await interaction.editReply({
        content: '❌ Failed to generate history. Please try again later.',
      });
    }
  },
};
