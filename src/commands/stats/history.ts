/**
 * /history Command
 *
 * Generates a beautiful image showing a user's XP and hours across every
 * reset period (Duolingo-style dark card, same aesthetic as /profile).
 *
 * - Accepts an optional `user` parameter to view someone else's history
 * - Public reply (visible to the channel)
 * - Image includes: per-period 5-point summary + all-time cumulative totals
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { HistoryImageService } from '../../services/historyImage';
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

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const isSelf = targetUser.id === interaction.user.id;

    await interaction.deferReply({ ephemeral: false });

    try {
      const statsService    = new StatsService(db);
      const historyService  = new HistoryImageService();

      const stats = await statsService.getUserStats(targetUser.id);

      if (!stats) {
        await interaction.editReply({
          content: isSelf
            ? '❌ You have no stats yet. Complete a session to get started!'
            : `❌ ${targetUser.username} hasn't logged any sessions yet.`,
        });
        return;
      }

      const hasHistory = (stats.resetHistory ?? []).length > 0;
      const hasCurrent = (stats.xp || 0) > 0 || (stats.totalDuration || 0) > 0;

      if (!hasHistory && !hasCurrent) {
        await interaction.editReply({
          content: isSelf
            ? 'You have no history yet — your stats will be snapshotted automatically when a reset is performed.'
            : `${targetUser.username} has no history yet.`,
        });
        return;
      }

      const avatarUrl = targetUser.displayAvatarURL({ size: 256, extension: 'png' });

      logger.info(
        `Generating history image for ${targetUser.username} ` +
        `(${(stats.resetHistory ?? []).length} past periods)`
      );

      const imageBuffer = await historyService.generateHistoryImage(
        targetUser.username,
        stats,
        avatarUrl
      );

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'history.png' });

      await interaction.editReply({ files: [attachment] });
    } catch (error) {
      logger.error('Error generating history image:', error);
      await interaction.editReply({
        content: '❌ Failed to generate history. Please try again later.',
      });
    }
  },
};
