/**
 * Timer End Session Modal Handler
 *
 * Handles the modal submission when users complete a timer session via the edit button.
 * This is similar to endSessionModal but specifically for timer-based sessions.
 */

import { ModalSubmitInteraction, Client } from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { AchievementService } from '../../services/achievements';
import { getAchievement } from '../../data/achievements';
import { calculateDuration, formatDuration } from '../../utils/formatters';
import { calculateLevel, calculateUserLevelBonus } from '../../utils/xp';
import {
  postSessionToFeed,
  postLevelUpToFeed,
  postStreakMilestoneToFeed,
  postAchievementUnlockToFeed,
} from '../../utils/feedHelpers';
import { checkLevelUpRoles } from '../../services/levelRoles';
import { syncUserSanRole } from '../../services/sanRoles';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TimerEndSessionModal');

/**
 * Handle timer end session modal submission
 */
export async function handleTimerEndSessionModal(
  interaction: ModalSubmitInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  try {
    const user = interaction.user;

    // Cancel the auto-post timeout if it exists (user manually submitted)
    const autoPostTimeouts = (global as any).autoPostTimeouts;
    if (autoPostTimeouts && autoPostTimeouts.has(user.id)) {
      const timeout = autoPostTimeouts.get(user.id);
      clearTimeout(timeout);
      autoPostTimeouts.delete(user.id);
      logger.info(`Cancelled auto-post for user ${user.id} (manual submission)`);
    }

    // Get modal inputs (all fields now optional with defaults)
    const activity = interaction.fields.getTextInputValue('activity') || 'Studying';
    const title = interaction.fields.getTextInputValue('title') || '';
    const description = interaction.fields.getTextInputValue('description') || '';
    const intensityStr = interaction.fields.getTextInputValue('intensity');

    // Parse intensity with default of 3 (Normal)
    let intensity = 3;
    if (intensityStr && intensityStr.trim() !== '') {
      const parsed = parseInt(intensityStr, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 5) {
        await interaction.reply({
          content: '❌ Invalid intensity value. Please enter a number between 1 and 5.',
          ephemeral: true,
        });
        return;
      }
      intensity = parsed;
    }

    // Defer reply immediately to prevent timeout
    await interaction.deferReply({ ephemeral: false });

    // Initialize services
    const sessionService = new SessionService(db);
    const statsService = new StatsService(db, client);
    const groupService = new GroupService(db);
    const achievementService = new AchievementService(db);

    // Get active session
    const session = await sessionService.getActiveSession(user.id);

    if (!session) {
      await interaction.editReply({
        content: 'No active session found! It may have been cancelled or already ended.',
      });
      return;
    }

    // Calculate final duration
    const duration = calculateDuration(
      session.startTime,
      session.pausedDuration,
      session.isPaused ? session.pausedAt : undefined
    );

    const endTime = Timestamp.now();

    // DELETE ACTIVE SESSION FIRST to prevent race condition/duplicate submissions
    await sessionService.deleteActiveSession(user.id);

    // Create completed session (use serverId from session, not from interaction)
    const sessionId = await sessionService.createCompletedSession({
      userId: user.id,
      username: user.username,
      serverId: session.serverId, // Use serverId from session (works from DMs)
      activity, // Now from modal input
      title,
      description,
      duration,
      startTime: session.startTime,
      endTime,
      intensity,
    });

    // Calculate user level XP bonus
    const userStats = await statsService.getUserStats(user.id);
    const userLevelBonus = (userStats && userStats.xp) ? calculateUserLevelBonus(userStats.xp) : 0;

    // Check if user is in a group to apply XP bonus
    let groupXpBonus = 0;
    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      if (userGroupData) {
        // Calculate group XP bonus based on group level
        const groupLevel = userGroupData.group.level || 1;
        groupXpBonus = Math.min(0.5, groupLevel * 0.01);
      }
    } catch (error) {
      logger.error('Error fetching group for XP bonus:', error);
    }

    // Update stats and award XP (with user level and group bonuses)
    const statsUpdate = await statsService.updateUserStats(
      user.id,
      user.username,
      duration,
      session.serverId, // Use serverId from session for role assignment
      session.activity,
      intensity,
      groupXpBonus,
      userLevelBonus
    );

    // Update completed session with XP gained
    await sessionService.updateCompletedSessionXP(sessionId, statsUpdate.xpGained);

    // Update group stats if user is in a group
    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      if (userGroupData) {
        await groupService.updateGroupStats(userGroupData.group.groupId);
        logger.info(`Updated group stats for ${userGroupData.group.name}`);
      }
    } catch (error) {
      logger.error('Error updating group stats:', error);
    }

    // Check for new achievements
    const newAchievementIds = await achievementService.checkAndAwardAchievements(user.id);
    const newAchievements = newAchievementIds
      .map((id) => getAchievement(id))
      .filter((a) => a !== null) as Array<{ id: string; name: string; description?: string }>;

    const durationStr = formatDuration(duration);

    // Calculate total bonus percentage for display
    const totalBonusPercent = Math.round((groupXpBonus + userLevelBonus) * 100);
    const bonusText = totalBonusPercent > 0 ? ` (+${totalBonusPercent}% bonus)` : '';

    let xpMessage = '';
    if (statsUpdate.leveledUp) {
      xpMessage = `\n\n🎉 **LEVEL UP!** You're now Level ${statsUpdate.newLevel}!\n⚡ +${statsUpdate.xpGained} XP earned${bonusText}`;
    } else {
      xpMessage = `\n\n⚡ +${statsUpdate.xpGained} XP earned${bonusText}`;
    }

    await interaction.editReply({
      content: `✅ Session completed! (${durationStr})${xpMessage}\n\nYour session has been saved and posted to the feed.`,
    });

    // Update the timer DM message to remove the button and show completion
    try {
      const dmChannel = await user.createDM();
      const messages = await dmChannel.messages.fetch({ limit: 10 });
      const timerMessage = messages.find(msg =>
        msg.author.id === client.user?.id &&
        msg.content.includes('⏰ **Timer Complete!**')
      );

      if (timerMessage) {
        await timerMessage.edit({
          content: `✅ **Session Completed!**\n\nYou've successfully posted your session to the feed with custom details.`,
          components: [], // Remove the edit button
        });
      }
    } catch (error) {
      logger.error('Failed to update timer DM message:', error);
      // Non-critical, don't fail the whole operation
    }

    // Get user's avatar URL
    const avatarUrl = user.displayAvatarURL({ size: 128 });

    // Get guild for feed posting (since interaction might be from DM)
    const guild = await client.guilds.fetch(session.serverId);

    // Create mock interaction with guild context for feed posting
    const mockInteraction = {
      ...interaction,
      guildId: session.serverId,
      guild,
      client,
    };

    // Post to feed channel and get message ID
    const feedMessageId = await postSessionToFeed(
      db,
      mockInteraction as any,
      user.id,
      user.username,
      avatarUrl,
      activity, // Now from modal input
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
    const updatedStats = await statsService.getUserStats(user.id);
    if (updatedStats) {
      // Post streak milestone celebration if applicable
      await postStreakMilestoneToFeed(
        db,
        mockInteraction as any,
        user.username,
        avatarUrl,
        updatedStats.currentStreak
      );
    }

    // Post achievement unlock celebration if applicable
    if (newAchievementIds.length > 0) {
      await postAchievementUnlockToFeed(
        db,
        mockInteraction as any,
        user.username,
        avatarUrl,
        newAchievementIds
      );
    }

    // Post level-up celebration if applicable
    if (statsUpdate.leveledUp && statsUpdate.newLevel) {
      // Calculate old level from XP
      const currentXP = statsUpdate.stats.xp || 0;
      const oldXP = currentXP - statsUpdate.xpGained;
      const oldLevel = calculateLevel(oldXP);

      await postLevelUpToFeed(
        db,
        mockInteraction as any,
        user.username,
        avatarUrl,
        statsUpdate.newLevel,
        oldLevel
      );

      // Update user's Discord role based on new level
      try {
        const roleChanges = await checkLevelUpRoles(
          db,
          client,
          session.serverId,
          user.id,
          oldLevel,
          statsUpdate.newLevel,
          currentXP
        );

        if (roleChanges.roleAdded) {
          logger.info(
            `Updated role for ${user.username}: added ${roleChanges.roleAdded}, removed ${roleChanges.rolesRemoved.length} roles`
          );
        }
      } catch (error) {
        logger.error(`Failed to update roles for user ${user.id} on level up:`, error);
        // Don't fail the session completion if role update fails
      }
    }

    // Update san-level role (non-blocking)
    if (session?.serverId) {
      const currentXP = statsUpdate.stats.xp || 0;
      syncUserSanRole(db, client, session.serverId, user.id, currentXP).catch(err =>
        logger.error(`Failed to sync san role for ${user.id}`, err)
      );
    }

    logger.info(`Timer session completed successfully for user ${user.username} (${user.id})`);
  } catch (error) {
    logger.error('Error handling timer end session modal:', error);

    const errorMessage = 'An error occurred while completing your session. Please try again.';

    try {
      // We always defer at the start, so use editReply
      await interaction.editReply({ content: errorMessage });
    } catch (replyError) {
      logger.error('Could not send error message to user:', replyError);
    }
  }
}
