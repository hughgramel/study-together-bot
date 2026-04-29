/**
 * Cancel Goals Select Menu Handler
 *
 * Handles the multi-select menu shown by /cancelgoal. Values are task IDs.
 */

import { StringSelectMenuInteraction } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CancelGoalsSelect');

export async function handleCancelGoalsSelect(
  interaction: StringSelectMenuInteraction,
  db: Firestore
): Promise<void> {
  const ownerId = interaction.customId.split(':')[1];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'This cancel menu belongs to someone else!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const taskService = new TaskService(db);
    const cancelled = await taskService.cancelActiveTasksByIds(
      ownerId,
      interaction.values
    );

    if (cancelled.length === 0) {
      await interaction.editReply({
        content:
          '⚠️ No goals were cancelled — they may have already been completed or removed.',
        components: [],
      });
      return;
    }

    let message = `🗑️ **Cancelled ${cancelled.length} goal${cancelled.length !== 1 ? 's' : ''}:**\n`;
    message += cancelled.map((task) => `• ${task.description}`).join('\n');

    await interaction.editReply({ content: message, components: [] });

    logger.info(
      `User ${ownerId} cancelled ${cancelled.length} goals via select menu`
    );
  } catch (error) {
    logger.error('Error handling cancel-goals select:', error);
    await interaction.editReply({
      content: '❌ An error occurred while cancelling your goals. Please try again.',
      components: [],
    });
  }
}
