/**
 * Group Pagination Button Handlers
 *
 * Handles pagination for findgroups and group_leaderboard commands.
 */

import { ButtonInteraction, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { groupOverviewImageLightService } from '../../services/groupOverviewImageLight';
import { GroupService } from '../../services/groups';
import { StatsService } from '../../services/stats';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupPaginationButtons');

/**
 * Simplified group data for pagination display
 */
interface GroupSummary {
  groupId: string;
  groupName: string;
  groupLevel: number;
  currentMembers: number;
  maxMembers: number;
  xpModifier: number;
}

// Pagination state for findgroups
interface GroupPaginationState {
  userId: string;
  groups: GroupSummary[];
  currentPage: number;
  messageId: string;
}
const findGroupsPaginations = new Map<string, GroupPaginationState>();

// Pagination state for group_leaderboard (server-based)
interface LeaderboardPaginationState {
  serverId: string;
  groups: GroupSummary[];
  lastUpdated: number;
}
const leaderboardPaginations = new Map<string, LeaderboardPaginationState>();

// Clean up old pagination states every 15 minutes
const PAGINATION_TIMEOUT = 15 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  // Clean up findgroups paginations
  for (const [key, state] of findGroupsPaginations.entries()) {
    // Extract timestamp from key (format: findgroups:userId:timestamp)
    const timestamp = parseInt(key.split(':')[2]);
    if (now - timestamp > PAGINATION_TIMEOUT) {
      findGroupsPaginations.delete(key);
    }
  }
  // Clean up leaderboard paginations
  for (const [key, state] of leaderboardPaginations.entries()) {
    if (now - state.lastUpdated > PAGINATION_TIMEOUT) {
      leaderboardPaginations.delete(key);
    }
  }
}, PAGINATION_TIMEOUT);

/**
 * Handle findgroups pagination buttons
 */
export async function handleFindGroupsPagination(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  try {
    // Parse custom ID: findgroups:userId:timestamp:prev/next
    const parts = interaction.customId.split(':');
    const paginationId = parts.slice(0, 3).join(':');
    const action = parts[3]; // 'prev' or 'next'

    // Get pagination state
    const state = findGroupsPaginations.get(paginationId);
    if (!state) {
      await interaction.reply({
        content: '❌ Pagination session expired. Please run `/findgroups` again.',
        ephemeral: true,
      });
      return;
    }

    // Verify user
    if (state.userId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Only the user who ran the command can use these buttons.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    // Update page number
    const itemsPerPage = 5;
    const totalPages = Math.ceil(state.groups.length / itemsPerPage);

    if (action === 'next' && state.currentPage < totalPages - 1) {
      state.currentPage++;
    } else if (action === 'prev' && state.currentPage > 0) {
      state.currentPage--;
    }

    // Get groups for current page
    const startIdx = state.currentPage * itemsPerPage;
    const endIdx = Math.min((state.currentPage + 1) * itemsPerPage, state.groups.length);
    const pageGroups = state.groups.slice(startIdx, endIdx);

    // Check user's light mode preference
    const statsService = new StatsService(db);
    const stats = await statsService.getUserStats(interaction.user.id);
    const useLightMode = stats?.lightMode || false;

    // Generate new image using appropriate theme
    const imageService = useLightMode ? groupOverviewImageLightService : groupOverviewImageService;
    const imageBuffer = await imageService.generateFindGroupsImage(
      pageGroups,
      state.currentPage + 1, // Display as 1-indexed
      totalPages
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'find-groups.png' });

    // Update buttons
    const prevButton = new ButtonBuilder()
      .setCustomId(`${paginationId}:prev`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.currentPage === 0);

    const nextButton = new ButtonBuilder()
      .setCustomId(`${paginationId}:next`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.currentPage >= totalPages - 1);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

    // Update message
    await interaction.editReply({
      files: [attachment],
      components: [row],
    });

    logger.info(`User ${interaction.user.username} navigated to page ${state.currentPage + 1}/${totalPages}`);
  } catch (error) {
    logger.error('Error handling findgroups pagination:', error);
    await interaction.reply({
      content: '❌ Failed to navigate pages. Please try again.',
      ephemeral: true,
    }).catch(() => {
      // Ignore if already replied
    });
  }
}

/**
 * Handle group_leaderboard pagination buttons
 */
export async function handleGroupLeaderboardPagination(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  try {
    // Parse custom ID: group_leaderboard_page:pageNum:real
    const parts = interaction.customId.split(':');
    const targetPage = parseInt(parts[1]);

    const serverId = interaction.guildId;
    if (!serverId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    // Get or fetch groups for this server
    let groups: GroupSummary[];
    const cacheKey = serverId;
    const cachedState = leaderboardPaginations.get(cacheKey);

    if (cachedState && Date.now() - cachedState.lastUpdated < PAGINATION_TIMEOUT) {
      groups = cachedState.groups;
      logger.info('Using cached leaderboard data');
    } else {
      // Fetch fresh data
      const groupService = new GroupService(db);
      const allGroups = await groupService.getAllServerGroups(serverId);

      // Convert Group[] to GroupSummary[]
      groups = allGroups.map(g => ({
        groupId: g.groupId,
        groupName: g.name,
        groupLevel: g.level,
        currentMembers: g.memberCount,
        maxMembers: g.maxMembers,
        xpModifier: g.level * 0.01, // 1% per level
      }));

      // Cache the results
      leaderboardPaginations.set(cacheKey, {
        serverId,
        groups,
        lastUpdated: Date.now(),
      });
      logger.info(`Fetched and cached ${groups.length} groups for server ${serverId}`);
    }

    if (groups.length === 0) {
      await interaction.editReply({
        content: '📊 No groups found in this server yet! Create one with `/creategroup` to get started.',
        components: [],
      });
      return;
    }

    // Pagination settings
    const pageSize = 5;
    const totalPages = Math.ceil(groups.length / pageSize);
    const page = Math.max(0, Math.min(targetPage, totalPages - 1));

    // Get current page of groups
    const startIdx = page * pageSize;
    const endIdx = Math.min((page + 1) * pageSize, groups.length);
    const pageGroups = groups.slice(startIdx, endIdx).map((group, index) => ({
      rank: startIdx + index + 1,
      groupName: group.groupName,
      groupId: group.groupId,
      currentMembers: group.currentMembers,
      maxMembers: group.maxMembers,
      groupLevel: group.groupLevel,
    }));

    // Check user's light mode preference
    const statsService = new StatsService(db);
    const stats = await statsService.getUserStats(interaction.user.id);
    const useLightMode = stats?.lightMode || false;

    // Generate group leaderboard image using appropriate theme
    const imageService = useLightMode ? groupOverviewImageLightService : groupOverviewImageService;
    const imageBuffer = await imageService.generateGroupLeaderboardImage(pageGroups);

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-leaderboard.png' });

    // Create pagination buttons
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

    // Update message
    await interaction.editReply({
      content: totalPages > 1 ? `Page ${page + 1}/${totalPages}` : undefined,
      files: [attachment],
      components,
    });

    logger.info(`Server ${serverId} navigated to page ${page + 1}/${totalPages}`);
  } catch (error) {
    logger.error('Error handling group_leaderboard pagination:', error);
    await interaction.reply({
      content: '❌ Failed to navigate pages. Please try again.',
      ephemeral: true,
    }).catch(() => {
      // Ignore if already replied
    });
  }
}

/**
 * Store findgroups pagination state (called from command)
 */
export function storeFindGroupsState(
  paginationId: string,
  state: GroupPaginationState
): void {
  findGroupsPaginations.set(paginationId, state);
}

/**
 * Clear leaderboard cache for a server (call when groups are modified)
 */
export function clearLeaderboardCache(serverId: string): void {
  leaderboardPaginations.delete(serverId);
}
