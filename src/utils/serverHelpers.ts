/**
 * Server Helper Utilities
 *
 * Common helper functions for server configuration and feed channel operations.
 */

import {
  CommandInteraction,
  ModalSubmitInteraction,
  TextChannel,
  PermissionFlagsBits,
  AttachmentBuilder,
  Client,
} from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { ServerConfig } from '../types';
import { sessionStartImageService } from '../services/sessionStartImage';
import { timedSessionImageService } from '../services/timedSessionImage';
import { createLogger } from './logger';

const logger = createLogger('ServerHelpers');

/**
 * Get server configuration from Firestore
 */
export async function getServerConfig(
  db: Firestore,
  serverId: string
): Promise<ServerConfig | null> {
  const doc = await db
    .collection('discord-data')
    .doc('serverConfig')
    .collection('configs')
    .doc(serverId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as ServerConfig;
}

/**
 * Post session start notification to feed channel
 */
export async function postSessionStartToFeed(
  db: Firestore,
  client: Client,
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  userId: string,
  avatarUrl: string,
  activity: string
): Promise<void> {
  try {
    const config = await getServerConfig(db, interaction.guildId!);

    if (!config || !config.feedChannelId) {
      // No feed channel configured - skip posting
      return;
    }

    const channel = await client.channels.fetch(config.feedChannelId);

    if (!channel || !channel.isTextBased()) {
      logger.error('Feed channel not found or not text-based');
      return;
    }

    const textChannel = channel as TextChannel;

    // Check bot permissions in the channel
    const botMember = await interaction.guild?.members.fetch(client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
      logger.error(
        `Bot lacks 'View Channel' permission in feed channel ${config.feedChannelId}`
      );
      return;
    }

    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      logger.error(
        `Bot lacks 'Send Messages' permission in feed channel ${config.feedChannelId}`
      );
      return;
    }

    // Generate the session start image
    const imageBuffer =
      await sessionStartImageService.generateSessionStartImage(
        username,
        avatarUrl,
        activity
      );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `live-${userId}.png`,
      description: `${username} is live now!`,
    });

    await textChannel.send({
      files: [attachment],
    });
  } catch (error: unknown) {
    // Log detailed error for debugging
    const discordError = error as { code?: number };
    if (discordError.code === 50001) {
      logger.error(
        `Bot lacks access to feed channel. Please ensure the bot has 'View Channel' permission.`
      );
    } else if (discordError.code === 50013) {
      logger.error(
        `Bot lacks permissions in feed channel. Please ensure the bot has 'Send Messages' and 'Embed Links' permissions.`
      );
    } else {
      logger.error('Error posting session start to feed', error);
    }
    // Don't throw - we don't want to fail the session start
  }
}

/**
 * Post timed session start notification to feed channel
 */
export async function postTimedSessionStartToFeed(
  db: Firestore,
  client: Client,
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  userId: string,
  avatarUrl: string,
  activity: string,
  durationText: string
): Promise<void> {
  try {
    const config = await getServerConfig(db, interaction.guildId!);

    if (!config || !config.feedChannelId) {
      // No feed channel configured - skip posting
      return;
    }

    const channel = await client.channels.fetch(config.feedChannelId);

    if (!channel || !channel.isTextBased()) {
      logger.error('Feed channel not found or not text-based');
      return;
    }

    const textChannel = channel as TextChannel;

    // Check bot permissions in the channel
    const botMember = await interaction.guild?.members.fetch(client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
      logger.error(
        `Bot lacks 'View Channel' permission in feed channel ${config.feedChannelId}`
      );
      return;
    }

    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      logger.error(
        `Bot lacks 'Send Messages' permission in feed channel ${config.feedChannelId}`
      );
      return;
    }

    // Generate the timed session start image
    const imageBuffer =
      await timedSessionImageService.generateTimedSessionImage(
        username,
        avatarUrl,
        activity,
        durationText
      );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `timer-${userId}.png`,
      description: `${username} started a ${durationText} focus session`,
    });

    await textChannel.send({
      files: [attachment],
    });
  } catch (error: unknown) {
    // Log detailed error for debugging
    const discordError = error as { code?: number };
    if (discordError.code === 50001) {
      logger.error(
        `Bot lacks access to feed channel. Please ensure the bot has 'View Channel' permission.`
      );
    } else if (discordError.code === 50013) {
      logger.error(
        `Bot lacks permissions in feed channel. Please ensure the bot has 'Send Messages' and 'Embed Links' permissions.`
      );
    } else {
      logger.error('Error posting timed session start to feed', error);
    }
    // Don't throw - we don't want to fail the timer start
  }
}
