/**
 * /myevents Command
 *
 * View events you have RSVP'd to.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { EventService } from '../../services/events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('MyEventsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('myevents')
    .setDescription('View events you have RSVP\'d to'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`User ${user.username} (${user.id}) viewing their events`);

      const eventService = new EventService(db);
      const events = await eventService.getUserEvents(user.id, guildId);

      if (events.length === 0) {
        await interaction.editReply({
          content: 'You haven\'t RSVP\'d to any events yet! Use `/events` to see upcoming events.',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD900) // Yellow
        .setTitle('Your Events')
        .setDescription(`You're attending ${events.length} event${events.length === 1 ? '' : 's'}`)
        .setTimestamp();

      // Add each event as a field
      for (const event of events) {
        const startTime = event.startTime.toDate();
        const discordTimestamp = `<t:${Math.floor(startTime.getTime() / 1000)}:F>`;
        const relativeTime = `<t:${Math.floor(startTime.getTime() / 1000)}:R>`;

        const isCreator = event.creatorId === user.id;

        embed.addFields({
          name: `${isCreator ? ' ' : ''}${event.title}`,
          value: [
            `**Location:** ${event.location}`,
            `**When:** ${discordTimestamp} (${relativeTime})`,
            `**Duration:** ${event.duration} minutes`,
            isCreator ? 'You created this event' : '',
            `**Event ID:** \`${event.eventId}\``
          ].filter(Boolean).join('\n'),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      logger.info(`User events displayed for ${user.id} (${events.length} events)`);
    } catch (error) {
      logger.error('Error fetching user events', error);
      await interaction.editReply({
        content: 'An error occurred while fetching your events. Please try again.',
      });
    }
  },
};
