/**
 * Manual Session Modal Handler
 *
 * Handles submission of manual session logging modal.
 */

import { ModalSubmitInteraction, Client } from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { createLogger } from '../../utils/logger';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { formatDuration } from '../../utils/formatters';
import { calculateLevel, calculateUserLevelBonus } from '../../utils/xp';
import {
  postSessionToFeed,
  postLevelUpToFeed,
  postStreakMilestoneToFeed,
} from '../../utils/feedHelpers';

const logger = createLogger('ManualSessionModal');

/**
 * Parse duration string (supports formats like "2h 30m", "1h", "45m", "90m")
 */
function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();

  // Try to match "Xh Ym" or "Xh" format
  const hourMinuteMatch = trimmed.match(/(\d+)\s*h(?:\s+(\d+)\s*m)?/);
  if (hourMinuteMatch) {
    const hours = parseInt(hourMinuteMatch[1], 10);
    const minutes = hourMinuteMatch[2] ? parseInt(hourMinuteMatch[2], 10) : 0;
    return hours * 3600 + minutes * 60;
  }

  // Try to match "Ym" format only
  const minuteMatch = trimmed.match(/^(\d+)\s*m$/);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1], 10);
    return minutes * 60;
  }

  return null;
}

/**
 * Handle manual session modal submission
 */
export async function handleManualSessionModal(
  interaction: ModalSubmitInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  try {
    // Defer reply immediately to prevent double-submission
    await interaction.deferReply({ ephemeral: false });

    const user = interaction.user;
    const guildId = interaction.guildId;

    // Instantiate services
    const sessionService = new SessionService(db);
    const statsService = new StatsService(db);
    const groupService = new GroupService(db);

    // Get modal inputs
    const activity = interaction.fields.getTextInputValue('activity');
    const title = interaction.fields.getTextInputValue('title');
    const description = interaction.fields.getTextInputValue('description');
    const durationInput = interaction.fields.getTextInputValue('duration');
    const intensityStr = interaction.fields.getTextInputValue('intensity');

    // Validate and parse intensity (1-5 scale)
    const intensity = parseInt(intensityStr, 10);
    if (isNaN(intensity) || intensity < 1 || intensity > 5) {
      await interaction.editReply({
        content: '❌ Invalid intensity value. Please enter a number between 1 and 5.',
      });
      return;
    }

    // Parse duration
    const duration = parseDuration(durationInput);

    if (duration === null) {
      await interaction.editReply({
        content:
          '❌ Invalid duration format. Please use formats like "2h 30m", "1h", or "45m".',
      });
      return;
    }

    if (duration <= 0) {
      await interaction.editReply({
        content: '❌ Duration must be greater than 0.',
      });
      return;
    }

    // Create timestamps
    const endTime = Timestamp.now();
    const startTime = Timestamp.fromMillis(endTime.toMillis() - duration * 1000);

    // Create completed session
    const sessionId = await sessionService.createCompletedSession({
      userId: user.id,
      username: user.username,
      serverId: guildId!,
      activity,
      title,
      description,
      duration,
      startTime,
      endTime,
      intensity,
    });

    logger.info(
      `Created manual session ${sessionId} for user ${user.username} (${user.id}): ${formatDuration(duration)}`
    );

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
      activity,
      intensity,
      groupXpBonus,
      userLevelBonus
    );

    // Update completed session with XP gained (for leaderboards)
    await sessionService.updateCompletedSessionXP(sessionId, statsUpdate.xpGained);

    // Update group stats if user is in a group
    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      if (userGroupData) {
        await groupService.updateGroupStats(userGroupData.group.groupId);
        logger.info(
          `Updated group stats for ${userGroupData.group.name} after manual session`
        );
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
      content: `✅ Manual session logged! (${durationStr})${xpMessage}\n\nYour session has been saved and posted to the feed.`,
    });

    // Get user's avatar URL
    const avatarUrl = user.displayAvatarURL({ size: 128 });

    // Post to feed channel
    await postSessionToFeed(
      db,
      interaction,
      user.id,
      user.username,
      avatarUrl,
      activity,
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
    }

    logger.info(
      `Manual session completed for user ${user.username} (${user.id}): ${formatDuration(duration)}`
    );
  } catch (error) {
    logger.error('Error handling manual session modal:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';

    if (interaction.deferred) {
      await interaction.editReply({
        content: `❌ Failed to log manual session: ${errorMessage}`,
      });
    } else {
      await interaction.reply({
        content: `❌ Failed to log manual session: ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}
