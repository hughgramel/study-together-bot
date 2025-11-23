/**
 * Achievement Select Menu Handler
 *
 * Handles achievement filter select menu interactions.
 */

import { StringSelectMenuInteraction, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { AchievementService } from '../../services/achievements';
import { getAllAchievements } from '../../data/achievements';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AchievementSelect');

/**
 * Handle achievement filter select menu
 */
export async function handleAchievementFilterSelect(
  interaction: StringSelectMenuInteraction,
  db: Firestore
): Promise<void> {
  const userId = interaction.customId.split(':')[1];
  const selectedValue = interaction.values[0];

  // Only allow the owner to interact with their achievement menu
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: 'This achievement menu belongs to someone else!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const achievementService = new AchievementService(db);
    const userAchievements = await achievementService.getUserAchievements(userId);
    const allAchievements = getAllAchievements();

    // Get unlocked achievement IDs
    const unlockedIds = new Set(userAchievements.map((b) => b.id));

    // Separate unlocked and locked achievements
    const unlockedAchievements = allAchievements
      .filter((b) => unlockedIds.has(b.id))
      .sort((a, b) => a.order - b.order);
    const lockedAchievements = allAchievements
      .filter((b) => !unlockedIds.has(b.id))
      .sort((a, b) => a.order - b.order);

    // Create achievement list based on selection
    let achievementList: string;
    if (selectedValue === 'unlocked') {
      achievementList =
        unlockedAchievements.length > 0
          ? unlockedAchievements
              .map((b) => `${b.emoji} **${b.name}** - *${b.description}*`)
              .join('\n')
          : '*No achievements unlocked yet. Keep studying to earn your first achievement!*';
    } else {
      achievementList =
        lockedAchievements.length > 0
          ? lockedAchievements
              .map((b) => `🔒 ${b.emoji} **${b.name}** - *${b.description}*`)
              .join('\n')
          : "*You've unlocked all achievements! Amazing work!*";
    }

    const user = await interaction.client.users.fetch(userId);
    const avatarUrl = user.displayAvatarURL({ size: 128 });

    const embed = new EmbedBuilder()
      .setColor(0xffd900) // Gold
      .setTitle(
        `🏆 Your Achievements (${unlockedAchievements.length}/${allAchievements.length})`
      )
      .setDescription(achievementList)
      .setFooter({
        text: user.username,
        iconURL: avatarUrl,
      });

    // Recreate dropdown menu with updated default
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`achievement_filter:${userId}`)
      .setPlaceholder('Filter achievements')
      .addOptions([
        {
          label: 'Unlocked',
          description: `View your ${unlockedAchievements.length} unlocked achievements`,
          value: 'unlocked',
          emoji: '✅',
          default: selectedValue === 'unlocked',
        },
        {
          label: 'Locked',
          description: `View ${lockedAchievements.length} locked achievements`,
          value: 'locked',
          emoji: '🔒',
          default: selectedValue === 'locked',
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });
    logger.info(`User ${userId} filtered achievements: ${selectedValue}`);
  } catch (error) {
    logger.error('Error filtering achievements:', error);
    await interaction.editReply({
      content: 'An error occurred while filtering achievements. Please try again.',
      components: [],
    });
  }
}
