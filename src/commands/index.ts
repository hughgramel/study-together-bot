/**
 * Command Registry
 *
 * Centralized command loader and registry.
 * Automatically loads all commands and provides registration functionality.
 */

import { Collection, REST, Routes } from 'discord.js';
import type { Command } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('CommandRegistry');

/**
 * Global command collection
 */
export const commands = new Collection<string, Command>();

/**
 * Load all commands
 */
export async function loadCommands(): Promise<void> {
  logger.info('Loading commands...');

  // Session commands
  const sessionCommands = [
    '../commands/session/start',
    '../commands/session/stop',
    '../commands/session/pause',
    '../commands/session/unpause',
    '../commands/session/break',
    '../commands/session/time',
    '../commands/session/cancel',
    '../commands/session/reduce-xp',
    '../commands/session/reduce-time',
    '../commands/session/pomodoro',
    // Note: timer functionality is now part of /start command (use /start hours:X or /start minutes:Y)
  ];

  // Stats commands
  const statsCommands = [
    '../commands/stats/me',
    '../commands/stats/stats',
    '../commands/stats/achievements',
    '../commands/stats/profile',
    '../commands/stats/leaderboard',
    '../commands/stats/live',
    '../commands/stats/graph',
  ];

  // Goals commands
  const goalsCommands = [
    '../commands/goals/goal',
    '../commands/goals/goals',
    '../commands/goals/complete',
  ];

  // Events commands
  const eventsCommands = [
    '../commands/events/createevent',
    '../commands/events/events',
    '../commands/events/myevents',
    '../commands/events/cancelevent',
  ];

  // Admin commands
  const adminCommands = [
    '../commands/admin/setup-feed',
    '../commands/admin/set-welcome-channel',
    '../commands/admin/setup-events-channel',
    '../commands/admin/setup-timezone',
    '../commands/admin/setup-goal-channel',
    '../commands/admin/admin-delete-xp',
    '../commands/admin/admin-delete-time',
  ];

  // Group commands
  const groupCommands = [
    '../commands/groups/group',
    '../commands/groups/creategroup',
    '../commands/groups/joingroup',
    '../commands/groups/joinrandom',
    '../commands/groups/leavegroup',
    '../commands/groups/invitegroup',
    '../commands/groups/group_leaderboard',
    '../commands/groups/findgroups',
    '../commands/groups/groupadmin',
    '../commands/groups/groupsettings',
    '../commands/groups/groupdescription',
    '../commands/groups/renamegroup',
  ];

  // Utility commands
  const utilityCommands = [
    '../commands/utility/manual',
    '../commands/utility/help',
    '../commands/utility/lightmode',
  ];

  // Combine all command paths
  const allCommands = [
    ...sessionCommands,
    ...statsCommands,
    ...groupCommands,
    ...goalsCommands,
    ...eventsCommands,
    ...adminCommands,
    ...utilityCommands,
  ];

  for (const commandPath of allCommands) {
    try {
      const { command } = await import(commandPath);
      commands.set(command.data.name, command);
      logger.info(`Loaded command: ${command.data.name}`);
    } catch (error) {
      logger.error(`Failed to load command from ${commandPath}`, error);
    }
  }

  logger.info(`Successfully loaded ${commands.size} commands`);
}

/**
 * Register commands with Discord
 */
export async function registerCommands(
  clientId: string,
  token: string,
  guildId?: string
): Promise<void> {
  const commandData = Array.from(commands.values()).map((cmd) =>
    cmd.data.toJSON()
  );

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info(
      `Started refreshing ${commandData.length} application (/) commands.`
    );

    if (guildId) {
      // Register guild-specific commands (faster, for development)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandData,
      });
      logger.info(
        `Successfully registered ${commandData.length} guild commands for guild ${guildId}`
      );
    } else {
      // Register global commands (slower, for production)
      await rest.put(Routes.applicationCommands(clientId), {
        body: commandData,
      });
      logger.info(
        `Successfully registered ${commandData.length} global commands`
      );
    }
  } catch (error) {
    logger.error('Failed to register commands', error);
    throw error;
  }
}

/**
 * Get command by name
 */
export function getCommand(name: string): Command | undefined {
  return commands.get(name);
}
