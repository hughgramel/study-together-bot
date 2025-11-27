/**
 * End Session Modal Handler
 *
 * Handles the modal submission when users complete a session via /stop command.
 * Processes session completion, calculates XP with group bonuses, updates stats,
 * and posts to the feed channel.
 */

import { ModalSubmitInteraction, Client } from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { calculateDuration, formatDuration } from '../../utils/formatters';
import { calculateLevel, calculateUserLevelBonus } from '../../utils/xp';
import {
  postSessionToFeed,
  postLevelUpToFeed,
  postStreakMilestoneToFeed,
} from '../../utils/feedHelpers';
import { checkLevelUpRoles } from '../../services/levelRoles';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EndSessionModal');

/**
 * Handle end session modal submission
 */
export async function handleEndSessionModal(
  interaction: ModalSubmitInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  try {
    const user = interaction.user;
    const guildId = interaction.guildId;

    // Get modal inputs
    const activity = interaction.fields.getTextInputValue('activity');
    const title = interaction.fields.getTextInputValue('title');
    const description = interaction.fields.getTextInputValue('description');
    const intensityStr = interaction.fields.getTextInputValue('intensity');

    // Validate and parse intensity (1-5 scale)
    const intensity = parseInt(intensityStr, 10);
    if (isNaN(intensity) || intensity < 1 || intensity > 5) {
      await interaction.reply({
        content: '❌ Invalid intensity value. Please enter a number between 1 and 5.',
        ephemeral: true,
      });
      return;
    }

    // Defer reply immediately to prevent timeout (we have complex processing ahead)
    await interaction.deferReply({ ephemeral: false });

    // Initialize services
    const sessionService = new SessionService(db);
    const statsService = new StatsService(db, client);
    const groupService = new GroupService(db);

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

    // Create completed session
    const sessionId = await sessionService.createCompletedSession({
      userId: user.id,
      username: user.username,
      serverId: guildId!,
      activity, // Now from modal input instead of session
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
        // Formula: 1% per level, capped at 50%
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
      guildId || undefined,
      session.activity,
      intensity,
      groupXpBonus,
      userLevelBonus
    );

    // Update completed session with XP gained (for leaderboards)
    await sessionService.updateCompletedSessionXP(sessionId, statsUpdate.xpGained);

    // Update group stats if user is in a group (always update, not just when bonus > 0)
    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      if (userGroupData) {
        await groupService.updateGroupStats(userGroupData.group.groupId);
        logger.info(`Updated group stats for ${userGroupData.group.name}`);
      }
    } catch (error) {
      logger.error('Error updating group stats:', error);
      // Don't fail the session completion if group update fails
    }

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

    // Get user's avatar URL
    const avatarUrl = user.displayAvatarURL({ size: 128 });

    // Post to feed channel and get message ID
    const feedMessageId = await postSessionToFeed(
      db,
      interaction,
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
      undefined, // No old achievements
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
        interaction,
        user.username,
        avatarUrl,
        updatedStats.currentStreak
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
        interaction,
        user.username,
        avatarUrl,
        statsUpdate.newLevel,
        oldLevel
      );

      // Update user's Discord role based on new level
      if (guildId) {
        try {
          const roleChanges = await checkLevelUpRoles(
            db,
            client,
            guildId,
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
    }

    logger.info(`Session completed successfully for user ${user.username} (${user.id})`);
  } catch (error) {
    logger.error('Error handling end session modal:', error);

    const errorMessage = 'An error occurred while completing your session. Please try again.';

    try {
      // We always defer at the start, so use editReply
      await interaction.editReply({ content: errorMessage });
    } catch (replyError) {
      logger.error('Could not send error message to user:', replyError);
    }
  }
}
