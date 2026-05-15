/**
 * Message Logger Event Handlers
 *
 * Captures all guild messages to Firestore for audit log purposes.
 * Records are permanent and cannot be deleted through the bot.
 * Handles: messageCreate (log), messageDelete (mark deleted), messageUpdate (track edits).
 */

import { Message, PartialMessage } from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { ModerationService } from '../services/moderation';
import { createLogger } from '../utils/logger';

const logger = createLogger('MessageLogger');

export async function handleMessageLogCreate(
  message: Message,
  db: Firestore
): Promise<void> {
  // Skip bots and DMs
  if (message.author?.bot) return;
  if (!message.guildId) return;

  const modService = new ModerationService(db);

  try {
    const channelName =
      'name' in message.channel ? (message.channel as { name: string }).name : 'unknown';

    await modService.logMessage({
      messageId: message.id,
      channelId: message.channelId,
      channelName,
      guildId: message.guildId,
      authorId: message.author.id,
      authorUsername: message.author.username,
      content: message.content ?? '',
      attachments: [...message.attachments.values()].map((a) => a.url),
      createdAt: Timestamp.fromDate(message.createdAt),
    });
  } catch (error) {
    logger.error('Failed to log message create', error);
  }
}

export async function handleMessageLogDelete(
  message: Message | PartialMessage,
  db: Firestore
): Promise<void> {
  if (!message.guildId) return;

  const modService = new ModerationService(db);

  try {
    await modService.markMessageDeleted(message.id);
    logger.info(`Message ${message.id} marked as deleted in audit log`);
  } catch (error) {
    logger.error('Failed to mark message deleted', error);
  }
}

export async function handleMessageLogUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
  db: Firestore
): Promise<void> {
  if (!newMessage.guildId) return;
  if (newMessage.author?.bot) return;

  const oldContent = oldMessage.content ?? '';
  const newContent = newMessage.content ?? '';

  // Only log if content actually changed (ignore embed-only updates etc.)
  if (oldContent === newContent) return;

  const modService = new ModerationService(db);

  try {
    await modService.logMessageEdit(newMessage.id, oldContent, newContent);
  } catch (error) {
    logger.error('Failed to log message update', error);
  }
}
