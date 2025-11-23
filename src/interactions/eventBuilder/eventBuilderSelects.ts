/**
 * Event Builder Select Menu Handlers
 *
 * Handles select menu interactions for the event creation wizard.
 */

import {
  StringSelectMenuInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { eventBuilders, EventBuilderState } from '../../commands/events/createevent';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EventBuilderSelects');

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
 * Handle event builder study type selection
 */
export async function handleEventBuilderStudyTypeSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const parts = interaction.customId.split(':');
  const builderId = `${parts[0]}:${parts[1]}:${parts[2]}`;
  const selectedType = interaction.values[0] as 'silent' | 'conversation' | 'pomodoro' | 'custom';

  const builderState = eventBuilders.get(builderId);

  if (!builderState || builderState.userId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ This event builder has expired or does not belong to you.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // If custom type, show a modal to get custom description
  if (selectedType === 'custom') {
    const modal = new ModalBuilder()
      .setCustomId(`${builderId}:modal_custom_type`)
      .setTitle('Custom Study Type');

    const customTypeInput = new TextInputBuilder()
      .setCustomId('custom_type')
      .setLabel('Describe your study type')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Group Project Work, Code Review Session')
      .setRequired(true)
      .setMaxLength(100);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(customTypeInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    // Store that we selected custom (will be updated when modal submitted)
    builderState.studyType = 'custom';
    return;
  }

  // Update state
  builderState.studyType = selectedType;
  builderState.customType = undefined; // Clear custom type if switching away from custom

  await interaction.deferUpdate();

  try {
    const updatedEmbed = updateBuilderEmbed(builderState);

    // Recreate components
    const components = createBuilderComponents(builderId);

    await interaction.editReply({
      embeds: [updatedEmbed],
      components: components,
    });

    logger.info(`User ${interaction.user.username} selected study type: ${selectedType}`);
  } catch (error) {
    logger.error('Error updating event builder study type:', error);
    await interaction.followUp({
      content: '❌ An error occurred. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
