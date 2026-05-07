/**
 * /live Command
 *
 * See who is currently studying in the server.
 * Displays all active sessions with user avatars, activities, and durations.
 */

import {
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { liveNotificationImageService } from '../../services/liveNotificationImage';
import { formatDuration, calculateDuration } from '../../utils/formatters';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LiveCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('live')
    .setDescription('See who is currently studying in this server'),

  async execute(interaction, context) {
    const { db, client } = context;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    logger.info(`Displaying live sessions for guild ${guildId}`);

    // Initialize services
    const sessionService = new SessionService(db);

    // Get active sessions for this server
    const BANNED_USERNAMES = ['punkquant'];
    const allSessions = await sessionService.getActiveSessionsByServer(guildId);
    const activeSessions = allSessions.filter(
      (s) => !BANNED_USERNAMES.includes(s.username.toLowerCase())
    );
    const totalLive = activeSessions.length;

    if (totalLive === 0) {
      await interaction.editReply({
        content: 'Nobody is studying right now. Be the first! Use /start to begin.',
      });
      return;
    }

    try {
      // Build user list with avatars and durations
      const usersWithDurations = await Promise.all(
        activeSessions.map(async (session) => {
          const elapsed = calculateDuration(
            session.startTime,
            session.pausedDuration,
            session.isPaused ? session.pausedAt : undefined
          );
          const elapsedStr = formatDuration(elapsed);

          try {
            const discordUser = await client.users.fetch(session.userId);
            const avatarUrl = discordUser.displayAvatarURL({ size: 128 });

            return {
              username: session.username,
              avatarUrl,
              activity: session.activity || 'Studying', // Default if no activity
              duration: elapsedStr,
              isPaused: session.isPaused,
              durationMinutes: elapsed, // Keep raw minutes for sorting
            };
          } catch (error) {
            logger.error(`Error fetching user ${session.userId}`, error);
            // Fallback with default avatar
            return {
              username: session.username,
              avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
              activity: session.activity || 'Studying', // Default if no activity
              duration: elapsedStr,
              isPaused: session.isPaused,
              durationMinutes: elapsed,
            };
          }
        })
      );

      // Sort by duration (longest first)
      usersWithDurations.sort((a, b) => b.durationMinutes - a.durationMinutes);

      // Limit to 10 users max for display
      const displayUsers = usersWithDurations.slice(0, 10);

      // Remove durationMinutes property before passing to image service
      const users = displayUsers.map(({ durationMinutes, ...user }) => user);

      // Generate the live notification image
      const imageBuffer = await liveNotificationImageService.generateLiveNotificationImage(
        users,
        totalLive
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: 'live-sessions.png',
        description: `${totalLive} ${totalLive === 1 ? 'person is' : 'people are'} studying`,
      });

      await interaction.editReply({
        files: [attachment],
      });

      logger.info(`Live sessions displayed for guild ${guildId} (${totalLive} active)`);
    } catch (error) {
      logger.error('Error generating live notification image', error);
      await interaction.editReply({
        content: 'Failed to generate live sessions image.',
      });
    }
  },
};
