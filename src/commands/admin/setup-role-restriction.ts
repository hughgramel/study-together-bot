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
  GuildChannel,
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
    )
    .addSubcommand(sub =>
      sub
        .setName('sync')
        .setDescription('Re-apply Discord-native restrictions for all configured rules (use to fix broken state)')
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

      // ── Discord-native enforcement ─────────────────────────────────────────
      // Layer 1: Make the role non-mentionable so regular users cannot ping it
      // anywhere by default. This prevents ghost pings at the Discord level.
      const nativeWarnings: string[] = [];

      try {
        if (role.mentionable) {
          await role.setMentionable(false, `Restricted to #${channel.name} via /setup-role-restriction`);
        }
      } catch {
        nativeWarnings.push('⚠️ Could not set role as non-mentionable — make sure the bot role is positioned **above** this role in Server Settings → Roles.');
      }

      // Layer 2: Grant MentionEveryone in the allowed channel for @everyone so
      // members can still ping the role there specifically.
      try {
        if (channel instanceof GuildChannel) {
          await channel.permissionOverwrites.edit(
            interaction.guild!.roles.everyone,
            { MentionEveryone: true },
            { reason: `Allow @${role.name} pings in this channel only (setup-role-restriction)` }
          );
        }
      } catch {
        nativeWarnings.push('⚠️ Could not set channel permission override — make sure the bot has **Manage Roles** or **Manage Channels** permission.');
      }

      const warningText = nativeWarnings.length > 0
        ? `\n\n${nativeWarnings.join('\n')}\n\nThe bot-based fallback (message deletion) is still active.`
        : '\n\n✅ Discord-native restriction applied: the role is now non-mentionable everywhere except <#' + channel.id + '>.';

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Role Restriction Added')
            .setColor(nativeWarnings.length > 0 ? 0xffaa00 : 0x00ff00)
            .setDescription(
              `**@${role.name}** can now only be mentioned in <#${channel.id}>.` +
              warningText
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
      const removed = restrictions.find(r => r.roleId === role.id);
      const updated = restrictions.filter(r => r.roleId !== role.id);

      if (updated.length === before) {
        await interaction.reply({
          content: `No restriction found for **@${role.name}**.`,
          ephemeral: true,
        });
        return;
      }

      await configRef.set(
        { roleMentionRestrictions: updated, setupAt: Timestamp.now(), setupBy: interaction.user.id },
        { merge: true }
      );

      logger.info(`Role restriction removed: @${role.name} in guild ${guildId}`);

      // ── Clean up Discord-native enforcement ───────────────────────────────
      const cleanupNotes: string[] = [];

      if (removed) {
        // Remove the MentionEveryone override from the previously-allowed channel
        try {
          const allowedChannel = await interaction.guild!.channels.fetch(removed.allowedChannelId).catch(() => null);
          if (allowedChannel instanceof GuildChannel) {
            await allowedChannel.permissionOverwrites.delete(
              interaction.guild!.roles.everyone,
              `Role restriction removed for @${role.name}`
            );
          }
        } catch {
          cleanupNotes.push(`⚠️ Could not remove channel override from <#${removed.allowedChannelId}> — remove it manually if needed.`);
        }
      }

      // Note: we intentionally leave the role as non-mentionable.
      // Re-enable it manually in Server Settings if desired.
      cleanupNotes.push('ℹ️ The role remains non-mentionable. Re-enable it in **Server Settings → Roles** if you want it freely pingable again.');

      await interaction.reply({
        content: `Restriction for **@${role.name}** removed.\n\n${cleanupNotes.join('\n')}`,
        ephemeral: true,
      });
      return;
    }

    // ── SYNC ─────────────────────────────────────────────────────────────────
    if (sub === 'sync') {
      if (restrictions.length === 0) {
        await interaction.reply({ content: 'No role restrictions are configured. Nothing to sync.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const results: string[] = [];

      for (const restriction of restrictions) {
        const fetchedRole = await interaction.guild!.roles.fetch(restriction.roleId).catch(() => null);
        const fetchedChannel = await interaction.guild!.channels.fetch(restriction.allowedChannelId).catch(() => null);

        if (!fetchedRole) {
          results.push(`❌ Role \`${restriction.roleName}\` (${restriction.roleId}) not found — consider removing this restriction.`);
          continue;
        }
        if (!fetchedChannel) {
          results.push(`❌ Channel \`#${restriction.allowedChannelName}\` (${restriction.allowedChannelId}) not found — consider removing this restriction.`);
          continue;
        }

        let roleStatus = '✅ non-mentionable';
        let channelStatus = `✅ MentionEveryone in <#${fetchedChannel.id}>`;

        try {
          if (fetchedRole.mentionable) {
            await fetchedRole.setMentionable(false, 'Re-synced via /setup-role-restriction sync');
          }
        } catch {
          roleStatus = '⚠️ could not set non-mentionable (check bot role position)';
        }

        try {
          if (fetchedChannel instanceof GuildChannel) {
            await fetchedChannel.permissionOverwrites.edit(
              interaction.guild!.roles.everyone,
              { MentionEveryone: true },
              { reason: 'Re-synced via /setup-role-restriction sync' }
            );
          }
        } catch {
          channelStatus = '⚠️ could not set channel override (check bot Manage Channels permission)';
        }

        results.push(`**@${fetchedRole.name}** → role: ${roleStatus} | channel: ${channelStatus}`);
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Role Restrictions Synced')
            .setColor(0x0080ff)
            .setDescription(results.join('\n'))
            .setFooter({ text: 'Roles set as non-mentionable + MentionEveryone granted in allowed channels.' }),
        ],
      });
      return;
    }
  },
};
