/**
 * /admin-revert-reset Command
 *
 * Admin command to restore all users' XP and hours back to the values they
 * held at the END of a specific past period.
 *
 * Example: if there have been 2 resets and you want to undo the most recent
 * one, choose period 2.  The bot will look up each user's resetHistory[1]
 * snapshot and write those values back into their live xp / totalDuration /
 * totalSessions fields.
 *
 * The resetHistory array is left INTACT so the audit trail is never destroyed.
 * Users who have no snapshot for the requested period are skipped (they may
 * have joined after that reset).
 *
 * Safety: requires typing "CONFIRM REVERT" as the confirm option.
 */

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { XpResetSnapshot } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminRevertResetCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admin-revert-reset')
    .setDescription('Admin: Restore all users XP/hours to the end of a specific past period')
    .addIntegerOption(option =>
      option
        .setName('period')
        .setDescription('Which period to restore to (1 = first ever, 2 = after reset 1, …)')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('confirm')
        .setDescription('Type exactly: CONFIRM REVERT')
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

    const periodNumber = interaction.options.getInteger('period', true);
    const confirm = interaction.options.getString('confirm', true);

    if (confirm !== 'CONFIRM REVERT') {
      await interaction.reply({
        content: '❌ You must type exactly **CONFIRM REVERT** to proceed.',
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
        await interaction.editReply({ content: '❌ No user stats found.' });
        return;
      }

      const docs = allUsersSnapshot.docs;
      const BATCH_SIZE = 400;

      let restoredCount = 0;
      let skippedCount  = 0; // no snapshot for that period
      let alreadyCount  = 0; // already matches the snapshot (no-op)

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + BATCH_SIZE);

        for (const doc of chunk) {
          const data = doc.data();
          const history: XpResetSnapshot[] = data.resetHistory || [];

          // resetHistory is 1-indexed by resetNumber; array index = resetNumber - 1
          const snapshot = history.find(s => s.resetNumber === periodNumber);

          if (!snapshot) {
            skippedCount++;
            continue;
          }

          const restoredXp       = snapshot.periodXp;
          const restoredDuration = Math.round(snapshot.periodHours * 3600);
          const restoredSessions = snapshot.periodSessions;

          // Skip if already identical (avoids a pointless write)
          const currentXp       = data.xp || 0;
          const currentDuration = data.totalDuration || 0;
          const currentSessions = data.totalSessions || 0;

          if (
            currentXp       === restoredXp &&
            currentDuration === restoredDuration &&
            currentSessions === restoredSessions
          ) {
            alreadyCount++;
            continue;
          }

          batch.update(doc.ref, {
            xp:            restoredXp,
            totalDuration: restoredDuration,
            totalSessions: restoredSessions,
            // Rebuild sessionsByDay from scratch isn't feasible here, so clear it —
            // the daily/weekly/monthly leaderboards use completed-sessions queries
            // (not sessionsByDay) so they stay accurate.
            sessionsByDay: {},
          });

          restoredCount++;
        }

        await batch.commit();
      }

      logger.info(
        `Revert to period ${periodNumber} by ${interaction.user.username} (${interaction.user.id}). ` +
        `Restored: ${restoredCount}, Skipped (no snapshot): ${skippedCount}, Already matched: ${alreadyCount}`
      );

      const embed = new EmbedBuilder()
        .setTitle(`✅ Reverted to Period ${periodNumber}`)
        .setColor(0x0080FF)
        .addFields(
          { name: 'Users Restored',              value: String(restoredCount),  inline: true },
          { name: 'Already Matched (no change)', value: String(alreadyCount),   inline: true },
          { name: 'No Snapshot (skipped)',        value: String(skippedCount),   inline: true },
        )
        .setFooter({ text: 'resetHistory audit trail preserved — /history still works' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error during revert:', error);
      await interaction.editReply({
        content: '❌ Revert failed. Check Railway logs for details.',
      });
    }
  },
};
