/**
 * /break Command
 *
 * Pauses the active session for a specified duration (or indefinitely).
 * Works with all session types: regular, timed, and Pomodoro.
 *
 * Usage:
 * /break                - Pause indefinitely (manual unpause required)
 * /break minutes:5      - Pause for 5 minutes then auto-resume
 * /break seconds:30     - Pause for 30 seconds then auto-resume (testing only)
 */

import { SlashCommandBuilder } from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BreakCommand');

// Store active break timers: userId -> timeout ID
const activeBreakTimers = new Map<string, NodeJS.Timeout>();

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('break')
    .setDescription('Take a break (pause your session temporarily)')
    .addIntegerOption((option) =>
      option
        .setName('minutes')
        .setDescription('Break duration in minutes (optional - leave empty for indefinite pause)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(120)
    )
    .addIntegerOption((option) =>
      option
        .setName('seconds')
        .setDescription('Break duration in seconds (testing only)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(3600)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const breakMinutes = interaction.options.getInteger('minutes');
    const breakSeconds = interaction.options.getInteger('seconds');

    // Validate: cannot use both minutes and seconds
    if (breakMinutes !== null && breakSeconds !== null) {
      await interaction.reply({
        content: '❌ Cannot specify both minutes and seconds. Choose one or the other.',
        ephemeral: true,
      });
      return;
    }

    // Calculate total break duration in seconds
    let totalBreakSeconds: number | null = null;
    let durationText = '';

    if (breakSeconds !== null) {
      totalBreakSeconds = breakSeconds;
      durationText = `${breakSeconds} second${breakSeconds === 1 ? '' : 's'}`;
    } else if (breakMinutes !== null) {
      totalBreakSeconds = breakMinutes * 60;
      durationText = `${breakMinutes} minute${breakMinutes === 1 ? '' : 's'}`;
    }

    logger.info(
      `User ${user.username} (${user.id}) taking break${totalBreakSeconds ? ` for ${durationText}` : ' (indefinite)'}`
    );

    try {
      // Initialize session service
      const sessionService = new SessionService(db);

      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        logger.warn(`User ${user.id} has no active session`);
        await interaction.reply({
          content: 'No active session to pause.',
          ephemeral: true,
        });
        return;
      }

      if (session.isPaused) {
        logger.warn(`User ${user.id} session is already paused`);
        await interaction.reply({
          content: 'Session is already paused. Use /unpause to resume.',
          ephemeral: true,
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

      // Update session to paused state
      await sessionService.updateActiveSession(user.id, {
        isPaused: true,
        pausedAt: Timestamp.now(),
      });

      logger.info(`Session paused for user ${user.id}`);

      if (totalBreakSeconds) {
        // Timed break - set up auto-resume

        // Clear any existing break timer for this user
        const existingTimer = activeBreakTimers.get(user.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Schedule auto-resume
        const breakTimer = setTimeout(async () => {
          try {
            await autoResumeSession(user.id, db, client);
          } catch (error) {
            logger.error(`Error auto-resuming session for user ${user.id}:`, error);
          } finally {
            activeBreakTimers.delete(user.id);
          }
        }, totalBreakSeconds * 1000);

        activeBreakTimers.set(user.id, breakTimer);

        await interaction.reply({
          content:
            `☕ **Break time!**\n\n` +
            `Your session is paused for ${durationText}.\n\n` +
            `I'll automatically resume your session when the break is over.\n\n` +
            `_Use /unpause to resume early._`,
          ephemeral: false,
        });

        logger.info(`Break timer scheduled for user ${user.id}: ${durationText}`);
      } else {
        // Indefinite break - manual unpause required
        await interaction.reply({
          content:
            `☕ **Break time!**\n\n` +
            `Your session is paused. Use /unpause when you're ready to continue.`,
          ephemeral: false,
        });
      }
    } catch (error) {
      logger.error('Error starting break:', error);
      await interaction.reply({
        content: 'Failed to start break. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};

/**
 * Auto-resume a session after break timer expires
 */
async function autoResumeSession(userId: string, db: any, client: any): Promise<void> {
  logger.info(`Auto-resuming session for user ${userId} after break`);

  try {
    const sessionService = new SessionService(db);
    const session = await sessionService.getActiveSession(userId);

    if (!session) {
      logger.warn(`No active session found for auto-resume for user ${userId}`);
      return;
    }

    if (!session.isPaused) {
      logger.warn(`Session not paused for user ${userId}, skipping auto-resume`);
      return;
    }

    // Calculate paused duration
    const pausedDuration = session.pausedDuration || 0;
    const pauseTime = session.pausedAt
      ? (Timestamp.now().toMillis() - session.pausedAt.toMillis()) / 1000
      : 0;

    // Update session to resumed state
    await sessionService.updateActiveSession(userId, {
      isPaused: false,
      pausedDuration: pausedDuration + pauseTime,
      pausedAt: null as any, // Remove pausedAt field
    });

    // Resume the timed session timer if applicable
    try {
      const { resumeTimer } = await import('./start');
      await resumeTimer(userId, client, db);
    } catch (error) {
      logger.warn(`Could not resume timer (may not be a timed session):`, error);
    }

    // Resume the Pomodoro timer if applicable
    try {
      const { resumePomodoroTimer } = await import('./pomodoro');
      await resumePomodoroTimer(userId, client, db);
    } catch (error) {
      logger.warn(`Could not resume Pomodoro timer (may not be a Pomodoro session):`, error);
    }

    // Send DM notification to user
    try {
      const user = await client.users.fetch(userId);
      await user.send('🔔 **Break over!**\n\nYour session has automatically resumed. Keep up the great work!');
      logger.info(`Auto-resume notification sent to user ${userId}`);
    } catch (error) {
      logger.error(`Failed to send auto-resume notification to user ${userId}:`, error);
    }

    logger.info(`Session auto-resumed for user ${userId}`);
  } catch (error) {
    logger.error(`Error auto-resuming session for user ${userId}:`, error);
  }
}

/**
 * Cancel an active break timer (when user manually unpauses)
 */
export function cancelBreakTimer(userId: string): void {
  const breakTimer = activeBreakTimers.get(userId);

  if (breakTimer) {
    clearTimeout(breakTimer);
    activeBreakTimers.delete(userId);
    logger.info(`Break timer cancelled for user ${userId}`);
  }
}

// Export for use by other commands
export { activeBreakTimers };
