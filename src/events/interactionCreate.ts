/**
 * InteractionCreate Event Handler
 *
 * Main router for all Discord interactions (commands, modals, buttons, selects).
 */

import { Interaction, Client } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { getCommand } from '../commands';
import { handleCommandError } from '../middleware/errorHandler';
import type { CommandContext } from '../commands/types';
import { createLogger } from '../utils/logger';

const logger = createLogger('InteractionCreate');

/**
 * Handle interaction create event
 */
export async function handleInteractionCreate(
  interaction: Interaction,
  db: Firestore,
  client: Client
): Promise<void> {
  // Create command context
  const context: CommandContext = {
    db,
    client,
  };

  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = getCommand(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      await interaction.reply({
        content: 'Unknown command.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(
        `Executing command: ${interaction.commandName} for user ${interaction.user.username} (${interaction.user.id})`
      );
      await command.execute(interaction, context);
    } catch (error) {
      await handleCommandError(
        error instanceof Error ? error : new Error(String(error)),
        interaction
      );
    }
  }

  // TODO: Handle modals, buttons, and selects
  // For now, these will be handled by the legacy bot.ts code
}
