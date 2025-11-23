/**
 * /joinrandom Command
 *
 * Join a random public group with available space.
 * Great for new users who want to quickly get into a group without browsing.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('JoinRandomCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('joinrandom')
    .setDescription('Join a random public group'),

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
      logger.info(`User ${user.username} (${user.id}) attempting to join random group`);

      // Initialize group service
      const groupService = new GroupService(db);

      // Check if user is already in a group
      const existingMembership = await groupService.getUserGroup(user.id);
      if (existingMembership) {
        await interaction.editReply({
          content: `❌ You are already in a group: **${existingMembership.group.name}**\n\nLeave your current group with \`/leavegroup\` before joining another.`,
        });
        return;
      }

      // Get all public groups in this server (fetch more to increase chances of finding available space)
      const publicGroups = await groupService.getPublicGroups(guildId, 50);

      if (publicGroups.length === 0) {
        await interaction.editReply({
          content: '❌ No public groups found in this server.\n\nCreate one with `/creategroup` or browse groups with `/findgroups`.',
        });
        return;
      }

      // Filter groups that have available space
      const availableGroups = publicGroups.filter(
        (group) => group.memberCount < group.maxMembers
      );

      if (availableGroups.length === 0) {
        await interaction.editReply({
          content: '❌ All public groups are currently full.\n\nCreate your own with `/creategroup` or wait for space to open up.',
        });
        return;
      }

      // Pick a random group from available ones
      const randomGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];

      logger.info(`Joining user ${user.id} to random group: ${randomGroup.groupId}`);

      // Add user to the group
      await groupService.addMemberToGroup(randomGroup.groupId, user.id, user.username);

      // Update group stats to recalculate total hours and level with new member
      await groupService.updateGroupStats(randomGroup.groupId);

      // Fetch updated group data to show correct stats
      const updatedGroup = await groupService.getGroup(randomGroup.groupId);
      const updatedLevel = updatedGroup?.level || randomGroup.level;
      const xpBonus = Math.round(groupService.calculateXpModifier(updatedLevel) * 100);

      await interaction.editReply({
        content:
          `✅ **Joined ${randomGroup.name}!**\n\n` +
          `🆔 Group ID: \`${randomGroup.groupId}\`\n` +
          `👥 Members: ${randomGroup.memberCount + 1}/${randomGroup.maxMembers}\n` +
          `⭐ Level ${updatedLevel} (+${xpBonus}% XP bonus)\n\n` +
          `View your group with \`/group\` or the group leaderboard with \`/groupleaderboard\`.`,
      });

      logger.info(
        `User ${user.username} successfully joined random group ${randomGroup.groupId} (${randomGroup.name})`
      );
    } catch (error) {
      logger.error('Error joining random group:', error);
      await interaction.editReply({
        content: '❌ Failed to join a random group. Please try again later.',
      });
    }
  },
};
