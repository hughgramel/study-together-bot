/**
 * /history Command
 *
 * Shows a user's XP and hours history across every reset period.
 * Each period is displayed as a compact 5-point summary embed, followed by
 * a cumulative totals embed that spans all periods (including the current one).
 *
 * Data source: UserStats.resetHistory (populated by /admin-reset-xp).
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { formatDuration } from '../../utils/formatters';
import { XpResetSnapshot } from '../../types';

/** Max Discord embeds per message */
const MAX_EMBEDS = 10;

function buildPeriodEmbed(snapshot: XpResetSnapshot): EmbedBuilder {
  const resetDate = new Date(snapshot.resetAt.seconds * 1000);
  const dateStr = resetDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const hoursStr = snapshot.periodHours >= 1
    ? `${snapshot.periodHours.toFixed(1)}h`
    : `${Math.round(snapshot.periodHours * 60)}m`;

  const longestSessionStr = snapshot.longestSessionInPeriod > 0
    ? formatDuration(snapshot.longestSessionInPeriod)
    : '—';

  const longestStreakStr = snapshot.longestStreakInPeriod > 0
    ? `${snapshot.longestStreakInPeriod} day${snapshot.longestStreakInPeriod !== 1 ? 's' : ''}`
    : '—';

  return new EmbedBuilder()
    .setTitle(`Period ${snapshot.resetNumber}`)
    .setDescription(`*Reset on ${dateStr}*`)
    .setColor(0x0080FF)
    .addFields(
      { name: '✨ XP Earned',        value: snapshot.periodXp.toLocaleString(),     inline: true },
      { name: '⏱️ Hours Studied',    value: hoursStr,                                inline: true },
      { name: '📚 Sessions',         value: String(snapshot.periodSessions),         inline: true },
      { name: '🔥 Best Streak',      value: longestStreakStr,                         inline: true },
      { name: '⭐ Longest Session',  value: longestSessionStr,                        inline: true },
      { name: '\u200b',              value: '\u200b',                                 inline: true },
    );
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View your XP and hours history across all reset periods'),

  async execute(interaction, context) {
    const { db } = context;
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const statsService = new StatsService(db);
      const userStats = await statsService.getUserStats(userId);

      if (!userStats) {
        await interaction.editReply({
          content: '❌ You have no stats yet. Complete a session to get started!',
        });
        return;
      }

      const resetHistory: XpResetSnapshot[] = userStats.resetHistory || [];

      if (resetHistory.length === 0) {
        await interaction.editReply({
          content:
            'You have no reset history yet.\n' +
            'Your current stats will be snapshotted automatically when a reset is performed.',
        });
        return;
      }

      // ── Cumulative totals (all past periods + current period) ──────────────
      let cumulativeXp       = 0;
      let cumulativeHours    = 0;
      let cumulativeSessions = 0;
      for (const snap of resetHistory) {
        cumulativeXp       += snap.periodXp;
        cumulativeHours    += snap.periodHours;
        cumulativeSessions += snap.periodSessions;
      }

      const currentXp       = userStats.xp || 0;
      const currentHours    = (userStats.totalDuration || 0) / 3600;
      const currentSessions = userStats.totalSessions || 0;

      cumulativeXp       += currentXp;
      cumulativeHours    += currentHours;
      cumulativeSessions += currentSessions;

      // ── Build per-period embeds (newest first) ─────────────────────────────
      const periodEmbeds = [...resetHistory]
        .reverse()
        .map(buildPeriodEmbed);

      // ── Current period embed ───────────────────────────────────────────────
      const currentHoursStr = currentHours >= 1
        ? `${currentHours.toFixed(1)}h`
        : `${Math.round(currentHours * 60)}m`;

      const currentPeriodEmbed = new EmbedBuilder()
        .setTitle(`Current Period (Period ${resetHistory.length + 1})`)
        .setDescription('*In progress — not yet reset*')
        .setColor(0x43D692)
        .addFields(
          { name: '✨ XP So Far',    value: currentXp.toLocaleString(), inline: true },
          { name: '⏱️ Hours',        value: currentHoursStr,             inline: true },
          { name: '📚 Sessions',     value: String(currentSessions),     inline: true },
        );

      // ── Cumulative summary embed ───────────────────────────────────────────
      const cumHoursStr = cumulativeHours >= 1
        ? `${cumulativeHours.toFixed(1)}h`
        : `${Math.round(cumulativeHours * 60)}m`;

      const summaryEmbed = new EmbedBuilder()
        .setTitle('📈 All-Time Cumulative Totals')
        .setDescription(`Across **${resetHistory.length + 1}** period${resetHistory.length + 1 !== 1 ? 's' : ''}`)
        .setColor(0xFFD700)
        .addFields(
          { name: '✨ Total XP',       value: cumulativeXp.toLocaleString(),  inline: true },
          { name: '⏱️ Total Hours',    value: cumHoursStr,                     inline: true },
          { name: '📚 Total Sessions', value: String(cumulativeSessions),      inline: true },
        );

      // Stack: current period first, then past periods newest→oldest, then summary
      const allEmbeds = [currentPeriodEmbed, ...periodEmbeds, summaryEmbed];

      // Discord allows max 10 embeds per message
      await interaction.editReply({ embeds: allEmbeds.slice(0, MAX_EMBEDS) });
    } catch (error) {
      console.error('Error fetching history:', error);
      await interaction.editReply({
        content: '❌ Failed to fetch history. Please try again later.',
      });
    }
  },
};
