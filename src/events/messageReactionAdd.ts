/**
 * Message Reaction Add Event Handler
 *
 * Grants Discord roles when users react to configured reaction-role messages.
 */

import { MessageReaction, User, Client, PartialMessageReaction, PartialUser } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { ServerConfig } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ReactionAdd');

export async function handleMessageReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  db: Firestore,
  client: Client
): Promise<void> {
  try {
    // Ignore bot reactions
    if (user.bot) return;

    // Fetch partial data if needed
    if (reaction.partial) {
      await reaction.fetch();
    }
    if (user.partial) {
      await user.fetch();
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    // Load server config
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

    // Normalize the reacted emoji to a string for comparison
    const emojiStr = reaction.emoji.id
      ? reaction.emoji.id        // custom emoji — compare by ID
      : reaction.emoji.name ?? ''; // unicode emoji

    const messageId = reaction.message.id;

    for (const rr of reactionRoles) {
      if (rr.messageId !== messageId) continue;

      // Compare stored emoji: could be an ID (custom) or unicode name
      const storedEmoji = rr.emoji;
      if (emojiStr !== storedEmoji && reaction.emoji.name !== storedEmoji) continue;

      // Fetch guild member and assign role
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) continue;

      await member.roles.add(rr.roleId).catch((err) => {
        logger.error(`Failed to add role ${rr.roleId} to ${user.id}`, err);
      });

      logger.info(`Added role "${rr.roleName}" to ${user.id} via reaction on msg ${messageId}`);
    }
  } catch (error) {
    logger.error('Error handling messageReactionAdd', error);
  }
}
