/**
 * Session Edit Button Handlers
 *
 * Handles edit button interactions for completed session feed posts.
 * Only allows the post creator to edit their own sessions.
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
import { createLogger } from '../../utils/logger';

const logger = createLogger('SessionEditButtons');

/**
 * Handle session edit button click
 */
export async function handleSessionEditButton(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  try {
    const user = interaction.user;

    // Parse button custom ID: edit_session_{sessionId}_{userId}
    const parts = interaction.customId.split('_');
    const sessionId = parts[2];
    const originalUserId = parts[3];

    // Authorization check - only post creator can edit
    if (user.id !== originalUserId) {
      await interaction.reply({
        content: '❌ You can only edit your own sessions.',
        ephemeral: true,
      });
      return;
    }

    // Get the session from database
    const sessionService = new SessionService(db);
    const session = await sessionService.getCompletedSession(sessionId);

    if (!session) {
      await interaction.reply({
        content: '❌ Session not found. It may have been deleted.',
        ephemeral: true,
      });
      return;
    }

    logger.info(`User ${user.id} editing session ${sessionId}`);

    // Convert duration from seconds to hours for display
    const durationHours = (session.duration / 3600).toFixed(2);

    // Create modal for session editing
    const modal = new ModalBuilder()
      .setCustomId(`editSessionModal_${sessionId}`)
      .setTitle('Edit Session');

    // Activity input (pre-filled)
    const activityInput = new TextInputBuilder()
      .setCustomId('activity')
      .setLabel('What were you working on?')
      .setStyle(TextInputStyle.Short)
      .setValue(session.activity)
      .setRequired(true)
      .setMaxLength(100);

    // Title input (pre-filled)
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Session Title')
      .setStyle(TextInputStyle.Short)
      .setValue(session.title)
      .setRequired(true)
      .setMaxLength(100);

    // Description input (pre-filled)
    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('What did you accomplish?')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(session.description)
      .setRequired(true)
      .setMaxLength(1000);

    // Duration input (pre-filled in hours)
    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Duration (in hours)')
      .setStyle(TextInputStyle.Short)
      .setValue(durationHours)
      .setPlaceholder('e.g., 1.5, 2, 0.5')
      .setRequired(true);

    // Intensity input (pre-filled)
    const intensityInput = new TextInputBuilder()
      .setCustomId('intensity')
      .setLabel('Session Intensity (1-5)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(session.intensity || 3))
      .setPlaceholder('1=Light, 2=Easy, 3=Normal, 4=Hard, 5=Max Effort')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(1);

    // Note: Discord modals are limited to 5 text inputs maximum
    // We'll use 5 fields: activity, title, description, duration, intensity
    const activityRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(activityInput);
    const titleRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    const descriptionRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
    const durationRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
    const intensityRow =
      new ActionRowBuilder<TextInputBuilder>().addComponents(intensityInput);

    modal.addComponents(activityRow, titleRow, descriptionRow, durationRow, intensityRow);

    await interaction.showModal(modal);
    logger.info(`Edit modal shown to user ${user.id} for session ${sessionId}`);
  } catch (error) {
    logger.error('Error handling session edit button:', error);
    await interaction.reply({
      content: '❌ Failed to show edit form. Please try again.',
      ephemeral: true,
    }).catch(() => {
      // Ignore if reply fails
    });
  }
}
