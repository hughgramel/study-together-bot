/**
 * Event Builder Modal Handlers
 *
 * Handles modal submissions for the event creation wizard.
 */

import {
  ModalSubmitInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { eventBuilders, EventBuilderState } from '../../commands/events/createevent';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EventBuilderModals');

/**
 * Update helper function to regenerate the event builder embed
 */
function updateBuilderEmbed(state: EventBuilderState): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x1cb0f6) // Blue
    .setTitle('📅 Create Study Event')
    .setDescription('Use the buttons and dropdown below to configure your event.')
    .addFields(
      { name: '📝 Title', value: state.title || '*Not set*', inline: false },
      { name: '📍 Location', value: state.location || '*Not set*', inline: false },
      {
        name: '⏰ Start Time',
        value: state.startTime
          ? `<t:${Math.floor(state.startTime.getTime() / 1000)}:F>`
          : '*Not set*',
        inline: true,
      },
      {
        name: '⏱️ Duration',
        value: state.duration ? `${state.duration} minutes` : 'No limit',
        inline: true,
      },
      {
        name: '🎯 Study Type',
        value: state.studyType
          ? state.studyType === 'custom' && state.customType
            ? `Custom: ${state.customType}`
            : state.studyType === 'silent'
              ? 'Silent Study'
              : state.studyType === 'conversation'
                ? 'Conversation Allowed'
                : state.studyType === 'pomodoro'
                  ? 'Pomodoro Session'
                  : state.studyType
          : '*Not set*',
        inline: false,
      },
      {
        name: '👥 Max Attendees',
        value: state.maxAttendees ? state.maxAttendees.toString() : 'Unlimited',
        inline: true,
      },
      { name: '📝 More Info', value: state.description || '*None*', inline: false }
    )
    .setFooter({ text: 'Configure all required fields (*) then click Create Event' });

  return embed;
}

/**
 * Parse date/time string with timezone awareness
 */
function parseDateTime(input: string, timezone: string): Date | null {
  const trimmed = input.trim().toLowerCase();

  // Get current time in user's timezone
  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  const year = nowInTz.getFullYear();
  const month = nowInTz.getMonth();
  const day = nowInTz.getDate();

  // Helper to convert local time to UTC Date object
  const createDateInTimezone = (
    yr: number,
    mo: number,
    dy: number,
    hr: number,
    min: number
  ): Date => {
    // Create a date string in the target timezone
    const dateStr = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}T${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    // Parse as if it's in the target timezone
    const localDate = new Date(dateStr);
    const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
    const offset = utcDate.getTime() - tzDate.getTime();
    return new Date(localDate.getTime() + offset);
  };

  // Try ISO format first (YYYY-MM-DD HH:MM)
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if (isoMatch) {
    const [, yr, mo, dy, hr, min] = isoMatch;
    return createDateInTimezone(
      parseInt(yr),
      parseInt(mo) - 1,
      parseInt(dy),
      parseInt(hr),
      parseInt(min)
    );
  }

  // Try "tomorrow HH:MM" or "tomorrow H pm/am"
  if (trimmed.includes('tomorrow')) {
    const timeMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      const [, hourStr, minuteStr, meridiem] = timeMatch;
      let hour = parseInt(hourStr);
      const minute = minuteStr ? parseInt(minuteStr) : 0;

      if (meridiem === 'pm' && hour !== 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;

      const tomorrow = new Date(nowInTz);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return createDateInTimezone(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
        hour,
        minute
      );
    }
  }

  // Try "today HH:MM" or "today H pm/am"
  if (trimmed.includes('today')) {
    const timeMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      const [, hourStr, minuteStr, meridiem] = timeMatch;
      let hour = parseInt(hourStr);
      const minute = minuteStr ? parseInt(minuteStr) : 0;

      if (meridiem === 'pm' && hour !== 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;

      return createDateInTimezone(year, month, day, hour, minute);
    }
  }

  return null;
}

/**
 * Recreate builder components
 */
function createBuilderComponents(builderId: string) {
  const studyTypeSelect = new StringSelectMenuBuilder()
    .setCustomId(`${builderId}:study_type`)
    .setPlaceholder('Select study type')
    .addOptions([
      {
        label: 'Silent Study',
        description: 'Quiet, focused work session',
        value: 'silent',
        emoji: '🤫',
      },
      {
        label: 'Conversation Allowed',
        description: 'Talking and discussion permitted',
        value: 'conversation',
        emoji: '💬',
      },
      {
        label: 'Pomodoro Session',
        description: 'Structured breaks (25min work, 5min break)',
        value: 'pomodoro',
        emoji: '🍅',
      },
      {
        label: 'Custom',
        description: 'Define your own study style',
        value: 'custom',
        emoji: '✨',
      },
    ]);

  const setTitleBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:set_title`)
    .setLabel('Set Title')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('📝');
  const setLocationBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:set_location`)
    .setLabel('Set Location')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('📍');
  const setTimeBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:set_time`)
    .setLabel('Set Time')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏰');
  const setDurationBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:set_duration`)
    .setLabel('Set Duration')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏱️');
  const setMaxBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:set_max`)
    .setLabel('Set Max')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('👥');
  const setDescBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:set_description`)
    .setLabel('Set Description')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('📄');
  const createBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:create`)
    .setLabel('Create Event')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');
  const cancelBtn = new ButtonBuilder()
    .setCustomId(`${builderId}:cancel`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    studyTypeSelect
  );
  const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    setTitleBtn,
    setLocationBtn,
    setTimeBtn,
    setDurationBtn
  );
  const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(setMaxBtn, setDescBtn);
  const buttonRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, cancelBtn);

  return [selectRow, buttonRow1, buttonRow2, buttonRow3];
}

/**
 * Handle event builder modal submissions
 */
export async function handleEventBuilderModals(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const parts = interaction.customId.split(':');
  const builderId = `${parts[0]}:${parts[1]}:${parts[2]}`;
  const modalType = parts[3].replace('modal_', '');

  const builderState = eventBuilders.get(builderId);

  if (!builderState || builderState.userId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ This event builder has expired or does not belong to you.',
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.deferUpdate();

    // Process different modal types
    if (modalType === 'title') {
      builderState.title = interaction.fields.getTextInputValue('title');
    } else if (modalType === 'location') {
      builderState.location = interaction.fields.getTextInputValue('location');
    } else if (modalType === 'time') {
      const dateTimeStr = interaction.fields.getTextInputValue('time');

      const timezone = builderState.timezone || 'America/Los_Angeles';
      const startTime = parseDateTime(dateTimeStr, timezone);
      if (!startTime) {
        await interaction.followUp({
          content:
            '❌ Invalid date/time format. Please use formats like:\n- `2025-01-20 18:00`\n- `tomorrow 6pm`\n- `today 14:30`',
          ephemeral: true,
        });
        return;
      }

      // Allow past events - no validation check
      builderState.startTime = startTime;
    } else if (modalType === 'duration') {
      const durationStr = interaction.fields.getTextInputValue('duration');
      const duration = parseInt(durationStr, 10);

      if (isNaN(duration) || duration <= 0) {
        await interaction.followUp({
          content: '❌ Invalid duration. Please enter a positive number (in minutes).',
          ephemeral: true,
        });
        return;
      }

      builderState.duration = duration;
    } else if (modalType === 'max') {
      const maxStr = interaction.fields.getTextInputValue('max').trim();

      if (maxStr) {
        const max = parseInt(maxStr, 10);
        if (isNaN(max) || max <= 0) {
          await interaction.followUp({
            content:
              '❌ Invalid max attendees. Please enter a positive number or leave blank for unlimited.',
            ephemeral: true,
          });
          return;
        }
        builderState.maxAttendees = max;
      } else {
        builderState.maxAttendees = undefined;
      }
    } else if (modalType === 'description') {
      const desc = interaction.fields.getTextInputValue('description').trim();
      builderState.description = desc || undefined;
    } else if (modalType === 'custom_type') {
      const customType = interaction.fields.getTextInputValue('custom_type').trim();
      builderState.customType = customType;
      builderState.studyType = 'custom';
    }

    // Update the builder embed
    const updatedEmbed = updateBuilderEmbed(builderState);

    // Recreate components
    const components = createBuilderComponents(builderId);

    await interaction.editReply({
      embeds: [updatedEmbed],
      components: components,
    });
  } catch (error) {
    logger.error('Error updating event builder:', error);
    await interaction.followUp({
      content: '❌ An error occurred. Please try again.',
      ephemeral: true,
    });
  }
}
