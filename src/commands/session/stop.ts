/**
 * /stop Command
 *
 * Stops the active session and shows a modal for session completion details.
 * User provides title, description, and intensity rating.
 */

import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { calculateDuration, formatDuration } from '../../utils/formatters';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StopCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription(
      'Stop your session! Add a title, description of what you did, and post it to the feed'
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;

    // Check if command is used in a server (not DMs)
    if (!guildId) {
      await interaction.reply({
        content:
          '❌ Please use `/stop` in your server to post your session to the feed!',
        ephemeral: true,
      });
      return;
    }

    logger.info(`User ${user.username} (${user.id}) stopping session`);

    try {
      // Initialize session service
      const sessionService = new SessionService(db);

      const session = await sessionService.getActiveSession(user.id);

      if (!session) {
        logger.warn(`User ${user.id} has no active session`);
        await interaction.reply({
          content: 'No active session found! Use /start first.',
          ephemeral: false,
        });
        return;
      }

      // Calculate duration to show in modal
      const duration = calculateDuration(
        session.startTime,
        session.pausedDuration,
        session.isPaused ? session.pausedAt : undefined
      );
      const durationStr = formatDuration(duration);

      logger.info(`Session duration: ${durationStr} for user ${user.id}`);

      // Create modal for session completion
      const modal = new ModalBuilder()
        .setCustomId('endSessionModal')
        .setTitle(`Complete Session (${durationStr})`);

      // Title input
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Session Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Finished chapter 5, Fixed login bug')
        .setRequired(true)
        .setMaxLength(100);

      // Description input
      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('What did you accomplish?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Share what you worked on and what you achieved...')
        .setRequired(true)
        .setMaxLength(1000);

      // Intensity input (1-5 scale)
      const intensityInput = new TextInputBuilder()
        .setCustomId('intensity')
        .setLabel('Session Intensity (1-5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1=Light, 2=Easy, 3=Normal, 4=Hard, 5=Max Effort')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1);

      // Add inputs to action rows
      const titleRow =
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const descriptionRow =
        new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
      const intensityRow =
        new ActionRowBuilder<TextInputBuilder>().addComponents(intensityInput);

      modal.addComponents(titleRow, descriptionRow, intensityRow);

      await interaction.showModal(modal);
      logger.info(`Modal shown to user ${user.id}`);
    } catch (error) {
      logger.error('Error stopping session:', error);
      await interaction.reply({
        content: 'Failed to stop session. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};
