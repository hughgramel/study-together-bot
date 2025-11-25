/**
 * /creategroup Command
 *
 * Create a new study group.
 * Users can specify a name and whether the group is public or private.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CreateGroupCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('creategroup')
    .setDescription('Create a new study group')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of your group')
        .setRequired(true)
        .setMaxLength(50)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Group description (max 100 characters)')
        .setRequired(false)
        .setMaxLength(100)
    )
    .addBooleanOption(option =>
      option
        .setName('public')
        .setDescription('Whether the group is publicly visible and joinable (default: true)')
        .setRequired(false)
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const groupName = interaction.options.getString('name', true);
      const description = interaction.options.getString('description');
      const isPublic = interaction.options.getBoolean('public') ?? true;

      logger.info(`User ${user.username} (${user.id}) creating group: ${groupName}, public: ${isPublic}`);

      // Initialize group service
      const groupService = new GroupService(db);

      // Check if user is already in a group
      const existingMembership = await groupService.getUserGroup(user.id);
      if (existingMembership) {
        await interaction.editReply({
          content: `❌ You are already in a group: **${existingMembership.group.name}**\n\nLeave your current group with \`/leavegroup\` before creating a new one.`,
        });
        return;
      }

      // Create the group
      const group = await groupService.createGroup(
        groupName,
        user.id,
        user.username,
        guildId,
        {
          isPublic,
          maxMembers: 5,
          description: description || undefined,
        }
      );

      await interaction.editReply({
        content: `✅ **Group Created!**\n\n**${group.name}** (${group.groupId})\n${isPublic ? '🌐 Public' : '🔒 Private'} • Max ${group.maxMembers} members\n\nShare your group ID with others so they can join with \`/joingroup ${group.groupId}\``,
      });

      logger.info(`Group created successfully: ${group.name} (${group.groupId})`);
    } catch (error) {
      logger.error('Error creating group:', error);
      await interaction.editReply({
        content: '❌ Failed to create group. Please try again later.',
      });
    }
  },
};
