/**
 * /time Command
 *
 * Shows the current session status and elapsed time.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { calculateDuration, formatDuration } from '../../utils/formatters';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TimeCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('time')
    .setDescription('Check your current session time'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: false });

    logger.info(`User ${user.username} (${user.id}) checking session time`);

    // Initialize session service
    const sessionService = new SessionService(db);

    const session = await sessionService.getActiveSession(user.id);

    if (!session) {
      logger.warn(`User ${user.id} has no active session`);
      await interaction.editReply({
        content: 'No active session. Use /start {activity} to begin tracking!',
      });
      return;
    }

    const elapsed = calculateDuration(
      session.startTime,
      session.pausedDuration,
      session.isPaused ? session.pausedAt : undefined
    );

    const elapsedStr = formatDuration(elapsed);
    const pauseStatus = session.isPaused ? '⏸️ Paused' : '▶️ Active';

    logger.info(`Session time for user ${user.id}: ${elapsedStr} (${pauseStatus})`);

    await interaction.editReply({
      content: `**Current Session**

**Status:** ${pauseStatus}
**Activity:** ${session.activity}
**Elapsed Time:** ${elapsedStr}`,
    });
  },
};
