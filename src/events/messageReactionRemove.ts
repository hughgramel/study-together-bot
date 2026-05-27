/**
 * Message Reaction Remove Event Handler
 *
 * Revokes Discord roles when users remove their reaction from configured messages.
 */

import { MessageReaction, User, Client, PartialMessageReaction, PartialUser } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { ServerConfig } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReactionRemove');

export async function handleMessageReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  db: Firestore,
  client: Client
): Promise<void> {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    const configDoc = await db
      .collection('discord-data')
      .doc('serverConfig')
      .collection('configs')
      .doc(guild.id)
      .get();

    if (!configDoc.exists) return;

    const config = configDoc.data() as ServerConfig;
    const reactionRoles = config.reactionRoles || [];
    if (reactionRoles.length === 0) return;

    const emojiStr = reaction.emoji.id
      ? reaction.emoji.id
      : reaction.emoji.name ?? '';

    const messageId = reaction.message.id;

    for (const rr of reactionRoles) {
      if (rr.messageId !== messageId) continue;

      const storedEmoji = rr.emoji;
      if (emojiStr !== storedEmoji && reaction.emoji.name !== storedEmoji) continue;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) continue;

      await member.roles.remove(rr.roleId).catch((err) => {
        logger.error(`Failed to remove role ${rr.roleId} from ${user.id}`, err);
      });

      logger.info(`Removed role "${rr.roleName}" from ${user.id} via reaction remove on msg ${messageId}`);
    }
  } catch (error) {
    logger.error('Error handling messageReactionRemove', error);
  }
}
