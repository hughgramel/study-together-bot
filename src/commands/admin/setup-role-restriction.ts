/**
 * /setup-role-restriction Command
 *
 * Restrict a role mention (@role) to a specific channel only.
 * Enforcement is two-layered:
 *   1. Discord-native: the role is set as non-mentionable so no user or bot can
 *      directly ping it — pinging is done via /studyping which uses allowedMentions.
 *   2. Bot fallback: messageCreate deletes any message that somehow mentions the
 *      role outside the allowed channel (e.g. from a user with Mention Everyone perm).
 *
 * Usage:
 *   /setup-role-restriction add role:<@role> channel:<#channel>
 *   /setup-role-restriction list
 *   /setup-role-restriction remove role:<@role>
 *   /setup-role-restriction sync   ← re-applies non-mentionable to all restricted roles
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
            .setDescription('The only channel where this role may be pinged via /studyping')
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
        .setDescription('Re-apply non-mentionable flag to all restricted roles (use to fix broken state)')
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
          content: `**@${role.name}** is already restricted to <#${existing.allowedChannelId}>. Remove it first to change the channel.`,
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

      // ── Discord-native enforcement: make the role non-mentionable ──────────
      // This prevents any user or spambot from directly pinging the role.
      // Members ping it via /studyping, which uses allowedMentions to bypass this.
      let nativeNote = '✅ Role set as non-mentionable — no user or bot can directly ping it.';
      try {
        if (role.mentionable) {
          await role.setMentionable(false, `Restricted to #${channel.name} via /setup-role-restriction`);
        } else {
          nativeNote = '✅ Role was already non-mentionable.';
        }
      } catch {
        nativeNote = '⚠️ Could not set role as non-mentionable — make sure the bot role is positioned **above** this role in Server Settings → Roles. Bot-based deletion is still active.';
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Role Restriction Added')
            .setColor(nativeNote.startsWith('⚠️') ? 0xffaa00 : 0x00ff00)
            .setDescription(
              `**@${role.name}** is now restricted to <#${channel.id}>.\n\n` +
              `${nativeNote}\n\n` +
              `Members can ping the role using \`/studyping\` in your designated bot-commands channel.`
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
        `• **@${r.roleName}** → only in <#${r.allowedChannelId}>`
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

      await interaction.reply({
        content:
          `Restriction for **@${role.name}** removed.\n\n` +
          `ℹ️ The role is still non-mentionable. Re-enable it manually in **Server Settings → Roles** if you want it freely pingable again.`,
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
        const channelExists = await interaction.guild!.channels.fetch(restriction.allowedChannelId).catch(() => null);

        if (!fetchedRole) {
          results.push(`❌ **@${restriction.roleName}** — role not found. Run \`/setup-role-restriction remove\` to clean it up.`);
          continue;
        }
        if (!channelExists) {
          results.push(`❌ **@${restriction.roleName}** — allowed channel \`#${restriction.allowedChannelName}\` not found. Run \`/setup-role-restriction remove\` to clean it up.`);
          continue;
        }

        let roleStatus: string;
        try {
          if (fetchedRole.mentionable) {
            await fetchedRole.setMentionable(false, 'Re-synced via /setup-role-restriction sync');
            roleStatus = '✅ set to non-mentionable';
          } else {
            roleStatus = '✅ already non-mentionable';
          }
        } catch {
          roleStatus = '⚠️ could not set non-mentionable — check bot role position';
        }

        results.push(`**@${fetchedRole.name}** → <#${restriction.allowedChannelId}> | ${roleStatus}`);
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Role Restrictions Synced')
            .setColor(0x0080ff)
            .setDescription(results.join('\n'))
            .setFooter({ text: 'Use /studyping to send a restricted role ping to its configured channel.' }),
        ],
      });
      return;
    }
  },
};
