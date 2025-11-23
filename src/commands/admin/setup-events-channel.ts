/**
 * /setup-events-channel Command
 *
 * Configure the events channel for study events (Admin only).
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

const logger = createLogger('SetupEventsChannelCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-events-channel')
    .setDescription('Configure the events channel for study events (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to post study events')
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
        content: 'Only server administrators can set the events channel.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(`User ${user.username} (${user.id}) setting events channel to ${channel.id} in guild ${guildId}`);

      // Get existing config
      const existingConfig = await getServerConfig(db, guildId);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        eventsChannelId: channel.id,
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
        content: `Events channel set to <#${channel.id}>\n\nAll new study events will be posted in this channel!`,
        ephemeral: true,
      });

      logger.info(`Events channel set successfully for guild ${guildId}`);
    } catch (error) {
      logger.error('Error setting events channel', error);
      await interaction.reply({
        content: 'An error occurred while setting the events channel. Please try again.',
        ephemeral: true,
      });
    }
  },
};
