/**
 * /events Command
 *
 * View all upcoming study events.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { EventService } from '../../services/events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EventsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('View all upcoming study events'),

  async execute(interaction, context) {
    const { db } = context;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      logger.info(`User ${interaction.user.username} (${interaction.user.id}) viewing events`);

      const eventService = new EventService(db);
      const events = await eventService.getUpcomingEvents(guildId);

      if (events.length === 0) {
        await interaction.editReply({
          content: 'No upcoming events! Use `/createevent` to create one.',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x1CB0F6) // Blue
        .setTitle('Upcoming Study Events')
        .setDescription(`${events.length} event${events.length === 1 ? '' : 's'} scheduled`)
        .setTimestamp();

      // Add each event as a field
      for (const event of events.slice(0, 10)) {
        const startTime = event.startTime.toDate();
        const discordTimestamp = `<t:${Math.floor(startTime.getTime() / 1000)}:F>`;
        const relativeTime = `<t:${Math.floor(startTime.getTime() / 1000)}:R>`;

        const studyTypeEmoji: Record<string, string> = {
          silent: '',
          conversation: '',
          pomodoro: '',
          custom: ''
        };

        const spotsText = event.maxAttendees
          ? `${event.attendees.length}/${event.maxAttendees} spots filled`
          : `${event.attendees.length} attending`;

        embed.addFields({
          name: `${studyTypeEmoji[event.studyType]} ${event.title}`,
          value: [
            `**Location:** ${event.location}`,
            `**When:** ${discordTimestamp} (${relativeTime})`,
            `**Duration:** ${event.duration} minutes`,
            `**Attendees:** ${spotsText}`,
            `**Type:** ${event.studyType === 'custom' ? event.customType : event.studyType}`,
            event.description ? `${event.description}` : '',
            `**Event ID:** \`${event.eventId}\``
          ].filter(Boolean).join('\n'),
          inline: false
        });
      }

      if (events.length > 10) {
        embed.setFooter({ text: `Showing first 10 of ${events.length} events` });
      }

      // Add buttons for joining/leaving events
      const joinButton = new ButtonBuilder()
        .setCustomId('event_list_join')
        .setLabel('Join Event')
        .setStyle(ButtonStyle.Success);

      const leaveButton = new ButtonBuilder()
        .setCustomId('event_list_leave')
        .setLabel('Leave Event')
        .setStyle(ButtonStyle.Danger);

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton);

      await interaction.editReply({ embeds: [embed], components: [buttonRow] });

      logger.info(`Events list displayed (${events.length} events)`);
    } catch (error) {
      logger.error('Error fetching events', error);
      await interaction.editReply({
        content: 'An error occurred while fetching events. Please try again.',
      });
    }
  },
};
