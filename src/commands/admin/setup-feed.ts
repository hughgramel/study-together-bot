/**
 * /setup-feed Command
 *
 * Configure the feed channel for completed sessions (Admin only).
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { getServerConfig } from '../../utils/serverHelpers';
import { ServerConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupFeedCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-feed')
    .setDescription('Configure the feed channel for completed sessions (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to post completed sessions')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel', true);

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
        content: 'Only server administrators can set up the feed channel.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(`User ${user.username} (${user.id}) setting feed channel to ${channel.id} in guild ${guildId}`);

      // Get existing config
      const existingConfig = await getServerConfig(db, guildId);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        feedChannelId: channel.id,
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
        content: `Feed channel set to <#${channel.id}>\n\nCompleted sessions will now be posted there automatically.`,
        ephemeral: true,
      });

      logger.info(`Feed channel set successfully for guild ${guildId}`);
    } catch (error) {
      logger.error('Error setting feed channel', error);
      await interaction.reply({
        content: 'An error occurred while setting the feed channel. Please try again.',
        ephemeral: true,
      });
    }
  },
};
