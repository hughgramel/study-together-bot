/**
 * /groupsettings Command
 *
 * Update group settings (name, privacy, max members).
 * Only the group owner can use this command.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';
import { clearLeaderboardCache } from '../../interactions/buttons/groupPaginationButtons';

const logger = createLogger('GroupSettingsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('groupsettings')
    .setDescription('Update your group settings (owner only)')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('New group name (max 50 characters)')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('public')
        .setDescription('Make group public or private')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('maxmembers')
        .setDescription('Maximum number of members (cannot be less than current members)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const userId = interaction.user.id;
    const serverId = interaction.guildId;

    if (!serverId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    // Get options
    const newName = interaction.options.getString('name');
    const newPublic = interaction.options.getBoolean('public');
    const newMaxMembers = interaction.options.getInteger('maxmembers');

    // Check if at least one option is provided
    if (newName === null && newPublic === null && newMaxMembers === null) {
      await interaction.reply({
        content: '❌ Please provide at least one setting to update (name, public, or maxmembers).',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const groupService = new GroupService(db);

      // Get user's current group membership
      const userGroupData = await groupService.getUserGroup(userId);

      if (!userGroupData) {
        await interaction.editReply({
          content: '❌ You are not in a group. Create one with `/creategroup` to get started.',
        });
        return;
      }

      const { membership, group } = userGroupData;

      // Verify user is the owner
      if (!membership.isOwner) {
        await interaction.editReply({
          content: '❌ Only the group owner can change group settings. Ask your group owner to transfer ownership if needed.',
        });
        return;
      }

      const groupId = membership.groupId;

      // Validate name if provided
      if (newName !== null) {
        if (newName.trim().length === 0) {
          await interaction.editReply({
            content: '❌ Group name cannot be empty.',
          });
          return;
        }

        if (newName.length > 50) {
          await interaction.editReply({
            content: '❌ Group name cannot exceed 50 characters.',
          });
          return;
        }
      }

      // Build updates object
      const updates: {
        name?: string;
        isPublic?: boolean;
        maxMembers?: number;
      } = {};

      if (newName !== null) {
        updates.name = newName.trim();
      }

      if (newPublic !== null) {
        updates.isPublic = newPublic;
      }

      if (newMaxMembers !== null) {
        updates.maxMembers = newMaxMembers;
      }

      // Update group settings
      await groupService.updateGroupSettings(groupId, updates);

      // Clear leaderboard cache so changes are reflected immediately
      clearLeaderboardCache(serverId);

      // Build success message
      const changes: string[] = [];
      if (newName !== null) {
        changes.push(`**Name**: ${newName.trim()}`);
      }
      if (newPublic !== null) {
        changes.push(`**Visibility**: ${newPublic ? 'Public' : 'Private'}`);
      }
      if (newMaxMembers !== null) {
        changes.push(`**Max Members**: ${newMaxMembers}`);
      }

      await interaction.editReply({
        content: `✅ Group settings updated!\n\n${changes.join('\n')}`,
      });

      logger.info(
        `User ${interaction.user.username} updated group ${groupId} settings: ${JSON.stringify(updates)}`
      );
    } catch (error) {
      logger.error('Error updating group settings:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('Cannot reduce max members')) {
        await interaction.editReply({
          content: `❌ ${errorMessage}`,
        });
      } else if (errorMessage.includes('Group not found')) {
        await interaction.editReply({
          content: '❌ Group not found. It may have been deleted.',
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to update group settings. Please try again later.',
        });
      }
    }
  },
};
