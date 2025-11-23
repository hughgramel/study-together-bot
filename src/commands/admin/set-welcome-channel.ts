/**
 * /set-welcome-channel Command
 *
 * Configure the welcome channel for new members (Admin only).
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

const logger = createLogger('SetWelcomeChannelCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('set-welcome-channel')
    .setDescription('Configure the welcome channel for new members (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send welcome messages')
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
        content: 'Only server administrators can set the welcome channel.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(`User ${user.username} (${user.id}) setting welcome channel to ${channel.id} in guild ${guildId}`);

      // Get existing config
      const existingConfig = await getServerConfig(db, guildId);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        welcomeChannelId: channel.id,
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
        content: `Welcome channel set to <#${channel.id}>\n\nNew members will receive a welcome message in this channel when they join!`,
        ephemeral: true,
      });

      logger.info(`Welcome channel set successfully for guild ${guildId}`);
    } catch (error) {
      logger.error('Error setting welcome channel', error);
      await interaction.reply({
        content: 'An error occurred while setting the welcome channel. Please try again.',
        ephemeral: true,
      });
    }
  },
};
