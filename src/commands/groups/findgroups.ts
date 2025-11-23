/**
 * /findgroups Command
 *
 * Browse public groups with available space.
 * Displays groups with pagination support.
 */

import { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { Command } from '../types';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { createLogger } from '../../utils/logger';
import { storeFindGroupsState } from '../../interactions/buttons/groupPaginationButtons';

const logger = createLogger('FindGroupsCommand');

/**
 * Simplified group data for display
 */
interface GroupSummary {
  groupId: string;
  groupName: string;
  groupLevel: number;
  currentMembers: number;
  maxMembers: number;
  xpModifier: number;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('findgroups')
    .setDescription('Browse public groups with available space'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      logger.info(`User ${user.username} browsing groups in server ${guildId}`);

      // Query public groups with available space in this server
      const groupsSnapshot = await db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .where('serverId', '==', guildId)
        .where('isPublic', '==', true)
        .get();

      // Filter groups with available space and transform to GroupSummary format
      const availableGroups: GroupSummary[] = groupsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            groupId: data.groupId || doc.id,
            groupName: data.name || 'Unnamed Group',
            groupLevel: data.level || 1,
            currentMembers: data.memberCount || 0,
            maxMembers: data.maxMembers || 5,
            xpModifier: data.level ? data.level * 0.01 : 0, // 1% per level
          };
        })
        .filter((group) => group.currentMembers < group.maxMembers)
        .sort((a, b) => b.groupLevel - a.groupLevel); // Sort by level descending

      if (availableGroups.length === 0) {
        await interaction.editReply({
          content: 'No public groups with available space found. Try creating your own group!',
        });
        return;
      }

      // Pagination setup
      const itemsPerPage = 5;
      const totalPages = Math.ceil(availableGroups.length / itemsPerPage);
      const currentPage = 1; // Start at page 1
      const pageGroups = availableGroups.slice(0, itemsPerPage);

      // Generate find groups image
      const imageBuffer = await groupOverviewImageService.generateFindGroupsImage(
        pageGroups,
        currentPage,
        totalPages
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'find-groups.png' });

      // Create navigation buttons
      const paginationId = `findgroups:${user.id}:${Date.now()}`;
      const prevButton = new ButtonBuilder()
        .setCustomId(`${paginationId}:prev`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1);

      const nextButton = new ButtonBuilder()
        .setCustomId(`${paginationId}:next`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

      const reply = await interaction.editReply({
        files: [attachment],
        components: totalPages > 1 ? [row] : [],
      });

      // Store pagination state if there are multiple pages
      if (totalPages > 1) {
        storeFindGroupsState(paginationId, {
          userId: user.id,
          groups: availableGroups,
          currentPage: 0, // 0-indexed internally
          messageId: reply.id,
        });
      }

      logger.info(`Found ${availableGroups.length} available groups`);
    } catch (error) {
      logger.error('Error fetching groups:', error);
      await interaction.editReply({
        content: '❌ Failed to fetch groups. Please try again later.',
      });
    }
  },
};
