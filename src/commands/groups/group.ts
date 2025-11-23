/**
 * /group Command
 *
 * View a group overview with member stats and progress.
 * Shows group rank, level, XP modifier, and member statistics.
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { GroupService, GroupMembership } from '../../services/groups';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupCommand');

/**
 * Group member with stats for display
 */
interface GroupMemberWithStats {
  membership: GroupMembership;
  totalHours: number;
  totalSessions: number;
  currentStreak: number;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('group')
    .setDescription('View a group overview with member stats and progress')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User whose group to view (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
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
      // Get target user (defaults to command user)
      const targetUser = interaction.options.getUser('user') || user;
      const targetUserId = targetUser.id;

      logger.info(`User ${user.username} viewing group for ${targetUser.username}`);

      // Initialize group service
      const groupService = new GroupService(db);

      // Get user's group membership
      const membershipDoc = await db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(targetUserId)
        .get();

      if (!membershipDoc.exists) {
        await interaction.editReply({
          content: targetUser.id === user.id
            ? '❌ You are not in a group yet. Create or join a group to get started!'
            : `❌ ${targetUser.username} is not in a group.`,
        });
        return;
      }

      const membership = membershipDoc.data();
      const groupId = membership?.groupId;

      if (!groupId) {
        await interaction.editReply({
          content: '❌ Group data not found.',
        });
        return;
      }

      // Get group data
      const groupDoc = await db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .get();

      if (!groupDoc.exists) {
        await interaction.editReply({
          content: '❌ Group not found.',
        });
        return;
      }

      const group = groupDoc.data();
      const groupName = group?.name || 'Unknown Group';
      const groupIdDisplay = group?.groupId || groupId;
      const groupLevel = group?.level || 1;
      const maxMembers = group?.maxMembers || 5;
      const memberCount = group?.memberCount || 0;

      // Get all group members
      const members = await groupService.getGroupMembers(groupId);

      // Calculate group rank (query all groups sorted by level)
      const allGroupsSnapshot = await db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .where('serverId', '==', guildId)
        .orderBy('level', 'desc')
        .get();

      let groupRank = 1;
      for (const doc of allGroupsSnapshot.docs) {
        if (doc.id === groupId) {
          break;
        }
        groupRank++;
      }

      // Get start of current week (Sunday at midnight)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStartTimestamp = Timestamp.fromDate(startOfWeek);

      // Get member stats with all-time hours
      const memberStatsPromises = members.map(async (member: GroupMemberWithStats) => {
        const userId = member.membership?.userId;
        const username = member.membership?.username || 'Unknown User';

        // Skip if userId is missing
        if (!userId) {
          logger.error('Member missing userId:', member);
          return {
            username,
            avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
            hours: 0,
            rank: 0,
          };
        }

        // Get avatar URL
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        try {
          const discordUser = await client.users.fetch(userId);
          avatarUrl = discordUser.displayAvatarURL({ size: 256, extension: 'png' });
        } catch (error) {
          logger.error(`Failed to fetch avatar for user ${userId}:`, error);
        }

        // Get all-time total hours from user stats
        const statsDoc = await db
          .collection('discord-data')
          .doc('userStats')
          .collection('stats')
          .doc(userId)
          .get();

        let totalHours = 0;
        if (statsDoc.exists) {
          const stats = statsDoc.data();
          totalHours = Math.round((stats?.totalDuration || 0) / 3600);
        }

        return {
          username,
          avatarUrl,
          hours: totalHours,
          rank: 0, // Will be assigned after sorting
        };
      });

      const memberStats = await Promise.all(memberStatsPromises);

      // Sort by hours and assign ranks
      memberStats.sort((a, b) => b.hours - a.hours);
      memberStats.forEach((member, index) => {
        member.rank = index + 1;
      });

      // Get total all-time hours from database
      // Stats are kept up-to-date by: join/leave operations and session completions
      let totalAllTimeHours = group?.totalHours || 0;

      logger.info(`[GROUP OVERVIEW] Member stats:`, memberStats.map(m => ({ username: m.username, hours: m.hours })));
      logger.info(`[GROUP OVERVIEW] Total all-time hours (from DB): ${totalAllTimeHours}`);

      // Calculate group level based on all-time total hours
      // Formula: 1 level per 25 hours (Math.floor(totalHours / 25) + 1)
      const calculatedLevel = Math.floor(totalAllTimeHours / 25) + 1;

      logger.info(`[GROUP OVERVIEW] Calculated level: ${calculatedLevel}`);
      logger.info(`[GROUP OVERVIEW] DB group level: ${groupLevel}`);

      // Calculate XP modifier based on calculated level
      // Formula: 1% per level, capped at 50% (e.g., level 10 = 10% bonus, level 50+ = 50% bonus)
      const totalXpModifier = Math.min(0.5, calculatedLevel * 0.01);
      const nextLevelXpModifier = Math.min(0.5, (calculatedLevel + 1) * 0.01);

      logger.info(`[GROUP OVERVIEW] XP modifier: ${totalXpModifier} (${(totalXpModifier * 100).toFixed(1)}%)`);

      // Calculate hours needed for next level
      // Formula: 25 hours per level
      const currentLevelHours = Math.round(totalAllTimeHours % 25); // Hours into current level (rounded)
      const nextLevelHours = 25; // Hours needed to reach next level

      logger.info(`[GROUP OVERVIEW] Progress: ${currentLevelHours} of ${nextLevelHours} hours`);

      // Generate the group overview image
      const imageBuffer = await groupOverviewImageService.generateGroupOverviewImage(
        groupRank,
        groupName,
        groupIdDisplay,
        memberCount,
        maxMembers,
        calculatedLevel,
        totalXpModifier,
        currentLevelHours,
        nextLevelHours,
        nextLevelXpModifier,
        memberStats
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-overview.png' });

      // Send the group overview
      await interaction.editReply({
        files: [attachment],
      });

      logger.info(`Group overview generated successfully for ${groupName}`);
    } catch (error) {
      logger.error('Error generating group overview:', error);
      await interaction.editReply({
        content: '❌ Failed to generate group overview. Please try again later.',
      });
    }
  },
};
