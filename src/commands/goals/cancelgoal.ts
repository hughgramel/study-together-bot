/**
 * /cancelgoal Command
 *
 * Cancels one or more active goals. With no arguments, opens a multi-select
 * menu listing the user's active goals. The optional `numbers` argument is a
 * shortcut for power users — same format as /complete (e.g., "1", "1,2,3",
 * "1-3", "1-3,5,7-9").
 */

import {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { TaskService } from '../../services/tasks';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CancelGoalCommand');

// Discord caps StringSelectMenu options at 25.
const MAX_MENU_OPTIONS = 25;
// Discord caps option labels at 100 chars.
const MAX_LABEL_LENGTH = 100;

/**
 * Parse goal numbers from input string.
 * Supports: "1", "1,2,3", "1-3", "1, 2, 3", "1-3,5,7-9"
 */
function parseGoalNumbers(input: string): number[] {
  const numbers = new Set<number>();
  const parts = input.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
      if (isNaN(start) || isNaN(end)) {
        continue;
      }
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        numbers.add(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        numbers.add(num);
      }
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cancelgoal')
    .setDescription('Cancel active goals — opens a picker, or pass numbers directly')
    .addStringOption((option) =>
      option
        .setName('numbers')
        .setDescription('Optional shortcut: goal numbers (e.g., 1, 1-3, 1,2,3)')
        .setRequired(false)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const numbersInput = interaction.options.getString('numbers');
    const taskService = new TaskService(db);

    try {
      // Path 1: typed shortcut — bulk-cancel by parsed numbers.
      if (numbersInput && numbersInput.trim().length > 0) {
        logger.info(
          `User ${user.username} (${user.id}) cancelling goals via numbers: ${numbersInput}`
        );

        const goalNumbers = parseGoalNumbers(numbersInput);
        if (goalNumbers.length === 0) {
          await interaction.reply({
            content:
              '❌ Invalid goal numbers. Use formats like:\n' +
              '• Single: `/cancelgoal 1`\n' +
              '• Multiple: `/cancelgoal 1,2,3`\n' +
              '• Range: `/cancelgoal 1-3`\n' +
              '• Combined: `/cancelgoal 1-3,5,7-9`\n' +
              '• Or run `/cancelgoal` with no input to use the picker.',
            ephemeral: true,
          });
          return;
        }

        const { cancelled, invalid, activeCount } =
          await taskService.cancelActiveTasksByIndices(user.id, goalNumbers);

        if (cancelled.length === 0) {
          if (activeCount === 0) {
            await interaction.reply({
              content: '📋 You have no active goals to cancel.',
              ephemeral: true,
            });
            return;
          }
          await interaction.reply({
            content: `❌ Invalid goal number${invalid.length !== 1 ? 's' : ''}: ${invalid.join(', ')}. You have ${activeCount} active goal${activeCount !== 1 ? 's' : ''}. Use \`/goals\` to view them.`,
            ephemeral: true,
          });
          return;
        }

        let message = `🗑️ **Cancelled ${cancelled.length} goal${cancelled.length !== 1 ? 's' : ''}:**\n`;
        message += cancelled.map((task) => `• ${task.description}`).join('\n');
        if (invalid.length > 0) {
          message += `\n\n⚠️ Skipped invalid goal number${invalid.length !== 1 ? 's' : ''}: ${invalid.join(', ')}`;
        }

        await interaction.reply({ content: message, ephemeral: true });
        return;
      }

      // Path 2: no shortcut — show a multi-select picker of active goals.
      logger.info(`User ${user.username} (${user.id}) opening cancel picker`);

      const activeTasks = await taskService.getActiveTasks(user.id);

      if (activeTasks.length === 0) {
        await interaction.reply({
          content: '📋 You have no active goals to cancel.',
          ephemeral: true,
        });
        return;
      }

      const visibleTasks = activeTasks.slice(0, MAX_MENU_OPTIONS);
      const truncatedNote =
        activeTasks.length > MAX_MENU_OPTIONS
          ? `\n\n⚠️ Showing your first ${MAX_MENU_OPTIONS} of ${activeTasks.length} active goals. To cancel goals beyond #${MAX_MENU_OPTIONS}, run \`/cancelgoal numbers:<n>\`.`
          : '';

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`cancelgoal_select:${user.id}`)
        .setPlaceholder('Select goals to cancel')
        .setMinValues(1)
        .setMaxValues(visibleTasks.length)
        .addOptions(
          visibleTasks.map((task, idx) => ({
            label: truncate(`${idx + 1}. ${task.description}`, MAX_LABEL_LENGTH),
            value: task.id,
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

      await interaction.reply({
        content: `🗑️ **Pick goals to cancel.** Multi-select supported.${truncatedNote}`,
        components: [row],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error cancelling goals', error);
      const reply = {
        content: '❌ An error occurred while cancelling your goals. Please try again later.',
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};
