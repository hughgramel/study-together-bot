/**
 * /lightme Command
 *
 * Displays user's profile overview in light mode for testing and style refinement.
 */

import { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { ProfileImageLightService } from '../../services/profileImageLight';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LightMeCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lightme')
    .setDescription('View your profile overview (Light Mode)'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: false });

    logger.info(`User ${user.username} (${user.id}) viewing light mode profile`);

    try {
      // Initialize services
      const statsService = new StatsService(db);
      const groupService = new GroupService(db);
      const profileImageLightService = new ProfileImageLightService();

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

      // Generate light mode profile image
      const imageBuffer = await profileImageLightService.generateProfileImage(
        user.username,
        stats,
        avatarUrl,
        groupInfo
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile-light.png' });

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
        content: '☀️ **Light Mode Preview**',
        files: [attachment],
        components: [buttonRow],
      });

      logger.info(`Light mode profile generated successfully for user ${user.id}`);
    } catch (error) {
      logger.error('Error generating light mode profile image', error);
      await interaction.editReply({
        content: '❌ Failed to generate light mode profile image. Please try again later.',
      });
    }
  },
};
