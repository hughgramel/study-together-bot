/**
 * /post Command
 *
 * Preview what your session completion post will look like in the feed.
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { PostImageService } from '../../services/postImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PostCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('post')
    .setDescription('Preview what your session completion post will look like in the feed'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: false });

    try {
      logger.info(`User ${user.username} (${user.id}) requested post preview`);

      // Get user stats for realistic sample data
      const statsService = new StatsService(db);
      const stats = await statsService.getUserStats(user.id);
      const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

      // Create sample session data based on user's recent activity
      const sampleDuration = '2h 15m';
      const sampleXp = 135; // Sample XP value
      const sampleActivity = 'Math homework';
      const sampleIntensity = 3; // Moderate intensity
      const sampleTitle = 'Productive study session';
      const sampleDescription = 'Completed calculus problems and reviewed chapter 5';

      // Format sample date
      const now = new Date();
      const sampleDate = now.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Generate the session post image
      const postImageService = new PostImageService();
      const imageBuffer = await postImageService.generateSessionPostImage(
        user.username,
        sampleDuration,
        sampleXp,
        sampleActivity,
        sampleIntensity,
        avatarUrl,
        sampleTitle,
        sampleDescription,
        sampleDate
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'session-post.png' });

      // Send the preview
      await interaction.editReply({
        content: 'Session Post Preview\nThis is what your completed session posts will look like in the feed!',
        files: [attachment],
      });

      logger.info(`Post preview generated for user ${user.id}`);
    } catch (error) {
      logger.error('Error generating post preview', error);
      await interaction.editReply({
        content: 'Failed to generate post preview. Please try again later.',
      });
    }
  },
};
