/**
 * /unpause Command
 *
 * Resumes a paused session timer.
 */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('UnpauseCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unpause')
    .setDescription('Resume your paused session'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) resuming session`);

    try {
      // Initialize session service
      const sessionService = new SessionService(db);

      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        logger.warn(`User ${user.id} has no active session`);
        await interaction.reply({
          content: 'No active session to resume.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!session.isPaused) {
        logger.warn(`User ${user.id} session is not paused`);
        await interaction.reply({
          content: 'Session is not paused.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Calculate paused duration
      const pausedDuration = session.pausedDuration || 0;
      const pauseTime = session.pausedAt
        ? (Timestamp.now().toMillis() - session.pausedAt.toMillis()) / 1000
        : 0;

      await sessionService.updateActiveSession(user.id, {
        isPaused: false,
        pausedDuration: pausedDuration + pauseTime,
        pausedAt: FieldValue.delete() as any, // Remove pausedAt field
      });

      logger.info(`Session resumed for user ${user.id}`);

      await interaction.reply({
        content: '▶️ Session resumed. Keep up the great work!',
      });
    } catch (error) {
      logger.error('Error resuming session:', error);
      await interaction.reply({
        content: 'Failed to resume session. Please try again later.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};
