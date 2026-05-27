/**
 * /setup-san-roles Command
 *
 * Create or sync the 17 san-level Discord roles.
 * Each role has a unique OKLCH colour (L=0.3, C=0.1, evenly-spaced hue).
 *
 * Subcommands:
 *   create  – Create/update roles in Discord and store config
 *   sync    – Re-assign every member's san role based on current XP
 *   info    – Show current configuration and tier colours
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { SanRoleConfig, ServerConfig } from '../../types';
import {
  SAN_TIERS,
  SAN_TIER_COLORS,
  createSanRoles,
  syncAllSanRoles,
  getCurrentSanXp,
} from '../../services/sanRoles';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupSanRoles');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-san-roles')
    .setDescription('Set up and manage san-level XP roles (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create/update the 17 san-level roles with OKLCH colours')
        .addUserOption(o =>
          o.setName('san')
            .setDescription('The user to use as the "san" reference (defaults to current #1 XP user)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('sync')
        .setDescription("Re-assign every member's san role based on current XP")
    )
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Show current san-role configuration')
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (sub === 'create') {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild!;
      const configRef = db
        .collection('discord-data')
        .doc('serverConfig')
        .collection('configs')
        .doc(guildId);

      const configDoc = await configRef.get();
      const existing = configDoc.exists
        ? ((configDoc.data() as ServerConfig).sanRoleConfig?.roles ?? {})
        : {};

      // Determine sanXp reference
      let sanXp: number;
      let sanUserId: string | undefined;

      const sanUserOption = interaction.options.getUser('san');
      if (sanUserOption) {
        // Look up XP for specified user
        const statsDoc = await db
          .collection('discord-data')
          .doc('userStats')
          .collection('stats')
          .doc(sanUserOption.id)
          .get();
        sanXp = (statsDoc.exists ? (statsDoc.data()?.xp as number) : 0) || 0;
        sanUserId = sanUserOption.id;
      } else {
        // Use current global max XP
        const top = await getCurrentSanXp(db);
        sanXp = top.xp;
        sanUserId = top.userId;
      }

      if (sanXp === 0) {
        await interaction.editReply('No XP data found. Make sure users have completed sessions first.');
        return;
      }

      logger.info(`Creating san roles for guild ${guildId}, sanXp=${sanXp}`);

      const roleMap = await createSanRoles(guild, existing);

      const sanConfig: SanRoleConfig = {
        sanXp,
        sanUserId,
        updatedAt: Timestamp.now(),
        roles: roleMap,
      };

      await configRef.set({ sanRoleConfig: sanConfig }, { merge: true });

      const tierLines = SAN_TIERS.map((t, i) => {
        const roleId = roleMap[t.name];
        const hex = '#' + SAN_TIER_COLORS[i].toString(16).padStart(6, '0');
        return roleId
          ? `<@&${roleId}> — \`oklch(0.3 0.1 ${t.hue.toFixed(1)}°)\` ${hex}`
          : `${t.name} — failed to create`;
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('San Roles Created')
            .setColor(0x00ff00)
            .setDescription(
              `**Reference XP (san):** ${sanXp.toLocaleString()} XP` +
              (sanUserId ? ` (<@${sanUserId}>)` : '') +
              '\n\n' +
              tierLines.join('\n')
            ),
        ],
      });
      return;
    }

    // ── SYNC ──────────────────────────────────────────────────────────────────
    if (sub === 'sync') {
      await interaction.deferReply({ ephemeral: true });

      let lastUpdate = Date.now();

      const results = await syncAllSanRoles(db, client, guildId, (cur, total, name) => {
        const now = Date.now();
        if (now - lastUpdate > 2000) {
          lastUpdate = now;
          interaction.editReply(`Syncing san roles… ${cur}/${total} (${name})`).catch(() => {});
        }
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('San Role Sync Complete')
            .setColor(0x00ff00)
            .addFields(
              { name: 'Synced', value: String(results.synced), inline: true },
              { name: 'Errors', value: String(results.errors), inline: true },
              {
                name: 'Current san XP',
                value: results.newSanXp.toLocaleString() + ' XP',
                inline: true,
              }
            ),
        ],
      });
      return;
    }

    // ── INFO ──────────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const configDoc = await db
        .collection('discord-data')
        .doc('serverConfig')
        .collection('configs')
        .doc(guildId)
        .get();

      if (!configDoc.exists) {
        await interaction.reply({ content: 'No server config found.', ephemeral: true });
        return;
      }

      const sanConfig: SanRoleConfig | undefined = (configDoc.data() as ServerConfig).sanRoleConfig;

      if (!sanConfig) {
        await interaction.reply({
          content: 'San roles not configured yet. Run `/setup-san-roles create` first.',
          ephemeral: true,
        });
        return;
      }

      const tierLines = SAN_TIERS.map((t, i) => {
        const roleId = sanConfig.roles[t.name];
        const hex = '#' + SAN_TIER_COLORS[i].toString(16).padStart(6, '0');
        return roleId ? `<@&${roleId}> (${hex})` : `${t.name} — not configured`;
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('San Role Configuration')
            .setColor(0x0080ff)
            .addFields(
              {
                name: 'Reference XP (san)',
                value: sanConfig.sanXp.toLocaleString() + ' XP' +
                  (sanConfig.sanUserId ? ` (<@${sanConfig.sanUserId}>)` : ''),
              },
              { name: 'Tiers', value: tierLines.join('\n') }
            ),
        ],
        ephemeral: true,
      });
    }
  },
};
