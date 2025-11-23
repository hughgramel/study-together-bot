/**
 * Study Together Bot - Main Entry Point
 *
 * A Discord bot for collaborative productivity tracking with Strava-style social features.
 * Users track study/work sessions, compete on leaderboards, and share accomplishments.
 */

import * as dotenv from 'dotenv';
import { createDiscordClient } from './config/discord';
import { initializeFirebase } from './config/firebase';
import { loadCommands, registerCommands } from './commands';
import { handleReady } from './events/ready';
import { handleInteractionCreate } from './events/interactionCreate';
import { handleMessageCreate } from './events/messageCreate';
import { validateEnvironment } from './middleware/errorHandler';
import { createLogger } from './utils/logger';
import { browserPool } from './services/browserPool';

// Load environment variables
dotenv.config();

const logger = createLogger('Main');

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting Study Together Bot...');

    // Validate environment variables
    validateEnvironment(['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']);

    // Initialize Firebase
    const db = initializeFirebase();
    logger.info('Firebase initialized');

    // Initialize browser pool for image generation
    // Can be skipped during development with SKIP_BROWSER_WARMUP=true
    if (process.env.SKIP_BROWSER_WARMUP !== 'true') {
      await browserPool.warmup();
      logger.info('Browser pool initialized');
    } else {
      logger.info(
        'Browser warmup skipped (SKIP_BROWSER_WARMUP=true) - browser will launch on-demand'
      );
    }

    // Create Discord client
    const client = createDiscordClient();
    logger.info('Discord client created');

    // Load commands
    await loadCommands();
    logger.info('Commands loaded');

    // Register event handlers
    client.once('ready', async () => {
      await handleReady(client);

      // Register commands with Discord
      try {
        await registerCommands(
          process.env.DISCORD_CLIENT_ID!,
          process.env.DISCORD_BOT_TOKEN!,
          process.env.GUILD_ID // Optional: guild ID for faster development
        );
      } catch (error) {
        logger.error('Failed to register commands', error);
      }
    });

    client.on('interactionCreate', async (interaction) => {
      await handleInteractionCreate(interaction, db, client);
    });

    client.on('messageCreate', async (message) => {
      await handleMessageCreate(message, db, client);
    });

    // Login to Discord
    await client.login(process.env.DISCORD_BOT_TOKEN);
    logger.info('Bot logged in successfully');
  } catch (error) {
    logger.error('Fatal error during startup', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await browserPool.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await browserPool.cleanup();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', error);
});

// Start the bot
main();
