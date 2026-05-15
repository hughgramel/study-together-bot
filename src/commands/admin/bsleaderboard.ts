/**
 * /bsleaderboard Command
 *
 * Shows the server's top BS callers ranked by total correct calls.
 * Every 20 correct calls earns +130 XP.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';
import { ModerationService, BS_XP_MILESTONE, BS_XP_REWARD } from '../../services/moderation';

const MEDALS = ['🥇', '🥈', '🥉'];

function rankIcon(index: number): string {
  return MEDALS[index] ?? `**#${index + 1}**`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('bsleaderboard')
    .setDescription('See who has called out the most slackers correctly'),

  async execute(interaction, context) {
    const { db } = context;

    await interaction.deferReply({ ephemeral: false });

    const modService = new ModerationService(db);
    const guildId = interaction.guildId!;

    const entries = await modService.getBsLeaderboard(guildId, 10);

    if (entries.length === 0) {
      await interaction.editReply({
        content: 'No BS calls have been confirmed yet. Use `/bs @user` to call someone out!',
      });
      return;
    }

    const rows = entries.map((entry, i) => {
      const pointsUntilNext = BS_XP_MILESTONE - (entry.bsPoints % BS_XP_MILESTONE);
      const nextMilestone =
        pointsUntilNext === BS_XP_MILESTONE
          ? `(milestone just hit!)`
          : `(${pointsUntilNext} until +${BS_XP_REWARD} XP)`;
      return `${rankIcon(i)} <@${entry.userId}> — **${entry.bsPoints}** correct call${entry.bsPoints !== 1 ? 's' : ''} · ${entry.xpMilestonesReached}x XP reward ${nextMilestone}`;
    });

    // Highlight the calling user's rank if they're not in the top 10
    const callerEntry = await modService.getBsLeaderboardEntry(guildId, interaction.user.id);
    let footerText = `Every ${BS_XP_MILESTONE} correct calls = +${BS_XP_REWARD} XP`;
    if (callerEntry) {
      const callerRank = entries.findIndex((e) => e.userId === interaction.user.id);
      if (callerRank === -1) {
        footerText += ` • You: ${callerEntry.bsPoints} point${callerEntry.bsPoints !== 1 ? 's' : ''} (not in top 10)`;
      }
    } else {
      footerText += ` • You have 0 points — start calling people out!`;
    }

    const embed = new EmbedBuilder()
      .setTitle('📢 BS Leaderboard — Top Slacker Detectors')
      .setColor(0xff6b00)
      .setDescription(rows.join('\n'))
      .setFooter({ text: footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
