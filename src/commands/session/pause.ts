/**
 * /pause Command
 *
 * Pauses the active session timer.
 */

import { SlashCommandBuilder } from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PauseCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause your active session'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) pausing session`);

    try {
      // Initialize session service
      const sessionService = new SessionService(db);

      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        logger.warn(`User ${user.id} has no active session`);
        await interaction.reply({
          content: 'No active session to pause.',
          ephemeral: false,
        });
        return;
      }

      if (session.isPaused) {
        logger.warn(`User ${user.id} session is already paused`);
        await interaction.reply({
          content: 'Session is already paused.',
          ephemeral: false,
        });
        return;
      }

      // Pause the timed session timer if applicable
      try {
        const { pauseTimer } = await import('./start');
        pauseTimer(user.id);
      } catch (error) {
        logger.warn(`Could not pause timer (may not be a timed session):`, error);
      }

      // Pause the Pomodoro timer if applicable
      try {
        const { pausePomodoroTimer } = await import('./pomodoro');
        pausePomodoroTimer(user.id);
      } catch (error) {
        logger.warn(`Could not pause Pomodoro timer (may not be a Pomodoro session):`, error);
      }

      await sessionService.updateActiveSession(user.id, {
        isPaused: true,
        pausedAt: Timestamp.now(),
      });

      logger.info(`Session paused for user ${user.id}`);

      await interaction.reply({
        content: '⏸️ Session paused. Use /unpause when ready to continue.',
        ephemeral: false,
      });
    } catch (error) {
      logger.error('Error pausing session:', error);
      await interaction.reply({
        content: 'Failed to pause session. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};
