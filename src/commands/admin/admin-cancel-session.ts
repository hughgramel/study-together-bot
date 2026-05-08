/**
 * /admincancelsession Command
 *
 * Admin/Mod command to cancel another user's active session.
 * Cancels the active session, any running timer, and any active Pomodoro session
 * without saving stats or posting to feed.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminCancelSessionCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admincancelsession')
    .setDescription("Admin/Mod: Cancel another user's active session")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose session should be cancelled')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator | PermissionFlagsBits.ModerateMembers
    ),

  async execute(interaction, context) {
    const { db } = context;

    const hasPermission =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);

    if (!hasPermission) {
      await interaction.reply({
        content: '❌ You need Administrator or Moderator permissions to use this command.',
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);

    logger.info(
      `Admin ${interaction.user.username} (${interaction.user.id}) cancelling session for ${targetUser.username} (${targetUser.id})`
    );

    try {
      const sessionService = new SessionService(db);
      const session = await sessionService.getActiveSession(targetUser.id);

      if (!session) {
        await interaction.reply({
          content: `❌ ${targetUser.username} has no active session to cancel.`,
          ephemeral: true,
        });
        return;
      }

      // Cancel Pomodoro session if applicable
      let wasPomodoroSession = false;
      try {
        const { cancelPomodoroSession } = await import('../session/pomodoro');
        wasPomodoroSession = await cancelPomodoroSession(targetUser.id, db);
      } catch (error) {
        logger.warn(`Could not check for Pomodoro session for ${targetUser.id}:`, error);
      }

      // Cancel any active timer
      try {
        const { cancelTimer } = await import('../session/start');
        cancelTimer(targetUser.id);
      } catch (error) {
        logger.warn(`Could not cancel timer for ${targetUser.id}:`, error);
      }

      // If it wasn't a Pomodoro session (which already deletes), delete the active session now
      if (!wasPomodoroSession) {
        await sessionService.deleteActiveSession(targetUser.id);
      }

      logger.info(
        `Session cancelled for user ${targetUser.id} by admin ${interaction.user.id}`
      );

      await interaction.reply({
        content: `❌ Cancelled ${targetUser.username}'s active session. No stats were updated and nothing was posted to the feed.`,
        ephemeral: false,
      });
    } catch (error) {
      logger.error(`Error cancelling session for ${targetUser.id}:`, error);
      await interaction
        .reply({
          content: 'Failed to cancel session. Please try again later.',
          ephemeral: true,
        })
        .catch(() => {
          // Ignore if reply fails
        });
    }
  },
};
