/**
 * Discord Client Configuration
 *
 * Configures and exports Discord.js client with required intents and partials.
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('Discord');

/**
 * Create and configure Discord client
 * @returns Configured Discord.js client instance
 */
export function createDiscordClient(): Client {
  logger.info('Creating Discord client');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  // Extend client with custom properties
  client.statsSelections = new Map();

  logger.info('Discord client created successfully');

  return client;
}

/**
 * Extend Discord.js Client type to include custom properties
 */
declare module 'discord.js' {
  interface Client {
    statsSelections?: Map<
      string,
      {
        metric: 'hours' | 'xp' | 'sessions' | 'totalHours';
        timeframe: 'week' | 'month' | 'year';
      }
    >;
  }
}
