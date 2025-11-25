/**
 * /timer Command
 *
 * Starts a countdown timer for a specified duration (in seconds for testing).
 * When the timer completes, notifies the user and offers to edit session details.
 * Auto-posts to feed after 10 seconds if not edited.
 */

import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { createLogger } from '../../utils/logger';
import { Timestamp } from 'firebase-admin/firestore';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { AchievementService } from '../../services/achievements';
import { getAchievement } from '../../data/achievements';
import { calculateDuration } from '../../utils/formatters';
import { calculateUserLevelBonus, calculateLevel } from '../../utils/xp';
import { postSessionToFeed, postStreakMilestoneToFeed, postAchievementUnlockToFeed, postLevelUpToFeed } from '../../utils/feedHelpers';

const logger = createLogger('TimerCommand');

// Store active timers: userId -> timeout ID
const activeTimers = new Map<string, NodeJS.Timeout>();

// Store timer metadata: userId -> { duration, startTime, guildId }
const timerMetadata = new Map<string, { duration: number; startTime: Date; guildId: string }>();

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timer')
    .setDescription('Start a countdown timer session')
    .addNumberOption((option) =>
      option
        .setName('duration')
        .setDescription('Duration in seconds (for testing)')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;
    const duration = interaction.options.getNumber('duration', true);

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    logger.info(`User ${user.username} (${user.id}) starting timer: ${duration}s`);

    try {
      // Initialize session service
      const sessionService = new SessionService(db);

      // Check if user already has an active session
      const existingSession = await sessionService.getActiveSession(user.id);

      if (existingSession) {
        logger.warn(`User ${user.id} already has an active session`);
        await interaction.reply({
          content:
            'You already have an active session! Use /stop to complete it first, or /cancel to cancel it.',
          ephemeral: true,
        });
        return;
      }

      // Check if user already has an active timer
      if (activeTimers.has(user.id)) {
        logger.warn(`User ${user.id} already has an active timer`);
        await interaction.reply({
          content: 'You already have an active timer running!',
          ephemeral: true,
        });
        return;
      }

      // Generate default activity name based on time of day
      const now = new Date();
      const hour = now.getHours();
      let activityName: string;

      if (hour >= 5 && hour < 12) {
        activityName = 'Morning Study Session';
      } else if (hour >= 12 && hour < 17) {
        activityName = 'Afternoon Study Session';
      } else if (hour >= 17 && hour < 21) {
        activityName = 'Evening Study Session';
      } else {
        activityName = 'Night Study Session';
      }

      // Create active session with generated activity name
      await sessionService.createActiveSession(
        user.id,
        user.username,
        guildId,
        activityName
      );

      logger.info(`Timer session created for user ${user.id}`);

      // Send initial confirmation
      await interaction.reply({
        content: `⏱️ Timer started for ${duration} seconds!\n\n**Activity:** ${activityName}\n\nI'll notify you when the time is up.`,
        ephemeral: true,
      });

      // Store timer metadata
      timerMetadata.set(user.id, {
        duration,
        startTime: now,
        guildId,
      });

      // Set timer to notify user when complete
      const timerId = setTimeout(async () => {
        try {
          await handleTimerComplete(user.id, client, db);
        } catch (error) {
          logger.error(`Error handling timer completion for user ${user.id}:`, error);
        } finally {
          // Clean up
          activeTimers.delete(user.id);
          timerMetadata.delete(user.id);
        }
      }, duration * 1000);

      // Store timer ID so we can cancel it if needed
      activeTimers.set(user.id, timerId);

      logger.info(`Timer scheduled for user ${user.id}`);
    } catch (error) {
      logger.error('Error starting timer:', error);
      await interaction.reply({
        content: 'Failed to start timer. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};

/**
 * Handle timer completion - notify user and offer edit option
 */
async function handleTimerComplete(
  userId: string,
  client: any,
  db: any
): Promise<void> {
  logger.info(`Timer completed for user ${userId}`);

  try {
    // Fetch the user
    const user = await client.users.fetch(userId);

    // Send DM with edit button
    const editButton = new ButtonBuilder()
      .setCustomId(`timer_edit_${userId}`)
      .setLabel('Edit Session Details')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(editButton);

    const message = await user.send({
      content: `⏰ **Timer Complete!**\n\nYour session has ended. You can edit the session details now, or it will automatically post to the feed in 10 seconds.\n\n_Click the button below to customize your session title and description._`,
      components: [row],
    });

    logger.info(`Timer completion notification sent to user ${userId}`);

    // Set auto-post timeout (10 seconds for testing)
    const autoPostTimeout = setTimeout(async () => {
      try {
        await autoPostSession(userId, db, client, message);
      } catch (error) {
        logger.error(`Error auto-posting session for user ${userId}:`, error);
      }
    }, 10 * 1000);

    // Store the auto-post timeout so we can cancel it if user clicks edit
    (global as any).autoPostTimeouts = (global as any).autoPostTimeouts || new Map();
    (global as any).autoPostTimeouts.set(userId, autoPostTimeout);
  } catch (error) {
    logger.error(`Failed to send timer completion notification to user ${userId}:`, error);
    // If DM fails, we should still try to auto-post the session
    setTimeout(async () => {
      try {
        await autoPostSession(userId, db, client, null);
      } catch (autoPostError) {
        logger.error(`Error auto-posting session after DM failure for user ${userId}:`, autoPostError);
      }
    }, 10 * 1000);
  }
}

/**
 * Automatically post session with default values
 */
async function autoPostSession(
  userId: string,
  db: any,
  client: any,
  originalMessage: any
): Promise<void> {
  logger.info(`Auto-posting session for user ${userId}`);

  // Clean up the timeout from global map
  const autoPostTimeouts = (global as any).autoPostTimeouts;
  if (autoPostTimeouts) {
    autoPostTimeouts.delete(userId);
  }

  try {
    const sessionService = new SessionService(db);
    const statsService = new StatsService(db);
    const groupService = new GroupService(db);
    const achievementService = new AchievementService(db);

    // Get active session
    const session = await sessionService.getActiveSession(userId);

    if (!session) {
      logger.warn(`No active session found for auto-post for user ${userId}`);
      // Update the message to indicate session was already completed
      if (originalMessage) {
        try {
          await originalMessage.edit({
            content: `✅ **Session Already Completed!**\n\nYour session was already posted to the feed.`,
            components: [], // Remove the edit button
          });
        } catch (error) {
          logger.error('Failed to update original message:', error);
        }
      }
      return;
    }

    // Calculate final duration
    const duration = calculateDuration(
      session.startTime,
      session.pausedDuration,
      session.isPaused ? session.pausedAt : undefined
    );

    const endTime = Timestamp.now();

    // Generate default title and description
    const title = session.activity;
    const description = 'Completed a focused study session.';
    const intensity = 3; // Default medium intensity

    // DELETE ACTIVE SESSION FIRST
    await sessionService.deleteActiveSession(userId);

    // Create completed session
    const sessionId = await sessionService.createCompletedSession({
      userId,
      username: session.username,
      serverId: session.serverId,
      activity: session.activity,
      title,
      description,
      duration,
      startTime: session.startTime,
      endTime,
      intensity,
    });

    // Calculate user level XP bonus
    const userStats = await statsService.getUserStats(userId);
    const userLevelBonus = (userStats && userStats.xp) ? calculateUserLevelBonus(userStats.xp) : 0;

    // Check if user is in a group to apply XP bonus
    let groupXpBonus = 0;
    try {
      const userGroupData = await groupService.getUserGroup(userId);
      if (userGroupData) {
        const groupLevel = userGroupData.group.level || 1;
        groupXpBonus = Math.min(0.5, groupLevel * 0.01);
      }
    } catch (error) {
      logger.error('Error fetching group for XP bonus:', error);
    }

    // Update stats and award XP
    const statsUpdate = await statsService.updateUserStats(
      userId,
      session.username,
      duration,
      session.activity,
      intensity,
      groupXpBonus,
      userLevelBonus
    );

    // Update completed session with XP gained
    await sessionService.updateCompletedSessionXP(sessionId, statsUpdate.xpGained);

    // Update group stats if applicable
    try {
      const userGroupData = await groupService.getUserGroup(userId);
      if (userGroupData) {
        await groupService.updateGroupStats(userGroupData.group.groupId);
      }
    } catch (error) {
      logger.error('Error updating group stats:', error);
    }

    // Check for new achievements
    const newAchievementIds = await achievementService.checkAndAwardAchievements(userId);
    const newAchievements = newAchievementIds
      .map((id) => getAchievement(id))
      .filter((a) => a !== null) as Array<{ id: string; name: string; description?: string }>;

    // Update the original message to indicate auto-post happened
    if (originalMessage) {
      try {
        await originalMessage.edit({
          content: `✅ **Session Auto-Posted!**\n\nYour session has been automatically posted to the feed with default details.`,
          components: [], // Remove the edit button
        });
      } catch (error) {
        logger.error('Failed to update original message:', error);
      }
    }

    // Fetch user for avatar
    const user = await client.users.fetch(userId);
    const avatarUrl = user.displayAvatarURL({ size: 128 });

    // Get guild to create interaction-like object for feed posting
    const guild = await client.guilds.fetch(session.serverId);
    const channel = guild.channels.cache.first();

    if (!channel) {
      logger.error('No channel found to post session');
      return;
    }

    // Create a mock interaction object for feed helpers
    const mockInteraction = {
      guildId: session.serverId,
      guild,
      channel,
    };

    // Post to feed channel
    await postSessionToFeed(
      db,
      mockInteraction as any,
      userId,
      session.username,
      avatarUrl,
      session.activity,
      title,
      description,
      duration,
      endTime,
      sessionId,
      statsUpdate.xpGained,
      statsUpdate.leveledUp ? statsUpdate.newLevel : undefined,
      newAchievements.length > 0 ? newAchievements : undefined,
      intensity
    );

    // Get updated stats to check for streak milestones
    const updatedStats = await statsService.getUserStats(userId);
    if (updatedStats) {
      await postStreakMilestoneToFeed(
        db,
        mockInteraction as any,
        session.username,
        avatarUrl,
        updatedStats.currentStreak
      );
    }

    // Post achievement unlock celebration if applicable
    if (newAchievementIds.length > 0) {
      await postAchievementUnlockToFeed(
        db,
        mockInteraction as any,
        session.username,
        avatarUrl,
        newAchievementIds
      );
    }

    // Post level-up celebration if applicable
    if (statsUpdate.leveledUp && statsUpdate.newLevel) {
      const currentXP = statsUpdate.stats.xp || 0;
      const oldXP = currentXP - statsUpdate.xpGained;
      const oldLevel = calculateLevel(oldXP);

      await postLevelUpToFeed(
        db,
        mockInteraction as any,
        session.username,
        avatarUrl,
        statsUpdate.newLevel,
        oldLevel
      );
    }

    logger.info(`Session auto-posted successfully for user ${userId}`);
  } catch (error) {
    logger.error(`Error auto-posting session for user ${userId}:`, error);
  }
}
