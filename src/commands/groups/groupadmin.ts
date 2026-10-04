/**
 * /groupadmin Command
 *
 * Group owner administration commands.
 * Subcommands: delete, kick, transfer
 * Server administrators can use kick and transfer on any group via the groupid option.
 */

import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../types';
import { GroupService, Group } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupAdminCommand');

const GROUP_ID_OPTION_DESCRIPTION = 'Group ID (server admins only, e.g., A1B2). Defaults to your own group';

type GroupAdminInteraction = Parameters<Command['execute']>[0];

/**
 * Resolve the group a kick/transfer applies to and check permission.
 * The group owner manages their own group; server administrators may manage
 * any group by passing groupid. Replies to the (deferred) interaction and
 * returns null when the action isn't allowed.
 */
async function resolveManagedGroup(
  interaction: GroupAdminInteraction,
  groupService: GroupService,
  action: string
): Promise<{ group: Group; isAdminOverride: boolean } | null> {
  const user = interaction.user;
  const isServerAdmin = !!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const groupIdOption = interaction.options.getString('groupid')?.toUpperCase();

  if (groupIdOption) {
    if (!isServerAdmin) {
      await interaction.editReply({
        content: `❌ Only server administrators can ${action} in another group.`,
      });
      return null;
    }
    const group = await groupService.getGroup(groupIdOption);
    if (!group) {
      await interaction.editReply({ content: `❌ Group with ID "${groupIdOption}" not found.` });
      return null;
    }
    logger.info(`Server admin ${user.username} (${user.id}) acting on group ${group.name} (${group.groupId})`);
    return { group, isAdminOverride: true };
  }

  const userGroupData = await groupService.getUserGroup(user.id);
  if (!userGroupData) {
    await interaction.editReply({
      content: isServerAdmin
        ? '❌ You are not in a group. Provide a `groupid` to manage another group.'
        : '❌ You are not in a group.',
    });
    return null;
  }

  if (!userGroupData.membership.isOwner && !isServerAdmin) {
    await interaction.editReply({
      content: `❌ Only the group owner or a server administrator can ${action}.`,
    });
    return null;
  }

  return { group: userGroupData.group, isAdminOverride: !userGroupData.membership.isOwner };
}

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
        .setDescription('Remove a member from a group (owner, or server admin with groupid)')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to remove from the group')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('groupid')
            .setDescription(GROUP_ID_OPTION_DESCRIPTION)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transfer')
        .setDescription('Change a group leader (owner, or server admin with groupid)')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The member to transfer ownership to')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('groupid')
            .setDescription(GROUP_ID_OPTION_DESCRIPTION)
            .setRequired(false)
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

        const managed = await resolveManagedGroup(interaction, groupService, 'kick members');
        if (!managed) return;
        const { group } = managed;

        // The leader can't be kicked; ownership must be moved first
        if (targetUser.id === group.ownerId) {
          await interaction.editReply({
            content: targetUser.id === user.id
              ? '❌ You cannot kick yourself from the group.\n\nUse `/leavegroup` to leave or `/groupadmin delete` to delete the group.'
              : `❌ ${targetUser.username} is the group leader.\n\nUse \`/groupadmin transfer\` to change the leader first.`,
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
            content: `❌ ${targetUser.username} is not in **${group.name}**.`,
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

        const managed = await resolveManagedGroup(interaction, groupService, 'change the group leader');
        if (!managed) return;
        const { group } = managed;

        // Check if target user is already the leader
        if (targetUser.id === group.ownerId) {
          await interaction.editReply({
            content: targetUser.id === user.id
              ? '❌ You are already the owner of this group.'
              : `❌ ${targetUser.username} is already the leader of this group.`,
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
            content: `❌ ${targetUser.username} is not in **${group.name}**.`,
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
