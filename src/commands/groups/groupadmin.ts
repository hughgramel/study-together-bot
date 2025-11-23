/**
 * /groupadmin Command
 *
 * Group owner administration commands.
 * Subcommands: delete, kick, transfer
 */

import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupAdminCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('groupadmin')
    .setDescription('Group owner administration commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Permanently delete your group and remove all members')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick')
        .setDescription('Remove a member from your group')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to remove from your group')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transfer')
        .setDescription('Transfer group ownership to another member')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The member to transfer ownership to')
            .setRequired(true)
        )
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const subcommand = interaction.options.getSubcommand();

    // Initialize group service
    const groupService = new GroupService(db);

    if (subcommand === 'delete') {
      try {
        // Check if user is in a group
        const userGroupData = await groupService.getUserGroup(user.id);

        if (!userGroupData) {
          await interaction.reply({
            content: '❌ You are not in a group.',
            ephemeral: true,
          });
          return;
        }

        const { membership, group } = userGroupData;

        // Verify user is the group owner
        if (!membership.isOwner) {
          await interaction.reply({
            content: '❌ Only the group owner can delete the group.',
            ephemeral: true,
          });
          return;
        }

        logger.info(`User ${user.username} (${user.id}) requesting to delete group ${group.name} (${group.groupId})`);

        // Create confirmation buttons
        const confirmButton = new ButtonBuilder()
          .setCustomId(`groupadmin_delete_confirm:${group.groupId}:${user.id}`)
          .setLabel('Confirm Delete')
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId(`groupadmin_delete_cancel:${group.groupId}:${user.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton,
          cancelButton
        );

        await interaction.reply({
          content: `⚠️ Are you sure you want to delete **${group.name}**?\n\nThis will:\n• Permanently delete the group\n• Remove all ${group.memberCount} member(s)\n• Cannot be undone\n\nThis action is **irreversible**.`,
          components: [row],
          ephemeral: true,
        });
      } catch (error) {
        logger.error('Error in groupadmin delete command:', error);
        await interaction.reply({
          content: '❌ Failed to process delete request. Please try again later.',
          ephemeral: true,
        });
      }
    } else if (subcommand === 'kick') {
      try {
        await interaction.deferReply({ ephemeral: true });

        // Get the user to kick
        const targetUser = interaction.options.getUser('user', true);

        logger.info(`User ${user.username} (${user.id}) attempting to kick ${targetUser.username} (${targetUser.id})`);

        // Check if command user is in a group
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
            content: '❌ Only the group owner can kick members.',
          });
          return;
        }

        // Check if target user is the owner
        if (targetUser.id === user.id) {
          await interaction.editReply({
            content: '❌ You cannot kick yourself from the group.\n\nUse `/leavegroup` to leave or `/groupadmin delete` to delete the group.',
          });
          return;
        }

        // Check if target user is in the group
        const targetMembershipDoc = await db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .doc(targetUser.id)
          .get();

        if (!targetMembershipDoc.exists) {
          await interaction.editReply({
            content: `❌ ${targetUser.username} is not in any group.`,
          });
          return;
        }

        const targetMembership = targetMembershipDoc.data();

        // Verify target is in the same group
        if (targetMembership?.groupId !== group.groupId) {
          await interaction.editReply({
            content: `❌ ${targetUser.username} is not in your group.`,
          });
          return;
        }

        // Remove the member
        await groupService.removeMemberFromGroup(group.groupId, targetUser.id);

        await interaction.editReply({
          content: `✅ **${targetUser.username}** has been removed from **${group.name}**.`,
        });

        logger.info(`User ${targetUser.username} (${targetUser.id}) was kicked from group ${group.name} (${group.groupId})`);
      } catch (error) {
        logger.error('Error in groupadmin kick command:', error);
        await interaction.editReply({
          content: '❌ Failed to kick member. Please try again later.',
        });
      }
    } else if (subcommand === 'transfer') {
      try {
        await interaction.deferReply({ ephemeral: true });

        // Get the user to transfer ownership to
        const targetUser = interaction.options.getUser('user', true);

        logger.info(`User ${user.username} (${user.id}) attempting to transfer ownership to ${targetUser.username} (${targetUser.id})`);

        // Check if command user is in a group
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
            content: '❌ Only the group owner can transfer ownership.',
          });
          return;
        }

        // Check if target user is trying to transfer to themselves
        if (targetUser.id === user.id) {
          await interaction.editReply({
            content: '❌ You are already the owner of this group.',
          });
          return;
        }

        // Check if target user is in the group
        const targetMembershipDoc = await db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .doc(targetUser.id)
          .get();

        if (!targetMembershipDoc.exists) {
          await interaction.editReply({
            content: `❌ ${targetUser.username} is not in any group.`,
          });
          return;
        }

        const targetMembership = targetMembershipDoc.data();

        // Verify target is in the same group
        if (targetMembership?.groupId !== group.groupId) {
          await interaction.editReply({
            content: `❌ ${targetUser.username} is not in your group.`,
          });
          return;
        }

        // Transfer ownership
        await groupService.transferOwnership(group.groupId, targetUser.id, targetUser.username);

        await interaction.editReply({
          content: `✅ **${targetUser.username}** is now the owner of **${group.name}**.\n\nYou are now a regular member of the group.`,
        });

        logger.info(`Ownership of group ${group.name} (${group.groupId}) transferred from ${user.username} (${user.id}) to ${targetUser.username} (${targetUser.id})`);
      } catch (error) {
        logger.error('Error in groupadmin transfer command:', error);
        await interaction.editReply({
          content: '❌ Failed to transfer ownership. Please try again later.',
        });
      }
    }
  },
};
