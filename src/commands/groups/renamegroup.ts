/**
 * /renamegroup Command
 *
 * Allows group owner to rename their group.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('RenameGroupCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('renamegroup')
    .setDescription('Rename your group')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('New name for your group')
        .setRequired(true)
        .setMaxLength(50)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
      const newName = interaction.options.getString('name', true);

      logger.info(`User ${user.username} (${user.id}) attempting to rename group to: ${newName}`);

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

      // Verify user is the group owner
      if (!membership.isOwner) {
        await interaction.editReply({
          content: '❌ Only the group owner can rename the group.',
        });
        return;
      }

      // Check if new name is same as current name
      if (newName === group.name) {
        await interaction.editReply({
          content: '❌ That\'s already your group\'s name!',
        });
        return;
      }

      // Update group name
      await groupService.updateGroupSettings(group.groupId, { name: newName });

      await interaction.editReply({
        content: `✅ **Group Renamed!**\n\n**${group.name}** → **${newName}**`,
      });

      logger.info(`Group ${group.groupId} renamed from "${group.name}" to "${newName}" by ${user.username} (${user.id})`);
    } catch (error) {
      logger.error('Error renaming group:', error);
      await interaction.editReply({
        content: '❌ Failed to rename group. Please try again later.',
      });
    }
  },
};
