/**
 * /createevent Command
 *
 * Create a new study event with interactive builder.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { getServerConfig } from '../../utils/serverHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CreateEventCommand');

// Event builder state interface
export interface EventBuilderState {
  userId: string;
  title?: string;
  location?: string;
  startTime?: Date;
  duration?: number;
  studyType?: 'silent' | 'conversation' | 'pomodoro' | 'custom';
  customType?: string;
  maxAttendees?: number;
  description?: string;
  timezone?: string;
}

// Export eventBuilders map for use in bot.ts interaction handlers
export const eventBuilders = new Map<string, EventBuilderState>();

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('createevent')
    .setDescription('Create a new study event'),

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
      logger.info(`User ${user.username} (${user.id}) creating event`);

      // Get server config for timezone
      const config = await getServerConfig(db, guildId);
      const timezone = config?.timezone || 'America/Los_Angeles'; // Default to PT if not set

      // Create initial event builder embed
      const builderId = `event_builder:${user.id}:${Date.now()}`;

      // Initialize builder state
      eventBuilders.set(builderId, {
        userId: user.id,
        studyType: 'conversation',
        timezone
      });

      const builderEmbed = new EmbedBuilder()
        .setColor(0x1CB0F6) // Blue
        .setTitle('Create Study Event')
        .setDescription('Use the buttons and dropdown below to configure your event.')
        .addFields(
          { name: 'Title', value: '*Not set*', inline: false },
          { name: 'Location', value: '*Not set*', inline: false },
          { name: 'Start Time', value: '*Not set*', inline: true },
          { name: 'Duration', value: 'No limit', inline: true },
          { name: 'Study Type', value: 'Conversation Allowed', inline: false },
          { name: 'Max Attendees', value: 'Unlimited', inline: true },
          { name: 'More Info', value: '*None*', inline: false }
        )
        .setFooter({ text: 'Configure all required fields (*) then click Create Event' });

      // Study type dropdown
      const studyTypeSelect = new StringSelectMenuBuilder()
        .setCustomId(`${builderId}:study_type`)
        .setPlaceholder('Select study type')
        .addOptions([
          {
            label: 'Silent Study',
            description: 'Quiet, focused work session',
            value: 'silent',
          },
          {
            label: 'Conversation Allowed',
            description: 'Talking and discussion permitted',
            value: 'conversation',
          },
          {
            label: 'Pomodoro Session',
            description: 'Structured breaks (25min work, 5min break)',
            value: 'pomodoro',
          },
          {
            label: 'Custom',
            description: 'Define your own study style',
            value: 'custom',
          }
        ]);

      // Action buttons
      const setTitleBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_title`)
        .setLabel('Set Title')
        .setStyle(ButtonStyle.Secondary);

      const setLocationBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_location`)
        .setLabel('Set Location')
        .setStyle(ButtonStyle.Secondary);

      const setTimeBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_time`)
        .setLabel('Set Time')
        .setStyle(ButtonStyle.Secondary);

      const setDurationBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_duration`)
        .setLabel('Set Duration')
        .setStyle(ButtonStyle.Secondary);

      const setMaxBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_max`)
        .setLabel('Set Max')
        .setStyle(ButtonStyle.Secondary);

      const setDescBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:set_description`)
        .setLabel('Set Description')
        .setStyle(ButtonStyle.Secondary);

      const createBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:create`)
        .setLabel('Create Event')
        .setStyle(ButtonStyle.Success);

      const cancelBtn = new ButtonBuilder()
        .setCustomId(`${builderId}:cancel`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(studyTypeSelect);
      const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(setTitleBtn, setLocationBtn, setTimeBtn, setDurationBtn);
      const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(setMaxBtn, setDescBtn);
      const buttonRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, cancelBtn);

      await interaction.editReply({
        embeds: [builderEmbed],
        components: [selectRow, buttonRow1, buttonRow2, buttonRow3]
      });

      logger.info(`Event builder displayed to user ${user.id}`);
    } catch (error) {
      logger.error('Error creating event builder', error);
      await interaction.editReply({
        content: 'An error occurred while creating the event builder. Please try again.',
      });
    }
  },
};
