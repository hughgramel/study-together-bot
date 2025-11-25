/**
 * /groupdescription Command
 *
 * Set or update your group's description.
 * Only the group owner can use this command.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupDescriptionCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('groupdescription')
    .setDescription('Set or update your group description (owner only)')
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Group description (max 100 characters, leave empty to remove)')
        .setRequired(false)
        .setMaxLength(100)
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

    // Get description option
    const description = interaction.options.getString('description');

    // If no description provided, show current description
    if (description === null) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const groupService = new GroupService(db);
        const userGroupData = await groupService.getUserGroup(userId);

        if (!userGroupData) {
          await interaction.editReply({
            content: '❌ You are not in a group. Create one with `/creategroup` to get started.',
          });
          return;
        }

        const { group } = userGroupData;
        const currentDescription = group.description || '(no description set)';

        await interaction.editReply({
          content: `**Current description:**\n${currentDescription}\n\nTo update, use: \`/groupdescription description: Your new description here\`\nTo remove, use: \`/groupdescription description: \``,
        });
        return;
      } catch (error) {
        logger.error('Error getting group description:', error);
        await interaction.editReply({
          content: '❌ Failed to get group description. Please try again later.',
        });
        return;
      }
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

      const { membership } = userGroupData;

      // Verify user is the owner
      if (!membership.isOwner) {
        await interaction.editReply({
          content: '❌ Only the group owner can change the group description. Ask your group owner to transfer ownership if needed.',
        });
        return;
      }

      const groupId = membership.groupId;

      // Validate description length
      if (description.trim().length > 100) {
        await interaction.editReply({
          content: '❌ Group description cannot exceed 100 characters.',
        });
        return;
      }

      // Update group description (empty string removes it)
      const trimmedDescription = description.trim();
      await groupService.updateGroupSettings(groupId, {
        description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
      });

      // Build success message
      if (trimmedDescription.length > 0) {
        await interaction.editReply({
          content: `✅ Group description updated!\n\n**New description:**\n${trimmedDescription}`,
        });
        logger.info(
          `User ${interaction.user.username} updated group ${groupId} description: ${trimmedDescription}`
        );
      } else {
        await interaction.editReply({
          content: '✅ Group description removed.',
        });
        logger.info(`User ${interaction.user.username} removed group ${groupId} description`);
      }
    } catch (error) {
      logger.error('Error updating group description:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('Group not found')) {
        await interaction.editReply({
          content: '❌ Group not found. It may have been deleted.',
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to update group description. Please try again later.',
        });
      }
    }
  },
};
