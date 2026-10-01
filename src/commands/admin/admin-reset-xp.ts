/**
 * /admin-reset-xp Command
 *
 * Admin command to reset all users' XP and hours to 0, saving a snapshot of
 * each user's current period into their resetHistory so /history still works.
 *
 * Safety: requires typing "CONFIRM RESET" as the confirm option.
 * Processed in Firestore batches of 400 to stay within the 500-write limit.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { XpResetSnapshot } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminResetXPCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admin-reset-xp')
    .setDescription('Admin: Reset ALL users XP and hours to 0, saving history for /history')
    .addStringOption(option =>
      option
        .setName('confirm')
        .setDescription('Type exactly: CONFIRM RESET')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You need Administrator permissions to use this command.',
        ephemeral: true,
      });
      return;
    }

    const confirm = interaction.options.getString('confirm', true);
    if (confirm !== 'CONFIRM RESET') {
      await interaction.reply({
        content: '❌ You must type exactly **CONFIRM RESET** to proceed.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const statsCollection = db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats');

      const allUsersSnapshot = await statsCollection.get();

      if (allUsersSnapshot.empty) {
        await interaction.editReply({ content: '❌ No user stats found to reset.' });
        return;
      }

      const now = Timestamp.now();
      const docs = allUsersSnapshot.docs;
      const BATCH_SIZE = 400;
      let processedCount = 0;
      let skippedCount = 0; // users who already had 0 XP/hours

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + BATCH_SIZE);

        for (const doc of chunk) {
          const data = doc.data();
          const currentXp = data.xp || 0;
          const currentDuration = data.totalDuration || 0;
          const currentSessions = data.totalSessions || 0;

          // Skip users with nothing to reset (saves a write)
          if (currentXp === 0 && currentDuration === 0 && currentSessions === 0) {
            skippedCount++;
            continue;
          }

          const existingHistory: XpResetSnapshot[] = data.resetHistory || [];
          const resetNumber = existingHistory.length + 1;

          const snapshot: XpResetSnapshot = {
            resetNumber,
            resetAt: now,
            periodXp: currentXp,
            periodHours: currentDuration / 3600,
            periodSessions: currentSessions,
            longestStreakInPeriod: data.longestStreak || 0,
            longestSessionInPeriod: data.longestSessionDuration || 0,
          };

          batch.update(doc.ref, {
            xp: 0,
            totalDuration: 0,
            totalSessions: 0,
            sessionsByDay: {},
            resetHistory: [...existingHistory, snapshot],
          });

          processedCount++;
        }

        await batch.commit();
      }

      logger.info(
        `XP Reset by ${interaction.user.username} (${interaction.user.id}). ` +
        `Reset: ${processedCount}, Skipped (already 0): ${skippedCount}`
      );

      const totalUsers = processedCount + skippedCount;
      await interaction.editReply({
        content:
          `✅ **XP Reset Complete!**\n\n` +
          `**${processedCount}** of ${totalUsers} users reset to 0 XP and 0 hours.\n` +
          `${skippedCount > 0 ? `*(${skippedCount} users already had 0 — skipped)*\n` : ''}` +
          `\nHistory saved — users can view past periods with \`/history\`.`,
      });
    } catch (error) {
      logger.error('Error during XP reset:', error);
      await interaction.editReply({
        content: '❌ Failed to perform reset. Check Railway logs for details.',
      });
    }
  },
};
