/**
 * Feed Helpers - Utilities for posting to Discord feed channels
 *
 * Handles posting session completion cards, level-ups, achievements, and
 * streak milestones to configured feed channels.
 */

import {
  CommandInteraction,
  ModalSubmitInteraction,
  TextChannel,
  PermissionFlagsBits,
  AttachmentBuilder,
  EmbedBuilder,
} from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { PostImageService } from '../services/postImage';
import { PostService } from '../services/posts';
import { formatDuration } from './formatters';
import { getServerConfig } from './serverHelpers';
import { createLogger } from './logger';

const logger = createLogger('FeedHelpers');

// Singleton instances
const postImageService = new PostImageService();

/**
 * Post a completed session to the feed channel
 */
export async function postSessionToFeed(
  db: Firestore,
  interaction: CommandInteraction | ModalSubmitInteraction,
  userId: string,
  username: string,
  avatarUrl: string,
  activity: string,
  title: string,
  description: string,
  duration: number,
  endTime: Timestamp,
  sessionId: string,
  xpGained: number,
  levelGained?: number,
  achievements?: Array<{ id: string; name: string; description?: string }>,
  intensity?: number
): Promise<void> {
  try {
    const guildId = interaction.guildId;
    if (!guildId) {
      logger.warn('No guild ID, skipping feed post');
      return;
    }

    // Get server config
    const config = await getServerConfig(db, guildId);
    if (!config || !config.feedChannelId) {
      logger.info('No feed channel configured, skipping post');
      return;
    }

    // Get feed channel
    const channel = await interaction.client.channels.fetch(config.feedChannelId);
    if (!channel || !channel.isTextBased()) {
      logger.error('Feed channel not found or not text-based');
      return;
    }

    const textChannel = channel as TextChannel;

    // Check bot permissions
    const botMember = await interaction.guild?.members.fetch(interaction.client.user!.id);
    const permissions = textChannel.permissionsFor(botMember!);

    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      logger.error('Bot lacks Send Messages permission in feed channel');
      return;
    }

    if (!permissions?.has(PermissionFlagsBits.AttachFiles)) {
      logger.error('Bot lacks Attach Files permission in feed channel');
      return;
    }

    // Format data for image
    const durationStr = formatDuration(duration);
    const dateStr = endTime.toDate().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Generate session post image
    const imageBuffer = await postImageService.generateSessionPostImage(
      username,
      durationStr,
      xpGained,
      activity,
      intensity || 3,
      avatarUrl,
      title,
      description,
      dateStr
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `session-${sessionId}.png`,
      description: `${username}'s session: ${title}`,
    });

    // Build additional info text if level-up or achievements
    let additionalContent = '';
    if (levelGained) {
      additionalContent += `🎉 **${username} leveled up to Level ${levelGained}!**\n`;
    }
    if (achievements && achievements.length > 0) {
      const achievementNames = achievements.map(a => a.name).join(', ');
      additionalContent += `🏆 **New Achievements:** ${achievementNames}\n`;
    }

    // Post to feed
    const message = await textChannel.send({
      content: additionalContent || undefined,
      files: [attachment],
    });

    // Create post record in database
    const postService = new PostService(db);
    await postService.createSessionPost(
      message.id,
      userId,
      username,
      guildId,
      config.feedChannelId,
      sessionId,
      duration,
      xpGained,
      levelGained,
      achievements?.map(a => a.id)
    );

    logger.info(`Posted session to feed: ${message.id} for user ${username}`);
  } catch (error) {
    logger.error('Error posting to feed:', error);
    // Don't throw - feed posting failure shouldn't break session completion
  }
}

/**
 * Post a level-up celebration to the feed channel
 */
export async function postLevelUpToFeed(
  db: Firestore,
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  avatarUrl: string,
  newLevel: number,
  oldLevel: number
): Promise<void> {
  try {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const config = await getServerConfig(db, guildId);
    if (!config || !config.feedChannelId) return;

    const channel = await interaction.client.channels.fetch(config.feedChannelId);
    if (!channel || !channel.isTextBased()) return;

    const textChannel = channel as TextChannel;

    // Create level-up embed
    const embed = new EmbedBuilder()
      .setColor(0xFFD700) // Gold
      .setTitle('🎉 Level Up!')
      .setDescription(`**${username}** advanced from Level ${oldLevel} to **Level ${newLevel}**!`)
      .setThumbnail(avatarUrl)
      .setTimestamp();

    await textChannel.send({ embeds: [embed] });
    logger.info(`Posted level-up for ${username}: ${oldLevel} → ${newLevel}`);
  } catch (error) {
    logger.error('Error posting level-up:', error);
  }
}

/**
 * Post a streak milestone celebration to the feed channel
 */
export async function postStreakMilestoneToFeed(
  db: Firestore,
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  avatarUrl: string,
  currentStreak: number
): Promise<void> {
  try {
    // Only post for milestone streaks (7, 14, 30, 60, 90, 180, 365 days)
    const milestones = [7, 14, 30, 60, 90, 180, 365];
    if (!milestones.includes(currentStreak)) {
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) return;

    const config = await getServerConfig(db, guildId);
    if (!config || !config.feedChannelId) return;

    const channel = await interaction.client.channels.fetch(config.feedChannelId);
    if (!channel || !channel.isTextBased()) return;

    const textChannel = channel as TextChannel;

    // Create streak embed
    const embed = new EmbedBuilder()
      .setColor(0xFF4500) // Orange-red (fire color)
      .setTitle('🔥 Streak Milestone!')
      .setDescription(`**${username}** is on fire with a **${currentStreak}-day streak**! 🔥`)
      .setThumbnail(avatarUrl)
      .setTimestamp();

    await textChannel.send({ embeds: [embed] });
    logger.info(`Posted streak milestone for ${username}: ${currentStreak} days`);
  } catch (error) {
    logger.error('Error posting streak milestone:', error);
  }
}

/**
 * Post achievement unlock celebration to the feed channel
 */
export async function postAchievementUnlockToFeed(
  db: Firestore,
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  avatarUrl: string,
  achievementIds: string[] // Achievement IDs
): Promise<void> {
  try {
    if (!achievementIds || achievementIds.length === 0) return;

    const guildId = interaction.guildId;
    if (!guildId) return;

    const config = await getServerConfig(db, guildId);
    if (!config || !config.feedChannelId) return;

    const channel = await interaction.client.channels.fetch(config.feedChannelId);
    if (!channel || !channel.isTextBased()) return;

    const textChannel = channel as TextChannel;

    // Create achievement embed
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6) // Purple
      .setTitle('🏆 Achievement Unlocked!')
      .setDescription(
        `**${username}** unlocked ${achievementIds.length} new achievement${achievementIds.length > 1 ? 's' : ''}!`
      )
      .setThumbnail(avatarUrl)
      .setTimestamp();

    await textChannel.send({ embeds: [embed] });
    logger.info(`Posted achievement unlock for ${username}: ${achievementIds.join(', ')}`);
  } catch (error) {
    logger.error('Error posting achievement unlock:', error);
  }
}
