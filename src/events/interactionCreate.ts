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
import { handleGroupButtons } from '../interactions/buttons/groupButtons';
import {
  handleFindGroupsPagination,
  handleGroupLeaderboardPagination,
} from '../interactions/buttons/groupPaginationButtons';
import {
  handleEventJoinButton,
  handleEventLeaveButton,
  handleEventListJoinButton,
  handleEventListLeaveButton,
} from '../interactions/buttons/eventButtons';
import {
  handleViewGraphButton,
  handleViewStatsButton,
} from '../interactions/buttons/statsButtons';
import { handleGoalCompleteSelect } from '../interactions/selects/goalSelect';
import { handleAchievementFilterSelect } from '../interactions/selects/achievementSelect';
import { handleEndSessionModal } from '../interactions/modals/endSessionModal';
import { handleManualSessionModal } from '../interactions/modals/manualSessionModal';

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

  // Handle button interactions
  if (interaction.isButton()) {
    // Handle group-related buttons
    if (interaction.customId.startsWith('groupadmin_delete_')) {
      await handleGroupButtons(interaction, db, client);
      return;
    }

    // Handle group pagination buttons
    if (interaction.customId.startsWith('findgroups:')) {
      await handleFindGroupsPagination(interaction, db);
      return;
    }

    if (interaction.customId.startsWith('group_leaderboard_page:')) {
      await handleGroupLeaderboardPagination(interaction, db);
      return;
    }

    // Handle event-related buttons
    if (interaction.customId.startsWith('event_join:')) {
      await handleEventJoinButton(interaction, db);
      return;
    }

    if (interaction.customId.startsWith('event_leave:')) {
      await handleEventLeaveButton(interaction, db);
      return;
    }

    if (interaction.customId === 'event_list_join') {
      await handleEventListJoinButton(interaction);
      return;
    }

    if (interaction.customId === 'event_list_leave') {
      await handleEventListLeaveButton(interaction);
      return;
    }

    // Handle stats-related buttons
    if (interaction.customId.startsWith('view_graph_')) {
      await handleViewGraphButton(interaction, db, client);
      return;
    }

    if (interaction.customId.startsWith('view_stats_')) {
      await handleViewStatsButton(interaction, db, client);
      return;
    }

    // TODO: Handle other button types
    // For now, other buttons will be handled by the legacy bot.ts code
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    // Goal completion select menu
    if (interaction.customId.startsWith('goal_complete:')) {
      await handleGoalCompleteSelect(interaction, db);
      return;
    }

    // Achievement filter select menu
    if (interaction.customId.startsWith('achievement_filter:')) {
      await handleAchievementFilterSelect(interaction, db);
      return;
    }

    // TODO: Handle other select menu types
    logger.warn(`Unknown select menu: ${interaction.customId}`);
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'endSessionModal') {
      await handleEndSessionModal(interaction, db, client);
      return;
    }

    if (interaction.customId === 'manualSessionModal') {
      await handleManualSessionModal(interaction, db, client);
      return;
    }

    // TODO: Handle other modal types
    logger.warn(`Unknown modal: ${interaction.customId}`);
  }

  // TODO: Handle other interaction types (selects, etc.)
}
