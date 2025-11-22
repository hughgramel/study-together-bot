/**
 * Event Button Handlers
 *
 * Handles button interactions for event join/leave functionality.
 */

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { EventService } from '../../services/events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EventButtons');

/**
 * Handle event join button
 */
export async function handleEventJoinButton(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  const eventId = interaction.customId.split(':')[1];
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  try {
    const eventService = new EventService(db);
    const result = await eventService.joinEvent(eventId, user.id, user.username);

    await interaction.editReply({
      content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    });

    // Update the event embed if successful
    if (result.success && interaction.message) {
      const event = await eventService.getEvent(eventId);
      if (event) {
        const embed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(embed);

        // Build attendees list with @ mentions, marking host
        const attendeesList = event.attendees
          .map((a) =>
            a.userId === event.creatorId ? `<@${a.userId}> (Host)` : `<@${a.userId}>`
          )
          .join(', ');
        const spotsText = event.maxAttendees
          ? `${attendeesList} (${event.attendees.length}/${event.maxAttendees} - ${event.maxAttendees - event.attendees.length} spots left)`
          : attendeesList;

        // Find and update the attendees field
        const fields = newEmbed.data.fields || [];
        const attendeesFieldIndex = fields.findIndex((f) => f.name === '👥 Attendees');
        if (attendeesFieldIndex !== -1) {
          fields[attendeesFieldIndex].value = spotsText;
          newEmbed.setFields(fields);
        }

        await interaction.message.edit({ embeds: [newEmbed] });
      }
    }

    logger.info(`User ${user.username} (${user.id}) joined event ${eventId}`);
  } catch (error) {
    logger.error('Error joining event:', error);
    await interaction.editReply({
      content: '❌ An error occurred while joining the event. Please try again.',
    });
  }
}

/**
 * Handle event leave button
 */
export async function handleEventLeaveButton(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  const eventId = interaction.customId.split(':')[1];
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  try {
    const eventService = new EventService(db);
    const result = await eventService.leaveEvent(eventId, user.id);

    await interaction.editReply({
      content: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
    });

    // Update the event embed if successful
    if (result.success && interaction.message) {
      const event = await eventService.getEvent(eventId);
      if (event) {
        const embed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(embed);

        // Build attendees list with @ mentions, marking host
        const attendeesList = event.attendees
          .map((a) =>
            a.userId === event.creatorId ? `<@${a.userId}> (Host)` : `<@${a.userId}>`
          )
          .join(', ');
        const spotsText = event.maxAttendees
          ? `${attendeesList} (${event.attendees.length}/${event.maxAttendees} - ${event.maxAttendees - event.attendees.length} spots left)`
          : attendeesList;

        // Find and update the attendees field
        const fields = newEmbed.data.fields || [];
        const attendeesFieldIndex = fields.findIndex((f) => f.name === '👥 Attendees');
        if (attendeesFieldIndex !== -1) {
          fields[attendeesFieldIndex].value = spotsText;
          newEmbed.setFields(fields);
        }

        await interaction.message.edit({ embeds: [newEmbed] });
      }
    }

    logger.info(`User ${user.username} (${user.id}) left event ${eventId}`);
  } catch (error) {
    logger.error('Error leaving event:', error);
    await interaction.editReply({
      content: '❌ An error occurred while leaving the event. Please try again.',
    });
  }
}

/**
 * Handle event list join button (info only)
 */
export async function handleEventListJoinButton(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.reply({
    content:
      'Please copy the **Event ID** from the event list above and use this command:\n`/events` then click the Join button on the specific event, or join via the event post in the feed channel.',
    ephemeral: true,
  });
}

/**
 * Handle event list leave button (info only)
 */
export async function handleEventListLeaveButton(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.reply({
    content:
      'Please copy the **Event ID** from the event list above and use this command:\n`/events` then click the Leave button on the specific event.',
    ephemeral: true,
  });
}
