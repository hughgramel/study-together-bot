/**
 * Event Builder Button Handlers
 *
 * Handles button interactions for the event creation wizard.
 */

import {
  ButtonInteraction,
  Client,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { eventBuilders } from '../../commands/events/createevent';
import { EventService } from '../../services/events';
import { getServerConfig } from '../../utils/serverHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EventBuilderButtons');

/**
 * Handle event builder button interactions
 */
export async function handleEventBuilderButtons(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const user = interaction.user;
  const parts = interaction.customId.split(':');
  const builderId = `${parts[0]}:${parts[1]}:${parts[2]}`;
  const action = parts[3];

  const builderState = eventBuilders.get(builderId);

  if (!builderState || builderState.userId !== user.id) {
    await interaction.reply({
      content: '❌ This event builder has expired or does not belong to you.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Cancel button
  if (action === 'cancel') {
    eventBuilders.delete(builderId);
    await interaction.update({
      content: '❌ Event creation cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Create button
  if (action === 'create') {
    // Validate required fields
    if (!builderState.title || !builderState.location || !builderState.startTime) {
      await interaction.reply({
        content: '❌ Please fill in all required fields (Title, Location, Time).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      const guildId = interaction.guildId!;
      const eventService = new EventService(db);

      // Create the event
      const event = await eventService.createEvent(
        guildId,
        user.id,
        user.username,
        builderState.title,
        builderState.location,
        builderState.startTime,
        builderState.duration,
        builderState.studyType || 'conversation',
        {
          description: builderState.description,
          maxAttendees: builderState.maxAttendees,
          customType: builderState.customType,
        }
      );

      // Post event to events channel
      const config = await getServerConfig(db, guildId);
      if (config && config.eventsChannelId) {
        try {
          const eventsChannel = (await client.channels.fetch(
            config.eventsChannelId
          )) as TextChannel;

          const studyTypeEmoji: Record<string, string> = {
            silent: '🤫',
            conversation: '💬',
            pomodoro: '🍅',
            custom: '✨',
          };

          const studyTypeNames: Record<string, string> = {
            silent: 'Silent Study',
            conversation: 'Conversation Allowed',
            pomodoro: 'Pomodoro Session',
            custom: builderState.customType || 'Custom',
          };

          const studyType = builderState.studyType || 'conversation';

          const eventEmbed = new EmbedBuilder()
            .setColor(0x1cb0f6) // Blue
            .setAuthor({
              name: user.username,
              iconURL: user.displayAvatarURL({ size: 128 }),
            })
            .setTitle(`${studyTypeEmoji[studyType]} ${builderState.title}`);

          // Add fields
          const fields = [
            { name: '📍 Location', value: builderState.location, inline: false },
            {
              name: '⏰ Start Time',
              value: `<t:${Math.floor(builderState.startTime.getTime() / 1000)}:F>\n<t:${Math.floor(builderState.startTime.getTime() / 1000)}:R>`,
              inline: true,
            },
            {
              name: '⏱️ Duration',
              value: builderState.duration ? `${builderState.duration} minutes` : 'No limit',
              inline: true,
            },
            { name: '🎯 Type', value: studyTypeNames[studyType], inline: true },
            {
              name: '👥 Attendees',
              value: builderState.maxAttendees
                ? `<@${user.id}> (Host) (1/${builderState.maxAttendees} - ${builderState.maxAttendees - 1} spots left)`
                : `<@${user.id}> (Host)`,
              inline: false,
            },
          ];

          // Only add More Info if there's a description
          if (builderState.description) {
            fields.push({ name: '📝 More Info', value: builderState.description, inline: false });
          }

          fields.push({ name: '📞 Contact', value: `DM <@${user.id}> for more info!`, inline: false });

          eventEmbed
            .addFields(fields)
            .setFooter({ text: `Event ID: ${event.eventId}` })
            .setTimestamp();

          const joinButton = new ButtonBuilder()
            .setCustomId(`event_join:${event.eventId}`)
            .setLabel('Join Event')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

          const leaveButton = new ButtonBuilder()
            .setCustomId(`event_leave:${event.eventId}`)
            .setLabel('Leave Event')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

          const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            joinButton,
            leaveButton
          );

          const message = await eventsChannel.send({
            embeds: [eventEmbed],
            components: [buttonRow],
          });

          await eventService.updateEventMessage(event.eventId, message.id, eventsChannel.id);
        } catch (error) {
          logger.error('Error posting event to events channel:', error);
        }
      }

      // Clean up builder state
      eventBuilders.delete(builderId);

      await interaction.editReply({
        content: `✅ Event created successfully!\n\n**${builderState.title}**\n📍 ${builderState.location}\n⏰ <t:${Math.floor(builderState.startTime.getTime() / 1000)}:F>`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      logger.error('Error creating event:', error);
      await interaction.followUp({
        content: '❌ An error occurred while creating the event. Please try again.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // Set field buttons - show modals
  if (action === 'set_title') {
    const modal = new ModalBuilder()
      .setCustomId(`${builderId}:modal_title`)
      .setTitle('Set Event Title');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Event Title')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Late Night Study Session')
      .setRequired(true)
      .setMaxLength(100);

    if (builderState.title) {
      titleInput.setValue(builderState.title);
    }

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (action === 'set_location') {
    const modal = new ModalBuilder()
      .setCustomId(`${builderId}:modal_location`)
      .setTitle('Set Event Location');

    const locationInput = new TextInputBuilder()
      .setCustomId('location')
      .setLabel('Location')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Library - 3rd floor, table near windows')
      .setRequired(true)
      .setMaxLength(200);

    if (builderState.location) {
      locationInput.setValue(builderState.location);
    }

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(locationInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (action === 'set_time') {
    const modal = new ModalBuilder()
      .setCustomId(`${builderId}:modal_time`)
      .setTitle('Set Event Time');

    const timeInput = new TextInputBuilder()
      .setCustomId('time')
      .setLabel('Start Date & Time')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-01-20 18:00 or tomorrow 6pm')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (action === 'set_duration') {
    const modal = new ModalBuilder()
      .setCustomId(`${builderId}:modal_duration`)
      .setTitle('Set Event Duration');

    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Duration (in minutes)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 120')
      .setRequired(true);

    if (builderState.duration) {
      durationInput.setValue(builderState.duration.toString());
    }

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (action === 'set_max') {
    const modal = new ModalBuilder()
      .setCustomId(`${builderId}:modal_max`)
      .setTitle('Set Max Attendees');

    const maxInput = new TextInputBuilder()
      .setCustomId('max')
      .setLabel('Max Attendees (leave blank for unlimited)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 10')
      .setRequired(false);

    if (builderState.maxAttendees) {
      maxInput.setValue(builderState.maxAttendees.toString());
    }

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(maxInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (action === 'set_description') {
    const modal = new ModalBuilder()
      .setCustomId(`${builderId}:modal_description`)
      .setTitle('Set Event Description');

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Add any additional details about the event...')
      .setRequired(false)
      .setMaxLength(500);

    if (builderState.description) {
      descInput.setValue(builderState.description);
    }

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }
}
