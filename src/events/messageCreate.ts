/**
 * Message Create Event Handler
 *
 * Handles incoming Discord messages to parse numbered task lists
 * in designated goal channels. Automatically creates tasks when
 * users post numbered lists.
 */

import { Message, Client } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { parseNumberedList } from '../utils/taskParser';
import { TaskService } from '../services/tasks';
import { createLogger } from '../utils/logger';
import { ServerConfig } from '../types';

const logger = createLogger('MessageCreateEvent');

/**
 * Handle message create event
 */
export async function handleMessageCreate(
  message: Message,
  db: Firestore,
  client: Client
): Promise<void> {
  try {
    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    // Only process messages from guilds (not DMs)
    if (!message.guild) {
      return;
    }

    // Get server config to check goal channel
    const configDoc = await db
      .collection('discord-data')
      .doc('serverConfig')
      .collection('configs')
      .doc(message.guild.id)
      .get();

    if (!configDoc.exists) {
      return;
    }

    const config = configDoc.data() as ServerConfig;

    // Check if message is in the goal channel
    if (!config.goalChannelId || message.channel.id !== config.goalChannelId) {
      return;
    }

    // Parse the message for numbered lists
    const tasks = parseNumberedList(message.content);

    if (!tasks || tasks.length === 0) {
      // Not a numbered list, ignore
      return;
    }

    // Create tasks
    const taskService = new TaskService(db);

    await taskService.createTasks(
      message.author.id,
      message.author.username,
      tasks,
      message.id,
      message.channel.id
    );

    logger.info(
      `Created ${tasks.length} tasks for ${message.author.username} (${message.author.id})`
    );

    // React to the message to confirm tasks were created
    await message.react('✅');
  } catch (error) {
    logger.error('Error handling message create', error);
    // Don't reply to avoid spam - just log the error
  }
}
