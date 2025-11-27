/**
 * /setup-level-roles Command
 *
 * Configure automatic role assignment based on user levels (Admin only).
 * Allows setting up to 8 level-based roles that are automatically assigned/removed.
 *
 * Usage:
 * /setup-level-roles void:@Void charcoal:@Charcoal bronze:@Bronze ...
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../types';
import { setLevelRoleConfig, getLevelRoleConfig } from '../../services/levelRoles';
import { LevelRoleConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupLevelRolesCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-level-roles')
    .setDescription('Configure automatic role assignment based on levels (Admin only)')
    .addRoleOption((option) =>
      option
        .setName('void')
        .setDescription('Role for Level 1-3 (Void tier)')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('charcoal')
        .setDescription('Role for Level 4-8 (Charcoal tier)')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('bronze')
        .setDescription('Role for Level 9-15 (Bronze tier)')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('silver')
        .setDescription('Role for Level 16-25 (Silver tier)')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('gold')
        .setDescription('Role for Level 26-40 (Gold tier)')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('amethyst')
        .setDescription('Role for Level 41-60 (Amethyst tier)')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('diamond')
        .setDescription('Role for Level 61-85 (Diamond tier)')
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('radiant')
        .setDescription('Role for Level 86+ (Radiant tier)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    // Check if user has admin permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Only server administrators can configure level roles.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Get role options
      const voidRole = interaction.options.getRole('void');
      const charcoalRole = interaction.options.getRole('charcoal');
      const bronzeRole = interaction.options.getRole('bronze');
      const silverRole = interaction.options.getRole('silver');
      const goldRole = interaction.options.getRole('gold');
      const amethystRole = interaction.options.getRole('amethyst');
      const diamondRole = interaction.options.getRole('diamond');
      const radiantRole = interaction.options.getRole('radiant');

      // Build level role config
      const levelRoles: LevelRoleConfig[] = [];

      if (voidRole) levelRoles.push({ level: 3, roleId: voidRole.id, roleName: voidRole.name });
      if (charcoalRole) levelRoles.push({ level: 8, roleId: charcoalRole.id, roleName: charcoalRole.name });
      if (bronzeRole) levelRoles.push({ level: 15, roleId: bronzeRole.id, roleName: bronzeRole.name });
      if (silverRole) levelRoles.push({ level: 25, roleId: silverRole.id, roleName: silverRole.name });
      if (goldRole) levelRoles.push({ level: 40, roleId: goldRole.id, roleName: goldRole.name });
      if (amethystRole) levelRoles.push({ level: 60, roleId: amethystRole.id, roleName: amethystRole.name });
      if (diamondRole) levelRoles.push({ level: 85, roleId: diamondRole.id, roleName: diamondRole.name });
      if (radiantRole) levelRoles.push({ level: 86, roleId: radiantRole.id, roleName: radiantRole.name });

      // If no roles provided, show current config
      if (levelRoles.length === 0) {
        const existingRoles = await getLevelRoleConfig(db, guildId);
        if (existingRoles.length === 0) {
          await interaction.reply({
            content:
              '❌ **No level roles configured.**\n\n' +
              '**Usage:**\n' +
              '`/setup-level-roles void:@Void charcoal:@Charcoal bronze:@Bronze silver:@Silver gold:@Gold amethyst:@Amethyst diamond:@Diamond radiant:@Radiant`\n\n' +
              '**Tier Levels:**\n' +
              '• Void: Level 1-3\n' +
              '• Charcoal: Level 4-8\n' +
              '• Bronze: Level 9-15\n' +
              '• Silver: Level 16-25\n' +
              '• Gold: Level 26-40\n' +
              '• Amethyst: Level 41-60\n' +
              '• Diamond: Level 61-85\n' +
              '• Radiant: Level 86+',
            ephemeral: true,
          });
          return;
        }

        // Show existing config
        const configText = existingRoles
          .map((r) => `• Level ${r.level}+: <@&${r.roleId}>`)
          .join('\n');

        await interaction.reply({
          content: `**Current Level Role Configuration:**\n\n${configText}`,
          ephemeral: true,
        });
        return;
      }

      // Save configuration
      await setLevelRoleConfig(db, guildId, interaction.user.id, levelRoles);

      // Build confirmation message
      const configText = levelRoles
        .sort((a, b) => a.level - b.level)
        .map((r) => {
          if (r.level === 3) return `• **Void** (Level 1-3): <@&${r.roleId}>`;
          if (r.level === 8) return `• **Charcoal** (Level 4-8): <@&${r.roleId}>`;
          if (r.level === 15) return `• **Bronze** (Level 9-15): <@&${r.roleId}>`;
          if (r.level === 25) return `• **Silver** (Level 16-25): <@&${r.roleId}>`;
          if (r.level === 40) return `• **Gold** (Level 26-40): <@&${r.roleId}>`;
          if (r.level === 60) return `• **Amethyst** (Level 41-60): <@&${r.roleId}>`;
          if (r.level === 85) return `• **Diamond** (Level 61-85): <@&${r.roleId}>`;
          if (r.level === 86) return `• **Radiant** (Level 86+): <@&${r.roleId}>`;
          return `• Level ${r.level}+: <@&${r.roleId}>`;
        })
        .join('\n');

      await interaction.reply({
        content:
          `✅ **Level roles configured successfully!**\n\n${configText}\n\n` +
          `**Next steps:**\n` +
          `1. Preview changes: \`/sync-roles dry-run:True\`\n` +
          `2. Apply to all members: \`/sync-roles\``,
        ephemeral: true,
      });

      logger.info(
        `User ${interaction.user.username} configured ${levelRoles.length} level roles for guild ${guildId}`
      );
    } catch (error) {
      logger.error('Error configuring level roles', error);
      await interaction.reply({
        content: 'An error occurred while configuring level roles.',
        ephemeral: true,
      });
    }
  },
};
