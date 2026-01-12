/**
 * /manual Command
 *
 * Opens a modal for logging a manual session with custom duration.
 */

import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ManualCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('manual')
    .setDescription('Log a manual session with custom duration'),

  async execute(interaction) {
    logger.info(`User ${interaction.user.username} (${interaction.user.id}) opened manual session modal`);

    try {
      // Create modal for manual session logging
      const modal = new ModalBuilder()
        .setCustomId('manualSessionModal')
        .setTitle('Log Manual Session');

      // Duration input (combined hours and minutes) - REQUIRED
      const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Duration (format: "2h 30m" or "90m")')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 1h 30m, 2h, 45m')
        .setRequired(true)
        .setMaxLength(20);

      // Activity input - optional, defaults to "Studying"
      const activityInput = new TextInputBuilder()
        .setCustomId('activity')
        .setLabel('Activity (optional, default: Studying)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Studying math, Writing essay')
        .setRequired(false)
        .setMaxLength(100);

      // Title input - optional
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Session Title (optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Finished chapter 5, Fixed login bug')
        .setRequired(false)
        .setMaxLength(100);

      // Description input - optional
      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('What did you accomplish? (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Share what you worked on and what you achieved...')
        .setRequired(false)
        .setMaxLength(1000);

      // Intensity input (1-5 scale) - optional, defaults to 3
      const intensityInput = new TextInputBuilder()
        .setCustomId('intensity')
        .setLabel('Session Intensity 1-5 (optional, default: 3)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1=Light, 2=Easy, 3=Normal, 4=Hard, 5=Max Effort')
        .setRequired(false)
        .setMaxLength(1);

      // Add inputs to action rows (duration first since it's required)
      const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
      const activityRow = new ActionRowBuilder<TextInputBuilder>().addComponents(activityInput);
      const titleRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const descriptionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
      const intensityRow = new ActionRowBuilder<TextInputBuilder>().addComponents(intensityInput);

      modal.addComponents(durationRow, activityRow, titleRow, descriptionRow, intensityRow);

      await interaction.showModal(modal);

      logger.info(`Manual session modal displayed to user ${interaction.user.id}`);
    } catch (error) {
      logger.error('Error displaying manual session modal:', error);
      await interaction.reply({
        content: 'Failed to open manual session form. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};
