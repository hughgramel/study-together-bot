/**
 * /lightmode Command
 *
 * Toggle light mode preference for generated images.
 * When enabled, all /me, /stats, and /group commands will use light mode styling.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LightModeCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lightmode')
    .setDescription('Toggle light mode for generated images')
    .addStringOption(option =>
      option
        .setName('enabled')
        .setDescription('Enable or disable light mode')
        .setRequired(true)
        .addChoices(
          { name: 'On', value: 'on' },
          { name: 'Off', value: 'off' }
        )
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const enabledStr = interaction.options.getString('enabled', true);
    const enabled = enabledStr === 'on';

    logger.info(`User ${user.username} (${user.id}) setting light mode to ${enabled}`);

    try {
      // Initialize stats service
      const statsService = new StatsService(db);

      // Get or create user stats
      let stats = await statsService.getUserStats(user.id);

      // Update light mode preference
      const userStatsRef = db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats')
        .doc(user.id);

      await userStatsRef.set(
        {
          lightMode: enabled,
          username: user.username,
        },
        { merge: true }
      );

      // Send confirmation
      await interaction.reply({
        content: enabled
          ? '☀️ **Light mode enabled!** Your generated images will now use light mode styling.'
          : '🌙 **Dark mode enabled!** Your generated images will now use dark mode styling.',
        ephemeral: true,
      });

      logger.info(`Light mode preference updated for user ${user.id}: ${enabled}`);
    } catch (error) {
      logger.error('Error updating light mode preference', error);
      await interaction.reply({
        content: '❌ Failed to update light mode preference. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
