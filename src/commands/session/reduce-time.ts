/**
 * /reduce-time Command
 *
 * User command to reduce their own total time.
 * Allows users to correct their stats if they made a mistake.
 * Deletes the most recent sessions to reduce time.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { SessionService } from '../../services/sessions';
import { formatDuration } from '../../utils/formatters';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ReduceTimeCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reduce-time')
    .setDescription('Reduce your own time by deleting recent sessions (for self-corrections)')
    .addIntegerOption(option =>
      option
        .setName('hours')
        .setDescription('Number of hours to remove')
        .setRequired(true)
        .setMinValue(0)
    )
    .addIntegerOption(option =>
      option
        .setName('minutes')
        .setDescription('Number of minutes to remove')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(59)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const hours = interaction.options.getInteger('hours', true);
    const minutes = interaction.options.getInteger('minutes') || 0;
    const secondsToRemove = (hours * 3600) + (minutes * 60);

    if (secondsToRemove === 0) {
      await interaction.reply({
        content: '❌ You must specify at least some time to remove.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`User ${user.username} reducing ${hours}h ${minutes}m from their profile`);

      const statsService = new StatsService(db);
      const sessionService = new SessionService(db);
      const userStats = await statsService.getUserStats(user.id);

      if (!userStats) {
        await interaction.editReply({
          content: '❌ You have no stats yet. Complete a session first!',
        });
        return;
      }

      const currentDuration = userStats.totalDuration || 0;

      if (currentDuration === 0) {
        await interaction.editReply({
          content: '❌ You have no time to reduce.',
        });
        return;
      }

      // Get all completed sessions for this user (most recent first)
      const sessions = await sessionService.getCompletedSessions(user.id);

      if (sessions.length === 0) {
        await interaction.editReply({
          content: '❌ You have no sessions to delete.',
        });
        return;
      }

      // Delete/reduce sessions from most recent until we've removed enough time
      let timeRemoved = 0;
      const sessionsToDelete: string[] = [];
      let sessionToReduce: { id: string; currentDuration: number; newDuration: number } | null = null;

      for (const session of sessions) {
        if (timeRemoved >= secondsToRemove) {
          break;
        }

        // Get the session ID from the Firestore document
        const sessionSnapshot = await db
          .collection('discord-data')
          .doc('sessions')
          .collection('completed')
          .where('userId', '==', user.id)
          .where('createdAt', '==', session.createdAt)
          .limit(1)
          .get();

        if (!sessionSnapshot.empty) {
          const sessionId = sessionSnapshot.docs[0].id;
          const remainingToRemove = secondsToRemove - timeRemoved;

          if (session.duration <= remainingToRemove) {
            // Delete entire session
            sessionsToDelete.push(sessionId);
            timeRemoved += session.duration;
          } else {
            // Partially reduce this session
            const newSessionDuration = session.duration - remainingToRemove;
            sessionToReduce = {
              id: sessionId,
              currentDuration: session.duration,
              newDuration: newSessionDuration
            };
            timeRemoved += remainingToRemove;
            break; // We're done
          }
        }
      }

      if (sessionsToDelete.length === 0 && !sessionToReduce) {
        await interaction.editReply({
          content: '❌ Could not find sessions to modify.',
        });
        return;
      }

      // Apply changes in a batch
      const batch = db.batch();

      // Delete complete sessions
      for (const sessionId of sessionsToDelete) {
        const sessionRef = db
          .collection('discord-data')
          .doc('sessions')
          .collection('completed')
          .doc(sessionId);
        batch.delete(sessionRef);
      }

      // Reduce partial session if applicable
      if (sessionToReduce) {
        const sessionRef = db
          .collection('discord-data')
          .doc('sessions')
          .collection('completed')
          .doc(sessionToReduce.id);
        batch.update(sessionRef, { duration: sessionToReduce.newDuration });
      }

      await batch.commit();

      // Update the user's total duration
      const newDuration = Math.max(0, currentDuration - timeRemoved);
      const statsRef = db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats')
        .doc(user.id);

      await statsRef.update({ totalDuration: newDuration });

      logger.info(`User ${user.username} deleted ${sessionsToDelete.length} sessions${sessionToReduce ? ' and reduced 1 session' : ''}, removed ${timeRemoved}s. New duration: ${newDuration}s`);

      const beforeStr = formatDuration(currentDuration);
      const afterStr = formatDuration(newDuration);
      const removedStr = formatDuration(timeRemoved);

      let response = `✅ Successfully removed **${removedStr}** from your profile.\n\n`;

      if (sessionsToDelete.length > 0 && sessionToReduce) {
        response += `📊 **Changes made:**\n`;
        response += `• Deleted ${sessionsToDelete.length} session(s)\n`;
        response += `• Reduced 1 session from ${formatDuration(sessionToReduce.currentDuration)} to ${formatDuration(sessionToReduce.newDuration)}\n\n`;
      } else if (sessionsToDelete.length > 0) {
        response += `📊 Deleted **${sessionsToDelete.length} session(s)**\n\n`;
      } else if (sessionToReduce) {
        response += `📊 Reduced 1 session from ${formatDuration(sessionToReduce.currentDuration)} to ${formatDuration(sessionToReduce.newDuration)}\n\n`;
      }

      response += `**Before:** ${beforeStr}\n`;
      response += `**After:** ${afterStr}`;


      await interaction.editReply({ content: response });
    } catch (error) {
      logger.error('Error reducing time:', error);
      await interaction.editReply({
        content: '❌ Failed to reduce time. Please try again later.',
      });
    }
  },
};
