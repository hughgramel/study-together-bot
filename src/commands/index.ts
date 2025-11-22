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
    '../commands/session/time',
    '../commands/session/cancel',
  ];

  for (const commandPath of sessionCommands) {
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
