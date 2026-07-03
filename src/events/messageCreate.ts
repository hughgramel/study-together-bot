/**
 * Message Create Event Handler
 *
 * Handles incoming Discord messages to:
 * 1. Enforce role mention restrictions (delete messages that ping restricted roles outside allowed channels)
 * 2. Parse numbered goal lists in designated goal channels
 */

import { Message, Client, TextChannel } from 'discord.js';
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

    // Get server config
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

    // ── Role mention restrictions ──────────────────────────────────────────────
    if (config.roleMentionRestrictions && config.roleMentionRestrictions.length > 0) {
      const mentionedRoles = message.mentions.roles;

      for (const restriction of config.roleMentionRestrictions) {
        if (
          mentionedRoles.has(restriction.roleId) &&
          message.channel.id !== restriction.allowedChannelId
        ) {
          // Delete the offending message (best-effort)
          await message.delete().catch(() => {});

          // Warn the user with a self-deleting message
          const channel = message.channel as TextChannel;
          const warning = await channel
            .send(
              `${message.author}, the <@&${restriction.roleId}> role can only be mentioned in <#${restriction.allowedChannelId}>.`
            )
            .catch(() => null);

          if (warning) {
            setTimeout(() => warning.delete().catch(() => {}), 8000);
          }

          logger.info(
            `Deleted restricted role mention by ${message.author.username} (${message.author.id}) in channel ${message.channel.id}`
          );
          return;
        }
      }
    }

    // ── Goal channel parsing ───────────────────────────────────────────────────
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
      `Created ${tasks.length} goals for ${message.author.username} (${message.author.id})`
    );

    // React to the message to confirm goals were created
    await message.react('✅');
  } catch (error) {
    logger.error('Error handling message create', error);
    // Don't reply to avoid spam - just log the error
  }
}
