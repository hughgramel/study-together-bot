/**
 * /achievements Command
 *
 * View all unlocked and locked achievements with interactive filter.
 * Displays achievement progress and allows filtering between unlocked and locked.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { StatsService } from '../../services/stats';
import { AchievementService } from '../../services/achievements';
import { getAllAchievements } from '../../data/achievements';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AchievementsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View all your unlocked achievements'),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;

    logger.info(`User ${user.username} (${user.id}) viewing achievements`);

    // Initialize services
    const statsService = new StatsService(db);
    const achievementService = new AchievementService(db);

    // Get user stats
    const stats = await statsService.getUserStats(user.id);

    if (!stats) {
      await interaction.reply({
        content: 'No stats yet! Complete sessions to unlock achievements.',
        ephemeral: true,
      });
      return;
    }

    try {
      const userAchievements = await achievementService.getUserAchievements(user.id);
      const allAchievements = getAllAchievements();

      // Get unlocked achievement IDs for quick lookup
      const unlockedIds = new Set(userAchievements.map(b => b.id));

      // Separate unlocked and locked achievements
      const unlockedAchievements = allAchievements.filter(b => unlockedIds.has(b.id)).sort((a, b) => a.order - b.order);
      const lockedAchievements = allAchievements.filter(b => !unlockedIds.has(b.id)).sort((a, b) => a.order - b.order);

      // Create achievement list (show unlocked by default)
      const achievementList = unlockedAchievements.length > 0
        ? unlockedAchievements.map(b => `${b.emoji} **${b.name}** - *${b.description}*`).join('\n')
        : '*No achievements unlocked yet. Keep studying to earn your first achievement!*';

      const avatarUrl = user.displayAvatarURL({ size: 128 });

      const embed = new EmbedBuilder()
        .setColor(0xFFD900) // Gold
        .setTitle(`Your Achievements (${unlockedAchievements.length}/${allAchievements.length})`)
        .setDescription(achievementList)
        .setFooter({
          text: user.username,
          iconURL: avatarUrl
        });

      // Create dropdown menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`achievement_filter:${user.id}`)
        .setPlaceholder('Filter achievements')
        .addOptions([
          {
            label: 'Unlocked',
            description: `View your ${unlockedAchievements.length} unlocked achievements`,
            value: 'unlocked',
            emoji: '✅',
            default: true,
          },
          {
            label: 'Locked',
            description: `View ${lockedAchievements.length} achievements you haven't earned yet`,
            value: 'locked',
            emoji: '🔒',
          },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: false,
      });

      logger.info(`Achievements displayed for user ${user.id} (${unlockedAchievements.length}/${allAchievements.length})`);
    } catch (error) {
      logger.error('Error fetching achievements', error);
      await interaction.reply({
        content: 'Failed to fetch achievements. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
