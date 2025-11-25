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
import {
  handleLeaderboardTimeframeSelect,
  handleLeaderboardImageTimeframeSelect,
} from '../interactions/selects/leaderboardSelect';
import { handleStatsMetricTimeframeSelect } from '../interactions/selects/statsSelect';
import { handleStatsDetailSelect } from '../interactions/selects/statsDetailSelect';
import { handleEndSessionModal } from '../interactions/modals/endSessionModal';
import { handleManualSessionModal } from '../interactions/modals/manualSessionModal';
import { handleTimerEndSessionModal } from '../interactions/modals/timerEndSessionModal';
import { handleEditSessionModal } from '../interactions/modals/editSessionModal';
import { handleEventBuilderModals } from '../interactions/eventBuilder/eventBuilderModals';
import { handleEventBuilderButtons } from '../interactions/eventBuilder/eventBuilderButtons';
import { handleEventBuilderStudyTypeSelect } from '../interactions/eventBuilder/eventBuilderSelects';
import { handleTimerEditButton } from '../interactions/buttons/timerButtons';
import { handleSessionEditButton } from '../interactions/buttons/sessionEditButtons';

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
    // Handle event builder buttons
    if (interaction.customId.includes('event_builder:')) {
      await handleEventBuilderButtons(interaction, db, client);
      return;
    }

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

    // Handle timer edit button
    if (interaction.customId.startsWith('timer_edit_')) {
      await handleTimerEditButton(interaction, db);
      return;
    }

    // Handle session edit button
    if (interaction.customId.startsWith('edit_session_')) {
      await handleSessionEditButton(interaction, db);
      return;
    }
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    // Event builder study type selection
    if (
      interaction.customId.includes('event_builder:') &&
      interaction.customId.includes(':study_type')
    ) {
      await handleEventBuilderStudyTypeSelect(interaction);
      return;
    }

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

    // Leaderboard timeframe select menu
    if (interaction.customId === 'leaderboard_timeframe') {
      await handleLeaderboardTimeframeSelect(interaction, db);
      return;
    }

    // Leaderboard image timeframe select menu
    if (interaction.customId === 'leaderboard_image_timeframe') {
      await handleLeaderboardImageTimeframeSelect(interaction, db);
      return;
    }

    // Stats metric/timeframe select menus
    if (
      interaction.customId.startsWith('stats-metric:') ||
      interaction.customId.startsWith('stats-timeframe:')
    ) {
      await handleStatsMetricTimeframeSelect(interaction, db, client);
      return;
    }

    // Stats detail select menu (stats_select_*)
    if (interaction.customId.startsWith('stats_select_')) {
      await handleStatsDetailSelect(interaction, db);
      return;
    }

    logger.warn(`Unknown select menu: ${interaction.customId}`);
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    // Event builder modals
    if (
      interaction.customId.includes('event_builder:') &&
      interaction.customId.includes(':modal_')
    ) {
      await handleEventBuilderModals(interaction);
      return;
    }

    if (interaction.customId === 'endSessionModal') {
      await handleEndSessionModal(interaction, db, client);
      return;
    }

    if (interaction.customId === 'timerEndSessionModal') {
      await handleTimerEndSessionModal(interaction, db, client);
      return;
    }

    if (interaction.customId.startsWith('editSessionModal_')) {
      await handleEditSessionModal(interaction, db, client);
      return;
    }

    if (interaction.customId === 'manualSessionModal') {
      await handleManualSessionModal(interaction, db, client);
      return;
    }

    logger.warn(`Unknown modal: ${interaction.customId}`);
  }
}
