/**
 * Timer Button Handlers
 *
 * Handles button interactions for timer sessions (edit button).
 */

import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { SessionService } from '../../services/sessions';
import { calculateDuration, formatDuration } from '../../utils/formatters';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TimerButtons');

/**
 * Handle timer edit button click
 */
export async function handleTimerEditButton(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  try {
    const userId = interaction.user.id;

    // Get the active session
    const sessionService = new SessionService(db);
    const session = await sessionService.getActiveSession(userId);

    if (!session) {
      await interaction.reply({
        content: 'No active session found! It may have already been completed.',
        ephemeral: true,
      });
      return;
    }

    // Calculate duration to show in modal
    const duration = calculateDuration(
      session.startTime,
      session.pausedDuration,
      session.isPaused ? session.pausedAt : undefined
    );
    const durationStr = formatDuration(duration);

    logger.info(`Session duration: ${durationStr} for user ${userId}`);

    // Create modal for session completion (same as /stop command)
    const modal = new ModalBuilder()
      .setCustomId('timerEndSessionModal')
      .setTitle(`Complete Session (${durationStr})`);

    // Activity input (optional, defaults to "Studying")
    const activityInput = new TextInputBuilder()
      .setCustomId('activity')
      .setLabel('What were you working on? (default: Studying)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Math homework, Reading, Coding project')
      .setRequired(false)
      .setMaxLength(100);

    // Title input (optional)
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Session Title (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Finished chapter 5, Fixed login bug')
      .setRequired(false)
      .setMaxLength(100);

    // Description input (optional)
    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('What did you accomplish? (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Share what you worked on and what you achieved...')
      .setRequired(false)
      .setMaxLength(1000);

    // Intensity input (optional, defaults to 3)
    const intensityInput = new TextInputBuilder()
      .setCustomId('intensity')
      .setLabel('Session Intensity 1-5 (default: 3)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1=Light, 2=Easy, 3=Normal, 4=Hard, 5=Max Effort')
      .setRequired(false)
      .setMaxLength(1);

    // Add inputs to action rows
    const activityRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(activityInput);
    const titleRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    const descriptionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const intensityRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(intensityInput);

    modal.addComponents(activityRow, titleRow, descriptionRow, intensityRow);

    await interaction.showModal(modal);
    logger.info(`Timer edit modal shown to user ${userId}`);

    // Don't update the message - keep the button available for multiple clicks
    // The auto-post will still happen after 10 seconds regardless
  } catch (error) {
    logger.error('Error handling timer edit button:', error);
    await interaction.reply({
      content: 'Failed to show edit form. Please try again.',
      ephemeral: true,
    }).catch(() => {
      // Ignore if reply fails
    });
  }
}
