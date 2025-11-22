/**
 * /cancelevent Command
 *
 * Cancel one of your events.
 */

import { SlashCommandBuilder, EmbedBuilder, TextChannel } from 'discord.js';
import type { Command } from '../types';
import { EventService } from '../../services/events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CancelEventCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cancelevent')
    .setDescription('Cancel one of your events')
    .addStringOption(option =>
      option
        .setName('event')
        .setDescription('The event to cancel')
        .setRequired(true)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const eventId = interaction.options.getString('event', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`User ${user.username} (${user.id}) cancelling event ${eventId}`);

      const eventService = new EventService(db);
      const result = await eventService.cancelEvent(eventId, user.id);

      if (!result.success) {
        await interaction.editReply({
          content: result.message,
        });
        return;
      }

      // Get the event to notify attendees
      const event = await eventService.getEvent(eventId);
      if (event && event.messageId && event.channelId) {
        try {
          const channel = await client.channels.fetch(event.channelId) as TextChannel;
          if (channel) {
            const message = await channel.messages.fetch(event.messageId);
            if (message) {
              // Update the message to show it's cancelled
              const cancelledEmbed = new EmbedBuilder()
                .setColor(0xFF6B6B) // Red (error/cancel)
                .setTitle(`CANCELLED: ${event.title}`)
                .setDescription(`This event has been cancelled by the organizer.`)
                .addFields(
                  { name: 'Location', value: event.location, inline: true },
                  { name: 'Was scheduled for', value: `<t:${Math.floor(event.startTime.toDate().getTime() / 1000)}:F>`, inline: true }
                )
                .setTimestamp();

              await message.edit({ embeds: [cancelledEmbed], components: [] });

              logger.info(`Event message updated to show cancellation for event ${eventId}`);
            }
          }
        } catch (error) {
          logger.error('Error updating event message', error);
        }
      }

      await interaction.editReply({
        content: 'Event cancelled successfully.',
      });

      logger.info(`Event ${eventId} cancelled successfully`);
    } catch (error) {
      logger.error('Error cancelling event', error);
      await interaction.editReply({
        content: 'An error occurred while cancelling the event. Please try again.',
      });
    }
  },
};
