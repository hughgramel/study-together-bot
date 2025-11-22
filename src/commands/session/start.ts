/**
 * /start Command
 *
 * Starts a new productivity session for the user.
 * Posts a notification to the feed channel if configured.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { postSessionStartToFeed } from '../../utils/serverHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StartCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start a new productivity session')
    .addStringOption((option) =>
      option
        .setName('activity')
        .setDescription('What you are working on')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;
    const activity = interaction.options.getString('activity', true);

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    logger.info(`User ${user.username} (${user.id}) starting session: ${activity}`);

    // Initialize session service
    const sessionService = new SessionService(db);

    // Check if user already has an active session
    const existingSession = await sessionService.getActiveSession(user.id);

    if (existingSession) {
      logger.warn(`User ${user.id} already has an active session`);
      await interaction.reply({
        content:
          'You already have an active session! Use /stop to complete it first.',
        ephemeral: true,
      });
      return;
    }

    // Create new session
    await sessionService.createActiveSession(
      user.id,
      user.username,
      guildId,
      activity
    );

    logger.info(`Session created successfully for user ${user.id}`);

    await interaction.reply({
      content: `🚀 You're live! Your session is now active.\n\n**Working on:** ${activity}`,
      ephemeral: true,
    });

    // Get user's avatar URL and post to feed
    const avatarUrl = user.displayAvatarURL({ size: 128 });
    await postSessionStartToFeed(
      db,
      client,
      interaction,
      user.username,
      user.id,
      avatarUrl,
      activity
    );

    logger.info(`Session start posted to feed for user ${user.id}`);
  },
};
