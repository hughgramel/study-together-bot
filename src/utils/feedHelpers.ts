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
import { GroupService } from '../services/groups';
import { levelUpImageService } from '../services/levelUpImage';
import { achievementUnlockImageService } from '../services/achievementUnlockImage';
import { formatDuration } from './formatters';
import { getServerConfig } from './serverHelpers';
import { createLogger } from './logger';
import { xpForLevel } from './xp';

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
      timeZone: 'America/Los_Angeles', // Pacific Time
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Get user's group info
    const groupService = new GroupService(db);
    const userGroupData = await groupService.getUserGroup(userId);
    const groupName = userGroupData?.group.name;

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
      dateStr,
      groupName
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `session-${sessionId}.png`,
      description: `${username}'s session: ${title}`,
    });

    // Post to feed (no text content - images only)
    const message = await textChannel.send({
      files: [attachment],
    });

    // Add heart reaction
    try {
      await message.react('❤️');
    } catch (error) {
      logger.warn('Failed to add reaction to feed post:', error);
    }

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

    // Calculate hours to next level
    const currentLevelXp = xpForLevel(newLevel);
    const nextLevelXp = xpForLevel(newLevel + 1);
    const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
    const hoursToNext = Math.round(xpNeededForNextLevel / 100); // Assuming ~100 XP per hour

    // Generate level-up image
    const imageBuffer = await levelUpImageService.generateLevelUpImage(
      username,
      avatarUrl,
      newLevel,
      hoursToNext
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `levelup-${username}-${newLevel}.png`,
      description: `${username} leveled up to ${newLevel}!`,
    });

    await textChannel.send({ files: [attachment] });
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

    // Get achievement data from IDs
    const { getAchievement } = await import('../data/achievements');
    const achievements = achievementIds
      .map(id => getAchievement(id))
      .filter(a => a !== undefined)
      .map(a => ({
        emoji: a!.emoji,
        name: a!.name,
        description: a!.description,
        xpReward: a!.xpReward,
      }));

    if (achievements.length === 0) {
      logger.warn('No valid achievements found for IDs:', achievementIds);
      return;
    }

    // Generate achievement unlock image
    const imageBuffer = await achievementUnlockImageService.generateAchievementUnlockImage(
      username,
      avatarUrl,
      achievements
    );

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `achievement-${username}-${Date.now()}.png`,
      description: `${username} unlocked ${achievements.length} achievement${achievements.length > 1 ? 's' : ''}!`,
    });

    await textChannel.send({ files: [attachment] });
    logger.info(`Posted achievement unlock for ${username}: ${achievementIds.join(', ')}`);
  } catch (error) {
    logger.error('Error posting achievement unlock:', error);
  }
}
