/**
 * /achievements Command
 *
 * View leveled achievements with progress tracking.
 * Displays all 4 core achievements with levels, progress bars, and XP boost.
 */

import {
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { LeveledAchievementService } from '../../services/leveledAchievements';
import { leveledAchievementsImageService } from '../../services/leveledAchievementsImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AchievementsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View your achievement progress and XP boost'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) viewing achievements`);

    // Initialize services
    const statsService = new StatsService(db);
    const achievementService = new LeveledAchievementService(db);

    // Get user stats
    const stats = await statsService.getUserStats(user.id);

    if (!stats) {
      await interaction.reply({
        content: 'No stats yet! Complete sessions to unlock achievements.',
        ephemeral: true,
      });
      return;
    }

    // Defer reply since image generation may take a moment
    await interaction.deferReply({ ephemeral: false });

    try {
      // Get achievement progress
      const progressData = await achievementService.getUserAchievementProgress(user.id);

      // Get avatar URL
      const avatarUrl = user.displayAvatarURL({ size: 128, extension: 'png' });

      // Check user's light mode preference
      const lightMode = stats.lightMode || false;

      // Generate achievement image
      const imageBuffer = await leveledAchievementsImageService.generateAchievementsImage(
        user.username,
        avatarUrl,
        progressData.achievements,
        progressData.totalBoost,
        lightMode
      );

      const attachment = new AttachmentBuilder(imageBuffer, {
        name: 'achievements.png',
      });

      await interaction.editReply({
        files: [attachment],
      });

      logger.info(
        `Achievements displayed for user ${user.id} (Boost: +${progressData.totalBoost.toFixed(1)}%)`
      );
    } catch (error) {
      logger.error('Error generating achievements image', error);
      await interaction.editReply({
        content: 'Failed to generate achievements image. Please try again later.',
      });
    }
  },
};
