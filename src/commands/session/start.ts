/**
 * /start Command
 *
 * Starts a new productivity session for the user.
 * Supports both open-ended sessions and timed sessions.
 * Activity is no longer required - it will be filled in at /stop.
 *
 * Usage:
 * /start                     - Start open-ended session
 * /start hours:2             - Start 2-hour timed session
 * /start minutes:30          - Start 30-minute timed session
 * /start hours:1 minutes:30  - Start 1-hour 30-minute timed session
 * /start hours:1.5           - Start 1.5-hour timed session
 * /start seconds:30          - Start 30-second timed session (testing only)
 */

import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { postSessionStartToFeed, postTimedSessionStartToFeed } from '../../utils/serverHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StartCommand');

// Store active timers: userId -> timeout ID
const activeTimers = new Map<string, NodeJS.Timeout>();

// Store timer metadata: userId -> { duration, startTime, guildId, remainingSeconds, lastPauseTime }
const timerMetadata = new Map<string, {
  duration: number;
  startTime: Date;
  guildId: string;
  remainingSeconds: number; // Time remaining when paused
  lastPauseTime?: Date; // When the timer was last paused
}>();

/**
 * Format duration in seconds to readable text (always singular form)
 */
function formatDurationText(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}-second`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}-minute`;
  } else {
    const totalHours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);

    if (remainingMinutes > 0) {
      // Combined format: "1-hour 30-minute" or "2-hour 15-minute"
      return `${totalHours}-hour ${remainingMinutes}-minute`;
    } else {
      // Just hours: "1-hour", "2-hour", etc.
      return `${totalHours}-hour`;
    }
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start a productivity session (open-ended or timed)')
    .addNumberOption((option) =>
      option
        .setName('hours')
        .setDescription('Duration in hours (optional - for timed sessions)')
        .setRequired(false)
        .setMinValue(0.1)
        .setMaxValue(24)
    )
    .addNumberOption((option) =>
      option
        .setName('minutes')
        .setDescription('Additional minutes (can combine with hours)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(59)
    )
    .addNumberOption((option) =>
      option
        .setName('seconds')
        .setDescription('Duration in seconds (testing only)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(3600)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;
    const hours = interaction.options.getNumber('hours');
    const minutes = interaction.options.getNumber('minutes');
    const seconds = interaction.options.getNumber('seconds');

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    // Validate: cannot combine seconds with hours/minutes
    if (seconds !== null && (hours !== null || minutes !== null)) {
      await interaction.reply({
        content: '❌ Cannot combine seconds with hours or minutes. Use seconds for testing only.',
        ephemeral: true,
      });
      return;
    }

    // Calculate duration in seconds if timer was requested
    let durationSeconds: number | null = null;
    let durationText: string | null = null;
    const isTimedSession = hours !== null || minutes !== null || seconds !== null;

    if (seconds !== null) {
      // Seconds only (testing mode)
      durationSeconds = Math.floor(seconds);
      durationText = formatDurationText(durationSeconds);
    } else if (hours !== null || minutes !== null) {
      // Combine hours and minutes
      const totalHours = hours ?? 0;
      const totalMinutes = minutes ?? 0;

      durationSeconds = Math.floor(totalHours * 3600 + totalMinutes * 60);
      durationText = formatDurationText(durationSeconds);
    }

    logger.info(
      `User ${user.username} (${user.id}) starting ${isTimedSession ? `timed session (${durationText})` : 'open-ended session'}`
    );

    try {
      // Initialize session service
      const sessionService = new SessionService(db);

      // Check if user already has an active session
      const existingSession = await sessionService.getActiveSession(user.id);

      if (existingSession) {
        logger.warn(`User ${user.id} already has an active session`);
        await interaction.reply({
          content:
            'You already have an active session! Use `/stop` to complete it first, or `/cancel` to cancel it.',
          ephemeral: true,
        });
        return;
      }

      // Check if user already has an active timer
      if (isTimedSession && activeTimers.has(user.id)) {
        logger.warn(`User ${user.id} already has an active timer`);
        await interaction.reply({
          content: 'You already have an active timer running!',
          ephemeral: true,
        });
        return;
      }

      // Create new session WITHOUT activity
      await sessionService.createActiveSession(
        user.id,
        user.username,
        guildId
        // No activity parameter - user will fill it in at /stop
      );

      logger.info(`Session created successfully for user ${user.id}`);

      // Get user's avatar URL
      const avatarUrl = user.displayAvatarURL({ size: 128 });

      if (isTimedSession && durationSeconds && durationText) {
        // Timed session - post timed session feed
        await interaction.reply({
          content: `⏱️ Timer started for ${durationText}!\n\n🚀 You're live! I'll notify you when the time is up.`,
          ephemeral: true,
        });

        await postTimedSessionStartToFeed(
          db,
          client,
          interaction,
          user.username,
          user.id,
          avatarUrl,
          'Focus Session', // Generic activity name for timed sessions
          durationText
        );

        logger.info(`Timed session posted to feed for user ${user.id}`);

        // Store timer metadata
        timerMetadata.set(user.id, {
          duration: durationSeconds,
          startTime: new Date(),
          guildId,
          remainingSeconds: durationSeconds, // Initially, full duration remains
        });

        // Set timer to notify user when complete
        const timerId = setTimeout(async () => {
          try {
            await handleTimerComplete(user.id, client, db);
          } catch (error) {
            logger.error(`Error handling timer completion for user ${user.id}:`, error);
          } finally {
            // Clean up
            activeTimers.delete(user.id);
            timerMetadata.delete(user.id);
          }
        }, durationSeconds * 1000);

        // Store timer ID so we can cancel it if needed
        activeTimers.set(user.id, timerId);

        logger.info(`Timer scheduled for user ${user.id}`);
      } else {
        // Open-ended session - post standard session start
        await interaction.reply({
          content: `🚀 You're live! Your session is now active.\n\nUse \`/stop\` when you're done to log what you accomplished.`,
          ephemeral: true,
        });

        await postSessionStartToFeed(
          db,
          client,
          interaction,
          user.username,
          user.id,
          avatarUrl,
          '' // No activity shown on feed
        );

        logger.info(`Session start posted to feed for user ${user.id}`);
      }
    } catch (error) {
      logger.error('Error starting session:', error);
      await interaction.reply({
        content: 'Failed to start session. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};

/**
 * Handle timer completion - notify user and offer edit option
 */
async function handleTimerComplete(
  userId: string,
  client: any,
  db: any
): Promise<void> {
  logger.info(`Timer completed for user ${userId}`);

  try {
    // Fetch the user
    const user = await client.users.fetch(userId);

    // Send DM with edit button
    const editButton = new ButtonBuilder()
      .setCustomId(`timer_edit_${userId}`)
      .setLabel('Edit Session Details')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(editButton);

    const message = await user.send({
      content: `⏰ **Timer Complete!**\n\nYour session has ended. You can edit the session details now, or it will automatically post to the feed in 10 minutes.\n\n_Click the button below to customize your session details._`,
      components: [row],
    });

    logger.info(`Timer completion notification sent to user ${userId}`);

    // Set auto-post timeout (10 minutes)
    const autoPostTimeout = setTimeout(async () => {
      try {
        const { autoPostTimerSession } = await import('./timer');
        await autoPostTimerSession(userId, db, client, message);
      } catch (error) {
        logger.error(`Error auto-posting session for user ${userId}:`, error);
      }
    }, 10 * 60 * 1000); // 10 minutes

    // Store the auto-post timeout so we can cancel it if user clicks edit
    (global as any).autoPostTimeouts = (global as any).autoPostTimeouts || new Map();
    (global as any).autoPostTimeouts.set(userId, autoPostTimeout);
  } catch (error) {
    logger.error(`Failed to send timer completion notification to user ${userId}:`, error);
    // If DM fails, we should still try to auto-post the session
    setTimeout(async () => {
      try {
        const { autoPostTimerSession } = await import('./timer');
        await autoPostTimerSession(userId, db, client, null);
      } catch (autoPostError) {
        logger.error(`Error auto-posting session after DM failure for user ${userId}:`, autoPostError);
      }
    }, 10 * 1000);
  }
}

/**
 * Pause a timed session - clears the timer and stores remaining time
 */
export function pauseTimer(userId: string): boolean {
  const timerId = activeTimers.get(userId);
  const metadata = timerMetadata.get(userId);

  if (!timerId || !metadata) {
    return false; // No active timer
  }

  // Clear the current timeout
  clearTimeout(timerId);
  activeTimers.delete(userId);

  // Calculate remaining time
  const now = new Date();
  const elapsed = (now.getTime() - metadata.startTime.getTime()) / 1000;
  const remaining = Math.max(0, metadata.duration - elapsed);

  // Update metadata with remaining time
  metadata.remainingSeconds = remaining;
  metadata.lastPauseTime = now;
  timerMetadata.set(userId, metadata);

  logger.info(`Timer paused for user ${userId}. Remaining: ${remaining}s`);
  return true;
}

/**
 * Resume a paused timed session - reschedules the timer with remaining time
 */
export async function resumeTimer(userId: string, client: any, db: any): Promise<boolean> {
  const metadata = timerMetadata.get(userId);

  if (!metadata || activeTimers.has(userId)) {
    return false; // No paused timer or already running
  }

  if (metadata.remainingSeconds <= 0) {
    // Timer already expired, complete immediately
    await handleTimerComplete(userId, client, db);
    activeTimers.delete(userId);
    timerMetadata.delete(userId);
    return true;
  }

  // Update start time to now (for future pause calculations)
  metadata.startTime = new Date();
  metadata.duration = metadata.remainingSeconds; // Reset duration to remaining time
  delete metadata.lastPauseTime;

  // Reschedule timer with remaining time
  const timerId = setTimeout(async () => {
    try {
      await handleTimerComplete(userId, client, db);
    } catch (error) {
      logger.error(`Error handling timer completion for user ${userId}:`, error);
    } finally {
      activeTimers.delete(userId);
      timerMetadata.delete(userId);
    }
  }, metadata.remainingSeconds * 1000);

  activeTimers.set(userId, timerId);
  timerMetadata.set(userId, metadata);

  logger.info(`Timer resumed for user ${userId}. Remaining: ${metadata.remainingSeconds}s`);
  return true;
}

/**
 * Cancel a timed session timer
 */
export function cancelTimer(userId: string): boolean {
  const timerId = activeTimers.get(userId);

  if (timerId) {
    clearTimeout(timerId);
    activeTimers.delete(userId);
    timerMetadata.delete(userId);
    logger.info(`Timer cancelled for user ${userId}`);
    return true;
  }

  return false;
}

// Export timer management for other modules
export { activeTimers, timerMetadata };
