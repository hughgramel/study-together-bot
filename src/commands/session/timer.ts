/**
 * Timer Helper Functions
 *
 * Shared functions for timer-based sessions (now part of /start command).
 * Handles auto-posting when timer completes without user interaction.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { AchievementService } from '../../services/achievements';
import { getAchievement } from '../../data/achievements';
import { calculateDuration } from '../../utils/formatters';
import { calculateUserLevelBonus, calculateLevel } from '../../utils/xp';
import { postSessionToFeed, postStreakMilestoneToFeed, postAchievementUnlockToFeed, postLevelUpToFeed } from '../../utils/feedHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TimerHelpers');

/**
 * Get time-based session title based on current hour
 */
function getTimeBasedSessionTitle(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'Morning Focus';
  } else if (hour >= 12 && hour < 17) {
    return 'Afternoon Focus';
  } else if (hour >= 17 && hour < 21) {
    return 'Evening Focus';
  } else if (hour >= 21 && hour < 24) {
    return 'Night Focus';
  } else if (hour >= 0 && hour < 3) {
    return 'Late Night Focus';
  } else {
    return 'Early Morning Focus';
  }
}

/**
 * Automatically post timer session with default values when user doesn't manually submit
 */
export async function autoPostTimerSession(
  userId: string,
  db: any,
  client: any,
  originalMessage: any
): Promise<void> {
  logger.info(`Auto-posting timer session for user ${userId}`);

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

    // Generate default title, description, and activity
    const title = getTimeBasedSessionTitle(); // Time-based title (Morning/Afternoon/Evening/etc)
    const description = 'Completed a focused study session';
    const activity = 'Focused Work'; // Default activity for auto-posted sessions
    const intensity = 3; // Default medium intensity

    // DELETE ACTIVE SESSION FIRST
    await sessionService.deleteActiveSession(userId);

    // Create completed session
    const sessionId = await sessionService.createCompletedSession({
      userId,
      username: session.username,
      serverId: session.serverId,
      activity,
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
      activity,
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

    // Create a mock interaction object for feed helpers
    const mockInteraction = {
      guildId: session.serverId,
      guild,
      client,
    };

    // Post to feed channel and get message ID
    const feedMessageId = await postSessionToFeed(
      db,
      mockInteraction as any,
      userId,
      session.username,
      avatarUrl,
      activity,
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

    // Store feed message ID in session record for edit functionality
    if (feedMessageId) {
      await sessionService.updateCompletedSessionFeedMessageId(sessionId, feedMessageId);
    }

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

    logger.info(`Timer session auto-posted successfully for user ${userId}`);
  } catch (error) {
    logger.error(`Error auto-posting timer session for user ${userId}:`, error);
  }
}
