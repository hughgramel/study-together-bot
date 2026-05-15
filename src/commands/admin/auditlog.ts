/**
 * /auditlog Command
 *
 * Moderator-only command to search and view the permanent deleted-message log.
 * Records cannot be deleted, even by moderators.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { Command } from '../types';
import { ModerationService, MessageLogEntry } from '../../services/moderation';

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function formatEntry(entry: MessageLogEntry, index: number): string {
  const deletedTs = entry.deletedAt
    ? `<t:${Math.floor(entry.deletedAt.toMillis() / 1000)}:R>`
    : 'unknown time';

  const content = entry.content
    ? `> ${truncate(entry.content.replace(/\n/g, ' '), 180)}`
    : '> *(no text content)*';

  const editNote =
    entry.editHistory?.length > 0
      ? ` • edited ${entry.editHistory.length}x before deletion`
      : '';

  const attachNote =
    entry.attachments?.length > 0 ? ` • ${entry.attachments.length} attachment(s)` : '';

  return [
    `**${index + 1}.** <@${entry.authorId}> (\`${entry.authorUsername}\`) in <#${entry.channelId}>`,
    content,
    `Deleted ${deletedTs}${editNote}${attachNote}`,
  ].join('\n');
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('auditlog')
    .setDescription('Search the permanent deleted-message audit log (moderators only)')
    .addSubcommand((sub) =>
      sub
        .setName('recent')
        .setDescription('Show the 10 most recently deleted messages in this server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Search deleted messages by user, channel, or keyword')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Filter by author').setRequired(false)
        )
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Filter by channel').setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('keyword')
            .setDescription('Search keyword in message content')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, context) {
    const { db } = context;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: 'You need the **Manage Messages** permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const modService = new ModerationService(db);
    const guildId = interaction.guildId!;
    const subcommand = (interaction as ChatInputCommandInteraction).options.getSubcommand();

    let entries: MessageLogEntry[] = [];

    if (subcommand === 'recent') {
      entries = await modService.getRecentDeletedMessages(guildId, 10);
    } else {
      const user = interaction.options.getUser('user');
      const channel = interaction.options.getChannel('channel');
      const keyword = interaction.options.getString('keyword') ?? undefined;

      entries = await modService.searchDeletedMessages({
        guildId,
        authorId: user?.id,
        channelId: channel?.id,
        keyword,
        limit: 10,
      });
    }

    if (entries.length === 0) {
      await interaction.editReply({
        content: 'No deleted messages found matching your criteria.',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Audit Log — Deleted Messages')
      .setColor(0xff4444)
      .setDescription(entries.map(formatEntry).join('\n\n'))
      .setFooter({
        text: `Showing ${entries.length} result${entries.length !== 1 ? 's' : ''} • Records are permanent and cannot be deleted`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
