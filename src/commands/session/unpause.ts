/**
 * /unpause Command
 *
 * Resumes a paused session timer.
 */

import { SlashCommandBuilder } from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
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

    // Initialize session service
    const sessionService = new SessionService(db);

    const session = await sessionService.getActiveSession(user.id);

    if (!session) {
      logger.warn(`User ${user.id} has no active session`);
      await interaction.reply({
        content: 'No active session to resume.',
        ephemeral: false,
      });
      return;
    }

    if (!session.isPaused) {
      logger.warn(`User ${user.id} session is not paused`);
      await interaction.reply({
        content: 'Session is not paused.',
        ephemeral: false,
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
      pausedAt: undefined as any, // Remove pausedAt field
    });

    logger.info(`Session resumed for user ${user.id}`);

    await interaction.reply({
      content: '▶️ Session resumed. Keep up the great work!',
      ephemeral: false,
    });
  },
};
