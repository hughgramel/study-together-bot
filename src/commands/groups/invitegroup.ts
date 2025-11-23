/**
 * /invitegroup Command
 *
 * Invite a user to join your study group.
 * Sends a DM to the invited user with accept/decline buttons.
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../types';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('InviteGroupCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('invitegroup')
    .setDescription('Invite a user to join your study group')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to invite to your group')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const inviter = interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const invitee = interaction.options.getUser('user', true);

    // Can't invite yourself
    if (invitee.id === inviter.id) {
      await interaction.reply({
        content: '❌ You cannot invite yourself to a group.',
        ephemeral: true,
      });
      return;
    }

    // Can't invite bots
    if (invitee.bot) {
      await interaction.reply({
        content: '❌ You cannot invite bots to groups.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const groupService = new GroupService(db);

      // Check if inviter is in a group
      const inviterMembershipDoc = await db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(inviter.id)
        .get();

      if (!inviterMembershipDoc.exists) {
        await interaction.editReply({
          content: '❌ You are not in a group. Create or join a group first!',
        });
        return;
      }

      const inviterMembership = inviterMembershipDoc.data();
      const groupId = inviterMembership?.groupId;

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
      const groupLevel = group?.level || 1;
      const isPrivate = group?.isPrivate || false;

      // Check if group is full
      if (memberCount >= maxMembers) {
        await interaction.editReply({
          content: `❌ Your group "${groupName}" is full (${memberCount}/${maxMembers} members).`,
        });
        return;
      }

      // Check if invitee is already in a group
      const inviteeMembershipDoc = await db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(invitee.id)
        .get();

      if (inviteeMembershipDoc.exists) {
        const inviteeMembership = inviteeMembershipDoc.data();
        const inviteeGroupId = inviteeMembership?.groupId;

        if (inviteeGroupId === groupId) {
          await interaction.editReply({
            content: `❌ ${invitee.username} is already in your group!`,
          });
          return;
        }

        await interaction.editReply({
          content: `❌ ${invitee.username} is already in another group. They must leave their current group first.`,
        });
        return;
      }

      // Calculate XP bonus
      const xpBonus = Math.min(50, groupLevel * 1); // 1% per level, max 50%

      // Create invitation embed
      const embed = new EmbedBuilder()
        .setColor(0x0080FF)
        .setTitle('📬 Group Invitation')
        .setDescription(`**${inviter.username}** invited you to join their study group!`)
        .addFields(
          { name: '📚 Group Name', value: groupName, inline: true },
          { name: '🆔 Group ID', value: `\`${groupIdDisplay}\``, inline: true },
          { name: '👥 Members', value: `${memberCount}/${maxMembers}`, inline: true },
          { name: '⭐ Level', value: `${groupLevel}`, inline: true },
          { name: '🎯 XP Bonus', value: `**+${xpBonus}%**`, inline: true },
          { name: '🔒 Privacy', value: isPrivate ? 'Private' : 'Public', inline: true }
        )
        .setFooter({ text: 'Join this group to get an XP bonus on all your sessions!' })
        .setTimestamp();

      // Create accept/decline buttons
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`group_invite_accept:${groupId}:${inviter.id}`)
            .setLabel('Accept Invitation')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`group_invite_decline:${groupId}:${inviter.id}`)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );

      // Try to send DM to invitee
      try {
        await invitee.send({
          embeds: [embed],
          components: [row],
        });

        await interaction.editReply({
          content: `✅ Invitation sent to ${invitee.username}! They will receive a DM with the invitation.`,
        });

        logger.info(`${inviter.username} invited ${invitee.username} to group ${groupName} (${groupId})`);
      } catch (error) {
        logger.error(`Failed to send DM to ${invitee.username}:`, error);
        await interaction.editReply({
          content: `❌ Could not send a DM to ${invitee.username}. They may have DMs disabled.`,
        });
      }
    } catch (error) {
      logger.error('Error sending group invitation:', error);
      await interaction.editReply({
        content: '❌ Failed to send invitation. Please try again later.',
      });
    }
  },
};
