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
import { AchievementService } from '../../services/achievements';
import { calculateDuration, formatDuration } from '../../utils/formatters';
import { calculateLevel } from '../../utils/xp';
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
    const statsService = new StatsService(db);
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

    // Create completed session
    const sessionId = await sessionService.createCompletedSession({
      userId: user.id,
      username: user.username,
      serverId: guildId!,
      activity: session.activity,
      title,
      description,
      duration,
      startTime: session.startTime,
      endTime,
      intensity,
    });

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

    // Update stats and award XP (with group bonus)
    const statsUpdate = await statsService.updateUserStats(
      user.id,
      user.username,
      duration,
      session.activity,
      intensity,
      groupXpBonus
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

    // Check for new achievements
    const newAchievements = await achievementService.checkAndAwardAchievements(user.id);

    const durationStr = formatDuration(duration);

    let xpMessage = '';
    if (statsUpdate.leveledUp) {
      xpMessage = `\n\n🎉 **LEVEL UP!** You're now Level ${statsUpdate.newLevel}!\n⚡ +${statsUpdate.xpGained} XP earned`;
    } else {
      xpMessage = `\n\n⚡ +${statsUpdate.xpGained} XP earned`;
    }

    await interaction.editReply({
      content: `✅ Session completed! (${durationStr})${xpMessage}\n\nYour session has been saved.`,
    });

    // TODO: Post to feed channel (needs migration of feed helpers from bot.legacy.ts)
    // TODO: Post celebration messages (streak milestones, achievements, level-ups)

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
