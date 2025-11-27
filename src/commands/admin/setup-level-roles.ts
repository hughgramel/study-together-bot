/**
 * /setup-level-roles Command
 *
 * Configure automatic role assignment based on user levels (Admin only).
 * Allows setting up to 10 level-based roles that are automatically assigned/removed.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { Command } from '../types';
import { setLevelRoleConfig, getLevelRoleConfig } from '../../services/levelRoles';
import { LevelRoleConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupLevelRolesCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-level-roles')
    .setDescription('Configure automatic role assignment based on levels (Admin only)')
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
      // Get existing config to show in modal
      const existingRoles = await getLevelRoleConfig(db, guildId);
      const existingText = existingRoles
        .map((r) => `${r.level}:${r.roleId}`)
        .join('\n');

      // Show modal for configuration
      const modal = new ModalBuilder()
        .setCustomId(`setup-level-roles-modal:${guildId}`)
        .setTitle('Configure Level Roles');

      const rolesInput = new TextInputBuilder()
        .setCustomId('roles')
        .setLabel('Level:RoleID pairs (one per line)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          'Example:\n10:1234567890123456789\n25:9876543210987654321\n50:1111111111111111111'
        )
        .setRequired(false)
        .setValue(existingText);

      const instructionsInput = new TextInputBuilder()
        .setCustomId('instructions')
        .setLabel('Instructions (read-only)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(
          'Format: level:roleID (one per line)\n' +
            'Right-click a role → Copy ID to get role IDs.\n' +
            'Example: 10:1234567890123456789\n' +
            'Leave blank to clear all level roles.'
        )
        .setRequired(false);

      const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(
        rolesInput
      );
      const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(
        instructionsInput
      );

      modal.addComponents(row1, row2);

      await interaction.showModal(modal);

      logger.info(
        `User ${interaction.user.username} opened level roles config modal for guild ${guildId}`
      );
    } catch (error) {
      logger.error('Error showing level roles modal', error);
      await interaction.reply({
        content: 'An error occurred while opening the configuration modal.',
        ephemeral: true,
      });
    }
  },
};
