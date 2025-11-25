/**
 * /reduce-xp Command
 *
 * User command to reduce their own XP.
 * Allows users to correct their stats if they made a mistake.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { calculateLevel } from '../../utils/xp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ReduceXPCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reduce-xp')
    .setDescription('Reduce your own XP (for self-corrections)')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of XP to remove from your profile')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const amount = interaction.options.getInteger('amount', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`User ${user.username} reducing ${amount} XP from their profile`);

      const statsService = new StatsService(db);
      const userStats = await statsService.getUserStats(user.id);

      if (!userStats) {
        await interaction.editReply({
          content: '❌ You have no stats yet. Complete a session first!',
        });
        return;
      }

      const currentXP = userStats.xp || 0;

      if (currentXP === 0) {
        await interaction.editReply({
          content: '❌ You have no XP to reduce.',
        });
        return;
      }

      const currentLevel = calculateLevel(currentXP);
      const newXP = Math.max(0, currentXP - amount); // Don't go below 0
      const newLevel = calculateLevel(newXP);
      const actualRemoved = currentXP - newXP;

      // Update the user's XP in the database
      const statsRef = db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats')
        .doc(user.id);

      await statsRef.update({ xp: newXP });

      logger.info(`User ${user.username} removed ${actualRemoved} XP. New XP: ${newXP}`);

      let response = `✅ Successfully removed **${actualRemoved} XP** from your profile.\n\n`;
      response += `**Before:** ${currentXP.toLocaleString()} XP (Level ${currentLevel})\n`;
      response += `**After:** ${newXP.toLocaleString()} XP (Level ${newLevel})`;

      if (newLevel < currentLevel) {
        response += `\n\n⚠️ You leveled down from Level ${currentLevel} to Level ${newLevel}`;
      }

      if (actualRemoved < amount) {
        response += `\n\n💡 Note: Only removed ${actualRemoved} XP as you had less than requested.`;
      }

      await interaction.editReply({ content: response });
    } catch (error) {
      logger.error('Error reducing XP:', error);
      await interaction.editReply({
        content: '❌ Failed to reduce XP. Please try again later.',
      });
    }
  },
};
