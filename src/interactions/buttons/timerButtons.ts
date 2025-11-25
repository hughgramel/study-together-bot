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

    // Cancel the auto-post timeout if it exists
    const autoPostTimeouts = (global as any).autoPostTimeouts;
    if (autoPostTimeouts && autoPostTimeouts.has(userId)) {
      const timeout = autoPostTimeouts.get(userId);
      clearTimeout(timeout);
      autoPostTimeouts.delete(userId);
      logger.info(`Cancelled auto-post for user ${userId}`);
    }

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

    // Title input
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Session Title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Finished chapter 5, Fixed login bug')
      .setRequired(true)
      .setMaxLength(100);

    // Description input
    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('What did you accomplish?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Share what you worked on and what you achieved...')
      .setRequired(true)
      .setMaxLength(1000);

    // Intensity input (1-5 scale)
    const intensityInput = new TextInputBuilder()
      .setCustomId('intensity')
      .setLabel('Session Intensity (1-5)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1=Light, 2=Easy, 3=Normal, 4=Hard, 5=Max Effort')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(1);

    // Add inputs to action rows
    const titleRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    const descriptionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const intensityRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(intensityInput);

    modal.addComponents(titleRow, descriptionRow, intensityRow);

    await interaction.showModal(modal);
    logger.info(`Timer edit modal shown to user ${userId}`);

    // Update the original message to indicate user is editing
    try {
      await interaction.message.edit({
        content: `✏️ **Editing Session Details...**\n\nPlease complete the form to finalize your session.`,
        components: [], // Remove the edit button
      });
    } catch (error) {
      logger.error('Failed to update original message:', error);
    }
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
