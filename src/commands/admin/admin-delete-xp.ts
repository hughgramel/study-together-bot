/**
 * /admin-delete-xp Command
 *
 * Admin command to delete XP from a user's profile.
 * Used to correct users who accidentally gained too much XP.
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { calculateLevel } from '../../utils/xp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminDeleteXPCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admin-delete-xp')
    .setDescription('Admin: Delete XP from a user (for corrections)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to remove XP from')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount of XP to remove')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;

    // Check if user has admin permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ You need Administrator permissions to use this command.',
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`Admin ${interaction.user.username} deleting ${amount} XP from ${targetUser.username}`);

      const statsService = new StatsService(db);
      const userStats = await statsService.getUserStats(targetUser.id);

      if (!userStats) {
        await interaction.editReply({
          content: `❌ ${targetUser.username} has no stats yet.`,
        });
        return;
      }

      const currentXP = userStats.xp || 0;
      const currentLevel = calculateLevel(currentXP);
      const newXP = Math.max(0, currentXP - amount); // Don't go below 0
      const newLevel = calculateLevel(newXP);
      const actualRemoved = currentXP - newXP;

      // Update the user's XP in the database
      const statsRef = db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats')
        .doc(targetUser.id);

      await statsRef.update({ xp: newXP });

      logger.info(`Removed ${actualRemoved} XP from ${targetUser.username}. New XP: ${newXP}`);

      let response = `✅ Successfully removed **${actualRemoved} XP** from ${targetUser.username}.\n\n`;
      response += `**Before:** ${currentXP.toLocaleString()} XP (Level ${currentLevel})\n`;
      response += `**After:** ${newXP.toLocaleString()} XP (Level ${newLevel})`;

      if (newLevel < currentLevel) {
        response += `\n\n⚠️ User leveled down from Level ${currentLevel} to Level ${newLevel}`;
      }

      await interaction.editReply({ content: response });
    } catch (error) {
      logger.error('Error deleting XP:', error);
      await interaction.editReply({
        content: '❌ Failed to delete XP. Please try again later.',
      });
    }
  },
};
