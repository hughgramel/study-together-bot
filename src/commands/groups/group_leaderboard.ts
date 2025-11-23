/**
 * /group_leaderboard Command
 *
 * View the top groups ranked by level.
 * Displays groups with pagination support.
 */

import { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { StatsService } from '../../services/stats';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { groupOverviewImageLightService } from '../../services/groupOverviewImageLight';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupLeaderboardCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('group_leaderboard')
    .setDescription('View the top groups ranked by level'),

  async execute(interaction, context) {
    const { db } = context;
    const serverId = interaction.guildId;

    if (!serverId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      logger.info(`Generating group leaderboard for server ${serverId}`);

      // Initialize services
      const groupService = new GroupService(db);
      const statsService = new StatsService(db);

      // Get user's light mode preference
      const stats = await statsService.getUserStats(interaction.user.id);
      const useLightMode = stats?.lightMode || false;

      // Query all groups from Firestore ordered by level descending
      const groups = await groupService.getAllServerGroups(serverId);

      // Check if there are any groups
      if (groups.length === 0) {
        await interaction.editReply({
          content: '📊 No groups found in this server yet! Create one with `/creategroup` to get started.',
        });
        return;
      }

      // Pagination settings
      const page = 0;
      const pageSize = 5;
      const totalPages = Math.ceil(groups.length / pageSize);

      // Get current page of groups and transform to GroupLeaderboardEntry format
      const startIdx = page * pageSize;
      const endIdx = Math.min((page + 1) * pageSize, groups.length);
      const pageGroups = groups.slice(startIdx, endIdx).map((group, index) => ({
        rank: startIdx + index + 1,
        groupName: group.name,
        groupId: group.groupId,
        currentMembers: group.memberCount,
        maxMembers: group.maxMembers,
        groupLevel: group.level,
      }));

      // Generate group leaderboard image
      const imageService = useLightMode ? groupOverviewImageLightService : groupOverviewImageService;
      const imageBuffer = await imageService.generateGroupLeaderboardImage(pageGroups);

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-leaderboard.png' });

      // Create pagination buttons if there are multiple pages
      const components = [];
      if (totalPages > 1) {
        const prevButton = new ButtonBuilder()
          .setCustomId(`group_leaderboard_page:${page - 1}:real`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0);

        const nextButton = new ButtonBuilder()
          .setCustomId(`group_leaderboard_page:${page + 1}:real`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1);

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);
        components.push(buttonRow);
      }

      // Send the image with pagination buttons
      await interaction.editReply({
        content: totalPages > 1 ? `Page ${page + 1}/${totalPages}` : undefined,
        files: [attachment],
        components,
      });

      logger.info(`Group leaderboard generated successfully with ${groups.length} groups`);
    } catch (error) {
      logger.error('Error generating group leaderboard:', error);
      await interaction.editReply({
        content: '❌ Failed to generate group leaderboard. Please try again later.',
      });
    }
  },
};
