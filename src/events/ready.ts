/**
 * Ready Event Handler
 *
 * Handles the Discord client ready event.
 * Logs bot information and confirms successful connection.
 */

import { Client } from 'discord.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReadyEvent');

/**
 * Handle ready event
 */
export async function handleReady(client: Client): Promise<void> {
  if (!client.user) {
    logger.error('Client user is null');
    return;
  }

  logger.info(`Bot logged in as ${client.user.tag}`);
  logger.info(`Ready to serve ${client.guilds.cache.size} guilds`);
  logger.info(`Connected to Discord successfully`);

  // Set bot presence/status
  client.user.setPresence({
    activities: [{ name: 'productivity sessions | /start' }],
    status: 'online',
  });

  logger.info('Bot presence updated');
}
