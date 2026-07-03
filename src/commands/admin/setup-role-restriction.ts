/**
 * /setup-role-restriction Command
 *
 * Restrict a role mention (@role) to a specific channel only.
 * Any message that pings the restricted role outside the allowed channel
 * will be automatically deleted and the user will be warned.
 *
 * Usage:
 *   /setup-role-restriction add role:<@role> channel:<#channel>
 *   /setup-role-restriction list
 *   /setup-role-restriction remove role:<@role>
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Role,
  GuildBasedChannel,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { ServerConfig, RoleMentionRestriction } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupRoleRestriction');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-role-restriction')
    .setDescription('Restrict a role mention to a specific channel only (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Restrict a role mention to one channel')
        .addRoleOption(o =>
          o.setName('role')
            .setDescription('The role to restrict (e.g. @study with me)')
            .setRequired(true)
        )
        .addChannelOption(o =>
          o.setName('channel')
            .setDescription('The only channel where this role may be mentioned')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all configured role mention restrictions')
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a role mention restriction')
        .addRoleOption(o =>
          o.setName('role')
            .setDescription('The role to unrestrict')
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
    const restrictions: RoleMentionRestriction[] = config.roleMentionRestrictions || [];

    // ── ADD ──────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const role = interaction.options.getRole('role', true) as Role;
      const channel = interaction.options.getChannel('channel', true) as GuildBasedChannel;

      const existing = restrictions.find(r => r.roleId === role.id);
      if (existing) {
        await interaction.reply({
          content: `<@&${role.id}> is already restricted to <#${existing.allowedChannelId}>. Remove it first to change the channel.`,
          ephemeral: true,
        });
        return;
      }

      const entry: RoleMentionRestriction = {
        roleId: role.id,
        roleName: role.name,
        allowedChannelId: channel.id,
        allowedChannelName: channel.name,
      };

      restrictions.push(entry);

      await configRef.set(
        { roleMentionRestrictions: restrictions, setupAt: Timestamp.now(), setupBy: interaction.user.id },
        { merge: true }
      );

      logger.info(`Role restriction added: @${role.name} → #${channel.name} in guild ${guildId}`);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Role Restriction Added')
            .setColor(0x00ff00)
            .setDescription(
              `<@&${role.id}> can now only be mentioned in <#${channel.id}>.\n\nMessages that ping this role outside that channel will be automatically deleted.`
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      if (restrictions.length === 0) {
        await interaction.reply({ content: 'No role mention restrictions configured yet.', ephemeral: true });
        return;
      }

      const lines = restrictions.map(r =>
        `• <@&${r.roleId}> → only in <#${r.allowedChannelId}>`
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Role Mention Restrictions')
            .setColor(0x0080ff)
            .setDescription(lines.join('\n')),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const role = interaction.options.getRole('role', true) as Role;

      const before = restrictions.length;
      const updated = restrictions.filter(r => r.roleId !== role.id);

      if (updated.length === before) {
        await interaction.reply({
          content: `No restriction found for <@&${role.id}>.`,
          ephemeral: true,
        });
        return;
      }

      await configRef.set(
        { roleMentionRestrictions: updated, setupAt: Timestamp.now(), setupBy: interaction.user.id },
        { merge: true }
      );

      logger.info(`Role restriction removed: @${role.name} in guild ${guildId}`);

      await interaction.reply({
        content: `Restriction for <@&${role.id}> removed. The role can now be mentioned anywhere.`,
        ephemeral: true,
      });
      return;
    }
  },
};
