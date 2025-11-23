/**
 * Manual Command Registration Script
 *
 * Registers slash commands with Discord without starting the bot.
 * Useful for development when you want to update commands quickly.
 *
 * Usage:
 *   npm run register-commands
 */

import * as dotenv from 'dotenv';
import { loadCommands, registerCommands } from '../src/commands';

dotenv.config();

async function main() {
  console.log('Loading commands...');
  await loadCommands();

  const clientId = process.env.DISCORD_CLIENT_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.GUILD_ID;

  if (!clientId || !token) {
    console.error('Missing DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN in environment');
    process.exit(1);
  }

  console.log('Registering commands with Discord...');
  console.log(`Guild ID: ${guildId || 'None (global registration)'}`);

  try {
    await registerCommands(clientId, token, guildId);
    console.log('✅ Commands registered successfully!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
}

main();
