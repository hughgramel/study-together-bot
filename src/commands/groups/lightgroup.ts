/**
 * /lightgroup Command
 *
 * View a group overview in light mode (for testing and style refinement).
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { GroupService, GroupMembership } from '../../services/groups';
import { groupOverviewImageLightService } from '../../services/groupOverviewImageLight';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LightGroupCommand');

interface GroupMemberWithStats {
  membership: GroupMembership;
  totalHours: number;
  totalSessions: number;
  currentStreak: number;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lightgroup')
    .setDescription('View a group overview (Light Mode)')
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

      logger.info(`User ${user.username} viewing light mode group for ${targetUser.username}`);

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
      const maxMembers = group?.maxMembers || 5;
      const memberCount = group?.memberCount || 0;

      // Update group stats
      await groupService.updateGroupStats(groupId);

      // Get updated group data
      const updatedGroupDoc = await db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .get();

      const updatedGroup = updatedGroupDoc.data();
      const groupLevel = updatedGroup?.level || 1;

      // Get all group members
      const members = await groupService.getGroupMembers(groupId);

      // Calculate group rank
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

      // Get member stats with all-time hours
      const memberStatsPromises = members.map(async (member: GroupMemberWithStats) => {
        const userId = member.membership?.userId;
        const username = member.membership?.username || 'Unknown User';

        if (!userId) {
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

        // Get all-time total hours
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
          rank: 0,
        };
      });

      const memberStats = await Promise.all(memberStatsPromises);

      // Sort by hours and assign ranks
      memberStats.sort((a, b) => b.hours - a.hours);
      memberStats.forEach((member, index) => {
        member.rank = index + 1;
      });

      // Get total all-time hours
      let totalAllTimeHours = updatedGroup?.totalHours || 0;

      // Calculate level and XP modifiers
      const calculatedLevel = Math.floor(totalAllTimeHours / 25) + 1;
      const totalXpModifier = Math.min(0.5, calculatedLevel * 0.01);
      const nextLevelXpModifier = Math.min(0.5, (calculatedLevel + 1) * 0.01);
      const currentLevelHours = Math.round(totalAllTimeHours % 25);
      const nextLevelHours = 25;

      // Generate the light mode group overview image
      const imageBuffer = await groupOverviewImageLightService.generateGroupOverviewImage(
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
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-overview-light.png' });

      // Send the group overview
      await interaction.editReply({
        content: `☀️ **Light Mode Preview**\nTo join this group, use: \`/joingroup ${groupIdDisplay}\``,
        files: [attachment],
      });

      logger.info(`Light mode group overview generated successfully for ${groupName}`);
    } catch (error) {
      logger.error('Error generating light mode group overview:', error);
      await interaction.editReply({
        content: '❌ Failed to generate light mode group overview. Please try again later.',
      });
    }
  },
};
