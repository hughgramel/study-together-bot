/**
 * /setup-goal-channel Command
 *
 * Configure the goal channel for automatic task parsing (Admin only).
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

const logger = createLogger('SetupGoalChannelCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-goal-channel')
    .setDescription('Configure the goal channel for automatic task parsing (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel where numbered task lists will be parsed automatically')
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
        content: 'Only server administrators can set up the goal channel.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(`User ${user.username} (${user.id}) setting goal channel to ${channel.id} in guild ${guildId}`);

      // Get existing config
      const existingConfig = await getServerConfig(db, guildId);

      // Update config
      const config: ServerConfig = {
        ...existingConfig,
        goalChannelId: channel.id,
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
        content:
          `✅ Goal channel set to <#${channel.id}>\n\n` +
          `When users post numbered lists in this channel, tasks will be automatically created.\n\n` +
          `**Example:**\n` +
          `\`\`\`\n` +
          `1. Study for exam\n` +
          `2. Do homework\n` +
          `3. Work on project\n` +
          `\`\`\`\n\n` +
          `Users can then use \`/tasks\` to view and complete their tasks for XP!`,
        ephemeral: true,
      });

      logger.info(`Goal channel set successfully for guild ${guildId}`);
    } catch (error) {
      logger.error('Error setting goal channel', error);
      await interaction.reply({
        content: 'An error occurred while setting the goal channel. Please try again.',
        ephemeral: true,
      });
    }
  },
};
