/**
 * /leavegroup Command
 *
 * Leave your current group.
 * Group owners cannot leave their own group - they must transfer ownership or delete it.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LeaveGroupCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leavegroup')
    .setDescription('Leave your current group'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`User ${user.username} (${user.id}) attempting to leave group`);

      // Initialize group service
      const groupService = new GroupService(db);

      // Check if user is in a group
      const userGroupData = await groupService.getUserGroup(user.id);
      if (!userGroupData) {
        await interaction.editReply({
          content: '❌ You are not in a group.',
        });
        return;
      }

      const { membership, group } = userGroupData;

      // Check if user is the owner
      if (membership.isOwner) {
        await interaction.editReply({
          content: `❌ You are the owner of **${group.name}**.\n\nYou cannot leave your own group. You can either:\n• Transfer ownership with \`/groupadmin transfer\`\n• Delete the group with \`/groupadmin delete\``,
        });
        return;
      }

      // Remove user from group
      await groupService.removeMemberFromGroup(group.groupId, user.id);

      await interaction.editReply({
        content: `✅ You have left **${group.name}**.\n\nYou can create a new group with \`/creategroup\` or join another with \`/joingroup\`.`,
      });

      logger.info(`User ${user.username} successfully left group ${group.name} (${group.groupId})`);
    } catch (error) {
      logger.error('Error leaving group:', error);
      await interaction.editReply({
        content: '❌ Failed to leave group. Please try again later.',
      });
    }
  },
};
