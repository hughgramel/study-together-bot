/**
 * /cancel Command
 *
 * Cancels the active session without saving or posting to feed.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CancelCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cancel')
    .setDescription('Cancel your active session without saving'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) cancelling session`);

    // Initialize session service
    const sessionService = new SessionService(db);

    const session = await sessionService.getActiveSession(user.id);

    if (!session) {
      logger.warn(`User ${user.id} has no active session to cancel`);
      await interaction.reply({
        content: 'No active session to cancel.',
        ephemeral: false,
      });
      return;
    }

    await sessionService.deleteActiveSession(user.id);

    logger.info(`Session cancelled for user ${user.id}`);

    await interaction.reply({
      content:
        '❌ Session cancelled. No stats were updated and nothing was posted to the feed.',
      ephemeral: false,
    });
  },
};
