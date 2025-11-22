/**
 * /setup-timezone Command
 *
 * Configure the server timezone for events (Admin only).
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { getServerConfig } from '../../utils/serverHelpers';
import { ServerConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupTimezoneCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-timezone')
    .setDescription('Configure the server timezone for events (Admin only)')
    .addStringOption((option) =>
      option
        .setName('timezone')
        .setDescription('IANA timezone (e.g., America/New_York, America/Los_Angeles, America/Chicago)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;
    const timezone = interaction.options.getString('timezone', true);

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
        content: 'Only server administrators can set the timezone.',
        ephemeral: true,
      });
      return;
    }

    // Validate timezone by trying to use it
    try {
      new Date().toLocaleString('en-US', { timeZone: timezone });
    } catch (error) {
      await interaction.reply({
        content: `Invalid timezone: \`${timezone}\`\n\nPlease use a valid IANA timezone like:\n- \`America/New_York\` (Eastern)\n- \`America/Chicago\` (Central)\n- \`America/Denver\` (Mountain)\n- \`America/Los_Angeles\` (Pacific)\n\nSee full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`,
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(`User ${user.username} (${user.id}) setting timezone to ${timezone} in guild ${guildId}`);

      // Get existing config
      const existingConfig = await getServerConfig(db, guildId);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        timezone: timezone,
        setupAt: Timestamp.now(),
        setupBy: user.id,
      };

      await db
        .collection('discord-data')
        .doc('serverConfig')
        .collection('configs')
        .doc(guildId)
        .set(config);

      await interaction.reply({
        content: `Server timezone set to \`${timezone}\`\n\nAll event times will now be interpreted in this timezone!`,
        ephemeral: true,
      });

      logger.info(`Timezone set successfully for guild ${guildId}`);
    } catch (error) {
      logger.error('Error setting timezone', error);
      await interaction.reply({
        content: 'An error occurred while setting the timezone. Please try again.',
        ephemeral: true,
      });
    }
  },
};
