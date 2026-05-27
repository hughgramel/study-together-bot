/**
 * /setup-reaction-role Command
 *
 * Configure reaction-based role assignment. When a user reacts to the specified
 * message with the specified emoji, they receive the role. Removing the reaction
 * revokes the role.
 *
 * Usage:
 *   /setup-reaction-role add message_id:<id> emoji:<emoji> role:<@role>
 *   /setup-reaction-role list
 *   /setup-reaction-role remove message_id:<id> emoji:<emoji>
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Role,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { ServerConfig, ReactionRoleConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupReactionRole');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-reaction-role')
    .setDescription('Configure reaction-based role assignment (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a new reaction role')
        .addStringOption(o =>
          o.setName('message_id')
            .setDescription('ID of the message to watch for reactions')
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('emoji')
            .setDescription('Emoji to react with (e.g. ✅ or custom emoji name/ID)')
            .setRequired(true)
        )
        .addRoleOption(o =>
          o.setName('role')
            .setDescription('Role to assign when the user reacts')
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('channel_id')
            .setDescription('Channel ID where the message lives (defaults to current channel)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all configured reaction roles')
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a reaction role entry')
        .addStringOption(o =>
          o.setName('message_id')
            .setDescription('Message ID of the entry to remove')
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('emoji')
            .setDescription('Emoji of the entry to remove')
            .setRequired(true)
        )
    ),

  async execute(interaction, context) {
    const { db } = context;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    const configRef = db
      .collection('discord-data')
      .doc('serverConfig')
      .collection('configs')
      .doc(guildId);

    const configDoc = await configRef.get();
    const config = (configDoc.exists ? configDoc.data() : {}) as Partial<ServerConfig>;
    const reactionRoles: ReactionRoleConfig[] = config.reactionRoles || [];

    // ── ADD ──────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id', true).trim();
      const emoji = interaction.options.getString('emoji', true).trim();
      const role = interaction.options.getRole('role', true) as Role;
      const channelId =
        interaction.options.getString('channel_id')?.trim() || interaction.channelId;

      // Deduplicate
      const existing = reactionRoles.find(
        r => r.messageId === messageId && r.emoji === emoji
      );
      if (existing) {
        await interaction.reply({
          content: `A reaction role for that message + emoji already exists (role: <@&${existing.roleId}>).`,
          ephemeral: true,
        });
        return;
      }

      const entry: ReactionRoleConfig = {
        messageId,
        channelId,
        emoji,
        roleId: role.id,
        roleName: role.name,
      };

      reactionRoles.push(entry);

      await configRef.set(
        { reactionRoles, setupAt: Timestamp.now(), setupBy: interaction.user.id },
        { merge: true }
      );

      logger.info(`Reaction role added: msg ${messageId} + ${emoji} → ${role.name} in guild ${guildId}`);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Reaction Role Added')
            .setColor(0x00ff00)
            .setDescription(
              `React with **${emoji}** on message \`${messageId}\` in <#${channelId}> to get the <@&${role.id}> role.`
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      if (reactionRoles.length === 0) {
        await interaction.reply({ content: 'No reaction roles configured yet.', ephemeral: true });
        return;
      }

      const lines = reactionRoles.map(r =>
        `• ${r.emoji} on \`${r.messageId}\` (in <#${r.channelId}>) → <@&${r.roleId}>`
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Configured Reaction Roles')
            .setColor(0x0080ff)
            .setDescription(lines.join('\n')),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id', true).trim();
      const emoji = interaction.options.getString('emoji', true).trim();

      const before = reactionRoles.length;
      const updated = reactionRoles.filter(
        r => !(r.messageId === messageId && r.emoji === emoji)
      );

      if (updated.length === before) {
        await interaction.reply({ content: 'No matching reaction role found.', ephemeral: true });
        return;
      }

      await configRef.set(
        { reactionRoles: updated, setupAt: Timestamp.now(), setupBy: interaction.user.id },
        { merge: true }
      );

      await interaction.reply({
        content: `Reaction role for message \`${messageId}\` + emoji **${emoji}** removed.`,
        ephemeral: true,
      });
      return;
    }
  },
};
