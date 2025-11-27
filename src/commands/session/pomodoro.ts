/**
 * /pomodoro Command
 *
 * Starts an automated Pomodoro timer with focus and break cycles.
 * User specifies focus length, break length, and number of cycles.
 * The bot automatically sends notifications for breaks and focus periods.
 *
 * Usage:
 * /pomodoro focus:25 break:5 cycles:3
 *   - Creates a session with 3 cycles of 25-second focus + 5-second break
 *   - Total session time: 3 * (25 + 5) = 90 seconds
 *
 * Note: All times are in SECONDS for testing purposes
 */

import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../types';
import { SessionService } from '../../services/sessions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PomodoroCommand');

// Store active Pomodoro sessions: userId -> PomodoroSession
const activePomodoroSessions = new Map<string, PomodoroSession>();

interface PomodoroSession {
  userId: string;
  username: string;
  guildId: string;
  focusLength: number;    // in seconds
  breakLength: number;    // in seconds
  totalCycles: number;
  currentCycle: number;   // 1-based
  phase: 'focus' | 'break';
  timer: NodeJS.Timeout | null;
  startTime: Date;
  remainingSeconds?: number; // Time remaining in current phase when paused
  lastPauseTime?: Date;
}

/**
 * Send a DM notification to the user
 */
async function sendNotification(client: any, userId: string, message: string): Promise<void> {
  try {
    const user = await client.users.fetch(userId);
    await user.send(message);
    logger.info(`Notification sent to user ${userId}: ${message}`);
  } catch (error) {
    logger.error(`Failed to send notification to user ${userId}:`, error);
  }
}

/**
 * Handle the transition between focus and break phases
 */
async function handlePhaseTransition(
  pomodoroSession: PomodoroSession,
  client: any,
  db: any
): Promise<void> {
  const { userId, focusLength, breakLength, totalCycles, currentCycle, phase } = pomodoroSession;

  if (phase === 'focus') {
    // Focus period just ended - start break
    pomodoroSession.phase = 'break';

    await sendNotification(
      client,
      userId,
      `✅ **Focus period ${currentCycle}/${totalCycles} complete!**\n\n🧘 Take a ${breakLength}-second break.`
    );

    // Schedule next transition (after break)
    pomodoroSession.timer = setTimeout(async () => {
      await handlePhaseTransition(pomodoroSession, client, db);
    }, breakLength * 1000);

  } else {
    // Break just ended
    if (currentCycle < totalCycles) {
      // More cycles remaining - start next focus period
      pomodoroSession.currentCycle += 1;
      pomodoroSession.phase = 'focus';

      await sendNotification(
        client,
        userId,
        `🔔 **Break over!**\n\n💪 Let's get back to focusing. Starting cycle ${pomodoroSession.currentCycle}/${totalCycles}.`
      );

      // Schedule next transition (after focus)
      pomodoroSession.timer = setTimeout(async () => {
        await handlePhaseTransition(pomodoroSession, client, db);
      }, focusLength * 1000);

    } else {
      // All cycles complete - end Pomodoro session
      await completePomodoroSession(pomodoroSession, client, db);
    }
  }
}

/**
 * Complete the Pomodoro session and offer edit with auto-post
 */
async function completePomodoroSession(
  pomodoroSession: PomodoroSession,
  client: any,
  db: any
): Promise<void> {
  const { userId, username, guildId, focusLength, totalCycles } = pomodoroSession;

  try {
    // Import required services for XP calculation
    const { StatsService } = await import('../../services/stats');
    const { GroupService } = await import('../../services/groups');
    const { calculateUserLevelBonus } = await import('../../utils/xp');
    const { formatDuration } = await import('../../utils/formatters');

    // Calculate total focus time (only count focus periods, not breaks)
    const totalFocusDuration = totalCycles * focusLength;
    const durationStr = formatDuration(totalFocusDuration);

    // Calculate user level XP bonus
    const statsService = new StatsService(db);
    const userStats = await statsService.getUserStats(userId);
    const userLevelBonus = (userStats && userStats.xp) ? calculateUserLevelBonus(userStats.xp) : 0;

    // Check if user is in a group to apply XP bonus
    let groupXpBonus = 0;
    let groupBonusPercentage = 0;
    try {
      const groupService = new GroupService(db);
      const userGroupData = await groupService.getUserGroup(userId);
      if (userGroupData) {
        const groupLevel = userGroupData.group.level || 1;
        groupXpBonus = Math.min(0.5, groupLevel * 0.01);
        groupBonusPercentage = Math.round(groupXpBonus * 100);
      }
    } catch (error) {
      logger.error('Error fetching group for XP bonus:', error);
    }

    // Calculate XP (10 XP per hour base rate)
    const baseXP = Math.floor((totalFocusDuration / 3600) * 10);
    const intensityMultiplier = 1.0; // Default to normal intensity (will be editable)
    const totalMultiplier = 1 + groupXpBonus + userLevelBonus;
    const totalXP = Math.floor(baseXP * intensityMultiplier * totalMultiplier);

    // Prepare bonus text
    let bonusText = '';
    if (groupBonusPercentage > 0 || userLevelBonus > 0) {
      bonusText = '\n**Bonuses:**';
      if (groupBonusPercentage > 0) {
        bonusText += `\n• Group Bonus: +${groupBonusPercentage}%`;
      }
      if (userLevelBonus > 0) {
        bonusText += `\n• Level Bonus: +${Math.round(userLevelBonus * 100)}%`;
      }
    }

    // Fetch the user
    const user = await client.users.fetch(userId);

    // Send DM with edit button
    const editButton = new ButtonBuilder()
      .setCustomId(`pomodoro_edit_${userId}`)
      .setLabel('Edit Session Details')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(editButton);

    const message = await user.send({
      content:
        `🎉 **Pomodoro Complete!**\n\n` +
        `You completed **${durationStr}** of focused time!\n\n` +
        `**XP Earned:** ${totalXP} XP${bonusText}\n\n` +
        `You can edit the session details now, or it will automatically post to the feed in 10 minutes.\n\n` +
        `_Click the button below to customize your session details._`,
      components: [row],
    });

    logger.info(`Pomodoro completion notification sent to user ${userId}`);

    // Set auto-post timeout (10 minutes)
    const autoPostTimeout = setTimeout(async () => {
      try {
        await autoPostPomodoroSession(userId, db, client, message, totalFocusDuration);
      } catch (error) {
        logger.error(`Error auto-posting Pomodoro session for user ${userId}:`, error);
      }
    }, 10 * 60 * 1000); // 10 minutes

    // Store the auto-post timeout so we can cancel it if user clicks edit
    (global as any).autoPostTimeouts = (global as any).autoPostTimeouts || new Map();
    (global as any).autoPostTimeouts.set(userId, autoPostTimeout);

    // Clean up Pomodoro session tracking
    activePomodoroSessions.delete(userId);

    logger.info(`Pomodoro session completed for user ${userId}`);
  } catch (error) {
    logger.error(`Error completing Pomodoro session for user ${userId}:`, error);
    // If DM fails, try auto-posting immediately
    try {
      await autoPostPomodoroSession(userId, db, client, null, totalCycles * focusLength);
    } catch (autoPostError) {
      logger.error(`Error auto-posting Pomodoro session after DM failure for user ${userId}:`, autoPostError);
    }
    activePomodoroSessions.delete(userId);
  }
}

/**
 * Auto-post Pomodoro session to feed with default values
 */
async function autoPostPomodoroSession(
  userId: string,
  db: any,
  client: any,
  originalMessage: any,
  focusDuration: number
): Promise<void> {
  logger.info(`Auto-posting Pomodoro session for user ${userId}`);

  // Clean up the timeout from global map
  const autoPostTimeouts = (global as any).autoPostTimeouts;
  if (autoPostTimeouts) {
    autoPostTimeouts.delete(userId);
  }

  try {
    const { SessionService } = await import('../../services/sessions');
    const { StatsService } = await import('../../services/stats');
    const { GroupService } = await import('../../services/groups');
    const { AchievementService } = await import('../../services/achievements');
    const { getAchievement } = await import('../../data/achievements');
    const { Timestamp } = await import('firebase-admin/firestore');
    const { calculateLevel, calculateUserLevelBonus } = await import('../../utils/xp');
    const { postSessionToFeed, postStreakMilestoneToFeed, postAchievementUnlockToFeed, postLevelUpToFeed } = await import('../../utils/feedHelpers');

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
            content: `✅ **Session Already Completed!**\n\nYour Pomodoro session was already posted to the feed.`,
            components: [], // Remove the edit button
          });
        } catch (error) {
          logger.error('Failed to update original message:', error);
        }
      }
      return;
    }

    const endTime = Timestamp.now();

    // Generate default values
    const title = 'Pomodoro Session';
    const description = 'Completed a focused Pomodoro session';
    const activity = 'Focused Work';
    const intensity = 3; // Default medium intensity

    // DELETE ACTIVE SESSION FIRST
    await sessionService.deleteActiveSession(userId);

    // Create completed session with focus duration (not including breaks)
    const sessionId = await sessionService.createCompletedSession({
      userId,
      username: session.username,
      serverId: session.serverId,
      activity,
      title,
      description,
      duration: focusDuration,
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

    // Update stats and award XP (using focus duration only)
    const statsUpdate = await statsService.updateUserStats(
      userId,
      session.username,
      focusDuration,
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
          content: `✅ **Pomodoro Session Auto-Posted!**\n\nYour session has been automatically posted to the feed with default details.`,
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
      focusDuration,
      endTime,
      sessionId,
      statsUpdate.xpGained,
      statsUpdate.leveledUp ? statsUpdate.newLevel : undefined,
      newAchievements.length > 0 ? newAchievements : undefined,
      intensity
    );

    // Store feed message ID in session record
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

    logger.info(`Pomodoro session auto-posted successfully for user ${userId}`);
  } catch (error) {
    logger.error(`Error auto-posting Pomodoro session for user ${userId}:`, error);
  }
}

/**
 * Cancel an active Pomodoro session
 */
export async function cancelPomodoroSession(userId: string, db: any): Promise<boolean> {
  const pomodoroSession = activePomodoroSessions.get(userId);

  if (!pomodoroSession) {
    return false;
  }

  // Clear the timer
  if (pomodoroSession.timer) {
    clearTimeout(pomodoroSession.timer);
  }

  // Delete active session from database
  const sessionService = new SessionService(db);
  await sessionService.deleteActiveSession(userId);

  // Remove from tracking
  activePomodoroSessions.delete(userId);

  logger.info(`Pomodoro session cancelled for user ${userId}`);
  return true;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pomodoro')
    .setDescription('Start an automated Pomodoro timer with focus/break cycles')
    .addIntegerOption((option) =>
      option
        .setName('focus')
        .setDescription('Focus period length in seconds')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3600)
    )
    .addIntegerOption((option) =>
      option
        .setName('break')
        .setDescription('Break period length in seconds')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3600)
    )
    .addIntegerOption((option) =>
      option
        .setName('cycles')
        .setDescription('Number of focus/break cycles')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    ),

  async execute(interaction, context) {
    const { db, client } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;
    const focusLength = interaction.options.getInteger('focus', true);
    const breakLength = interaction.options.getInteger('break', true);
    const cycles = interaction.options.getInteger('cycles', true);

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    // Calculate total session time
    const totalDuration = cycles * (focusLength + breakLength);
    const totalMinutes = Math.floor(totalDuration / 60);
    const totalSeconds = totalDuration % 60;

    logger.info(
      `User ${user.username} (${user.id}) starting Pomodoro: ` +
      `${focusLength}s focus, ${breakLength}s break, ${cycles} cycles (${totalDuration}s total)`
    );

    try {
      // Initialize session service
      const sessionService = new SessionService(db);

      // Check if user already has an active session
      const existingSession = await sessionService.getActiveSession(user.id);

      if (existingSession) {
        logger.warn(`User ${user.id} already has an active session`);
        await interaction.reply({
          content:
            'You already have an active session! Use `/stop` to complete it first, or `/cancel` to cancel it.',
          ephemeral: true,
        });
        return;
      }

      // Create active session in database
      await sessionService.createActiveSession(
        user.id,
        user.username,
        guildId
      );

      logger.info(`Pomodoro session created in database for user ${user.id}`);

      // Create Pomodoro session tracker
      const pomodoroSession: PomodoroSession = {
        userId: user.id,
        username: user.username,
        guildId,
        focusLength,
        breakLength,
        totalCycles: cycles,
        currentCycle: 1,
        phase: 'focus',
        timer: null,
        startTime: new Date(),
      };

      // Schedule first phase transition (after first focus period)
      pomodoroSession.timer = setTimeout(async () => {
        await handlePhaseTransition(pomodoroSession, client, db);
      }, focusLength * 1000);

      // Store the Pomodoro session
      activePomodoroSessions.set(user.id, pomodoroSession);

      // Reply to user
      const durationText = totalMinutes > 0
        ? `${totalMinutes}m ${totalSeconds}s`
        : `${totalSeconds}s`;

      await interaction.reply({
        content:
          `🍅 **Pomodoro timer started!**\n\n` +
          `**Configuration:**\n` +
          `• Focus: ${focusLength}s\n` +
          `• Break: ${breakLength}s\n` +
          `• Cycles: ${cycles}\n` +
          `• Total time: ${durationText}\n\n` +
          `💪 Starting cycle 1/${cycles}. Focus time!\n\n` +
          `_I'll send you DM notifications for breaks and focus periods._`,
        ephemeral: true,
      });

      logger.info(`Pomodoro timer scheduled for user ${user.id}`);

    } catch (error) {
      logger.error('Error starting Pomodoro session:', error);
      await interaction.reply({
        content: 'Failed to start Pomodoro session. Please try again later.',
        ephemeral: true,
      }).catch(() => {
        // Ignore if reply fails
      });
    }
  },
};

/**
 * Pause a Pomodoro session timer
 */
export function pausePomodoroTimer(userId: string): boolean {
  const pomodoroSession = activePomodoroSessions.get(userId);

  if (!pomodoroSession || !pomodoroSession.timer) {
    return false; // No active Pomodoro timer
  }

  // Clear the current timeout
  clearTimeout(pomodoroSession.timer);
  pomodoroSession.timer = null;

  // Calculate remaining time in current phase
  const now = new Date();
  const elapsed = (now.getTime() - pomodoroSession.startTime.getTime()) / 1000;
  const phaseLength = pomodoroSession.phase === 'focus' ? pomodoroSession.focusLength : pomodoroSession.breakLength;
  const remaining = Math.max(0, phaseLength - elapsed);

  // Update session with remaining time
  pomodoroSession.remainingSeconds = remaining;
  pomodoroSession.lastPauseTime = now;
  activePomodoroSessions.set(userId, pomodoroSession);

  logger.info(`Pomodoro timer paused for user ${userId}. Phase: ${pomodoroSession.phase}, Remaining: ${remaining}s`);
  return true;
}

/**
 * Resume a paused Pomodoro session timer
 */
export async function resumePomodoroTimer(userId: string, client: any, db: any): Promise<boolean> {
  const pomodoroSession = activePomodoroSessions.get(userId);

  if (!pomodoroSession || pomodoroSession.timer !== null) {
    return false; // No paused Pomodoro session or already running
  }

  const remaining = pomodoroSession.remainingSeconds || 0;

  if (remaining <= 0) {
    // Phase already expired, transition immediately
    await handlePhaseTransition(pomodoroSession, client, db);
    return true;
  }

  // Update start time to now (for future pause calculations)
  pomodoroSession.startTime = new Date();
  delete pomodoroSession.lastPauseTime;

  // Reschedule timer with remaining time
  pomodoroSession.timer = setTimeout(async () => {
    await handlePhaseTransition(pomodoroSession, client, db);
  }, remaining * 1000);

  activePomodoroSessions.set(userId, pomodoroSession);

  logger.info(`Pomodoro timer resumed for user ${userId}. Phase: ${pomodoroSession.phase}, Remaining: ${remaining}s`);
  return true;
}

// Export for use by other commands
export { activePomodoroSessions };
