/**
 * /profile Command
 *
 * View a user's profile with comprehensive stats and achievements.
 * Generates a visual profile card with all user statistics.
 */

import {
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { ProfileImageService } from '../../services/profileImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ProfileCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a user\'s profile with all stats and achievements')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to view (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: false });

    try {
      const targetUser = interaction.options.getUser('user') || user;

      logger.info(`User ${user.username} (${user.id}) viewing profile for ${targetUser.username} (${targetUser.id})`);

      // Initialize services
      const statsService = new StatsService(db);
      const profileImageService = new ProfileImageService();

      // Get target user stats
      const stats = await statsService.getUserStats(targetUser.id);

      if (!stats) {
        await interaction.editReply({
          content: `${targetUser.id === user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} completed any sessions yet!`,
        });
        return;
      }

      // Get avatar URL
      const avatarUrl = targetUser.displayAvatarURL({ size: 256, extension: 'png' });

      // Generate profile image
      const imageBuffer = await profileImageService.generateProfileImage(
        targetUser.username,
        stats,
        avatarUrl
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });

      // Send the image
      await interaction.editReply({
        files: [attachment],
      });

      logger.info(`Profile displayed for user ${targetUser.id}`);
    } catch (error) {
      logger.error('Error generating profile image', error);
      await interaction.editReply({
        content: 'Failed to generate profile image. Please try again later.',
      });
    }
  },
};
