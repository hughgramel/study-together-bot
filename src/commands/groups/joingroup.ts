/**
 * /joingroup Command
 *
 * Join a public group by group ID.
 * Validates that the user is not already in a group and that the target group has space.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('JoinGroupCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('joingroup')
    .setDescription('Join a public group')
    .addStringOption(option =>
      option
        .setName('group_id')
        .setDescription('The group ID to join (e.g., GP-A1B2)')
        .setRequired(true)
    ),

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
      const groupId = interaction.options.getString('group_id', true).toUpperCase();

      logger.info(`User ${user.username} (${user.id}) attempting to join group: ${groupId}`);

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

      // Get the group
      const group = await groupService.getGroup(groupId);
      if (!group) {
        await interaction.editReply({
          content: `❌ Group not found: \`${groupId}\`\n\nMake sure you entered the correct group ID.`,
        });
        return;
      }

      // Check if group is in the same server
      if (group.serverId !== guildId) {
        await interaction.editReply({
          content: `❌ This group belongs to a different server.`,
        });
        return;
      }

      // Check if group is public
      if (!group.isPublic) {
        await interaction.editReply({
          content: `❌ **${group.name}** is a private group.\n\nYou need an invitation from the group owner to join.`,
        });
        return;
      }

      // Check if group has space
      const hasSpace = await groupService.hasSpaceAvailable(groupId);
      if (!hasSpace) {
        await interaction.editReply({
          content: `❌ **${group.name}** is full (${group.memberCount}/${group.maxMembers} members).\n\nTry browsing other groups with \`/findgroups\`.`,
        });
        return;
      }

      // Add user to group
      await groupService.addMemberToGroup(groupId, user.id, user.username);

      // Update group stats to recalculate total hours and level with new member
      await groupService.updateGroupStats(groupId);

      // Fetch updated group data to show correct stats
      const updatedGroup = await groupService.getGroup(groupId);
      const updatedLevel = updatedGroup?.level || group.level;
      const updatedMemberCount = updatedGroup?.memberCount || (group.memberCount + 1);

      await interaction.editReply({
        content: `✅ **Joined ${group.name}!**\n\nGroup ID: \`${group.groupId}\`\nMembers: ${updatedMemberCount}/${group.maxMembers}\nLevel: ${updatedLevel}\n\nView your group with \`/group\``,
      });

      logger.info(`User ${user.username} successfully joined group ${group.name} (${groupId}), group stats updated`);
    } catch (error) {
      logger.error('Error joining group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await interaction.editReply({
        content: `❌ Failed to join group: ${errorMessage}`,
      });
    }
  },
};
