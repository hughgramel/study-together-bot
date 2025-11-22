/**
 * /me Command
 *
 * Displays user's profile overview with stats, achievements, and group membership.
 */

import { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { ProfileImageService } from '../../services/profileImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MeCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('me')
    .setDescription('View your profile overview'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: false });

    logger.info(`User ${user.username} (${user.id}) viewing profile`);

    try {
      // Initialize services
      const statsService = new StatsService(db);
      const groupService = new GroupService(db);
      const profileImageService = new ProfileImageService();

      // Get user stats
      const stats = await statsService.getUserStats(user.id);

      // Get avatar URL
      const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });

      // Get user's group info (if they're in a group)
      let groupInfo;
      try {
        const userGroupData = await groupService.getUserGroup(user.id);
        if (userGroupData) {
          groupInfo = {
            groupName: userGroupData.group.name,
            groupId: userGroupData.group.groupId,
            groupLevel: userGroupData.group.level,
          };
        }
      } catch (error) {
        // User not in a group, that's fine
        logger.info(`User ${user.id} not in a group`);
      }

      // Generate profile image
      const imageBuffer = await profileImageService.generateProfileImage(
        user.username,
        stats,
        avatarUrl,
        groupInfo
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });

      // Create "View Graph" and "View Statistics" buttons
      const graphButton = new ButtonBuilder()
        .setCustomId(`view_graph_${user.id}`)
        .setLabel('View Graph')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊');

      const statsButton = new ButtonBuilder()
        .setCustomId(`view_stats_${user.id}`)
        .setLabel('View Statistics')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📈');

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(graphButton, statsButton);

      // Send the image with buttons
      await interaction.editReply({
        files: [attachment],
        components: [buttonRow],
      });

      logger.info(`Profile generated successfully for user ${user.id}`);
    } catch (error) {
      logger.error('Error generating profile image', error);
      await interaction.editReply({
        content: '❌ Failed to generate profile image. Please try again later.',
      });
    }
  },
};
