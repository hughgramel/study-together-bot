/**
 * /cancel Command
 *
 * Cancels the active session without saving or posting to feed.
 * Also handles cancelling Pomodoro timer sessions.
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

    try {
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

      // Check if this is a Pomodoro session and cancel it
      try {
        const { cancelPomodoroSession } = await import('./pomodoro');
        const wasPomodoroSession = await cancelPomodoroSession(user.id, db);

        if (wasPomodoroSession) {
          logger.info(`Pomodoro session cancelled for user ${user.id}`);
          await interaction.reply({
            content:
              '❌ Pomodoro session cancelled. No stats were updated and nothing was posted to the feed.',
            ephemeral: false,
          });
          return;
        }
      } catch (error) {
        // If pomodoro module doesn't exist or fails, continue with normal cancellation
        logger.warn(`Could not check for Pomodoro session:`, error);
      }

      // Check if this is a timed session and cancel the timer
      try {
        const { cancelTimer } = await import('./start');
        cancelTimer(user.id);
      } catch (error) {
        logger.warn(`Could not cancel timer:`, error);
      }

      // Normal session cancellation
      await sessionService.deleteActiveSession(user.id);

      logger.info(`Session cancelled for user ${user.id}`);

      await interaction.reply({
        content:
          '❌ Session cancelled. No stats were updated and nothing was posted to the feed.',
        ephemeral: false,
      });
    } catch (error) {
      logger.error('Error cancelling session:', error);
      await interaction.reply({
        content: 'Failed to cancel session. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};
