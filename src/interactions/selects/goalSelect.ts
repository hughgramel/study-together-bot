/**
 * Goal Select Menu Handler
 *
 * Handles goal completion select menu interactions.
 */

import { StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { DailyGoalService } from '../../services/dailyGoal';
import { XPService } from '../../services/xp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GoalSelect');

/**
 * Handle goal completion select menu
 */
export async function handleGoalCompleteSelect(
  interaction: StringSelectMenuInteraction,
  db: Firestore
): Promise<void> {
  const userId = interaction.customId.split(':')[1];
  const goalId = interaction.values[0];

  // Only allow the owner to interact with their goal menu
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: 'This goal menu belongs to someone else!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const dailyGoalService = new DailyGoalService(db);
    const xpService = new XPService(db); // No client needed for goal completion (roles update on session completion)

    // Complete the goal
    const result = await dailyGoalService.completeGoal(userId, goalId);
    const { goal, xpAwarded } = result;

    // Award XP to user (no serverId - roles will be synced on next session completion)
    let xpResult;
    try {
      xpResult = await xpService.awardXP(userId, undefined, xpAwarded, `Completed goal: ${goal.text}`);
    } catch (error) {
      logger.warn('User has no stats yet, skipping XP award');
    }

    // Build XP text
    const xpText =
      xpResult && xpResult.leveledUp
        ? `+${xpAwarded} XP • 🎉 Level ${xpResult.newLevel}!`
        : `+${xpAwarded} XP`;

    // Create completion embed
    const embed = new EmbedBuilder()
      .setColor(0x58cc02) // Green
      .setTitle('🎉 Goal Completed!')
      .setDescription(`**${goal.text}**`)
      .addFields(
        { name: 'XP Earned', value: xpText, inline: true },
        {
          name: 'Difficulty',
          value: `${goal.difficulty.charAt(0).toUpperCase() + goal.difficulty.slice(1)}`,
          inline: true,
        }
      )
      .setFooter({ text: 'Great work! Keep setting and completing goals!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [] });
    logger.info(`User ${userId} completed goal: ${goal.text}`);
  } catch (error) {
    logger.error('Error completing goal:', error);
    await interaction.editReply({
      content: 'An error occurred while completing your goal. Please try again.',
      components: [],
    });
  }
}
