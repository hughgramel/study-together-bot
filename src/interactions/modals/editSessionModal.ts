/**
 * Edit Session Modal Handler
 *
 * Handles session edit modal submissions.
 * Recalculates XP, updates stats, regenerates image, and updates feed post.
 */

import { ModalSubmitInteraction, Client, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { GroupService } from '../../services/groups';
import { PostImageService } from '../../services/postImage';
import { formatDuration } from '../../utils/formatters';
import { createLogger } from '../../utils/logger';
import { getServerConfig } from '../../utils/serverHelpers';

const logger = createLogger('EditSessionModal');

const postImageService = new PostImageService();

/**
 * Handle edit session modal submission
 */
export async function handleEditSessionModal(
  interaction: ModalSubmitInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  try {
    const user = interaction.user;

    // Parse modal custom ID: editSessionModal_{sessionId}
    const sessionId = interaction.customId.split('_')[1];

    // Get modal inputs
    const activity = interaction.fields.getTextInputValue('activity');
    const title = interaction.fields.getTextInputValue('title');
    const description = interaction.fields.getTextInputValue('description');
    const durationHoursStr = interaction.fields.getTextInputValue('duration');
    const intensityStr = interaction.fields.getTextInputValue('intensity');

    // Validate and parse duration
    const durationHours = parseFloat(durationHoursStr);
    if (isNaN(durationHours) || durationHours <= 0) {
      await interaction.reply({
        content: '❌ Invalid duration. Please enter a positive number of hours.',
        ephemeral: true,
      });
      return;
    }

    // Convert hours to seconds
    const newDuration = Math.floor(durationHours * 3600);

    // Validate and parse intensity (1-5 scale)
    const newIntensity = parseInt(intensityStr, 10);
    if (isNaN(newIntensity) || newIntensity < 1 || newIntensity > 5) {
      await interaction.reply({
        content: '❌ Invalid intensity value. Please enter a number between 1 and 5.',
        ephemeral: true,
      });
      return;
    }

    // Defer reply immediately to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    // Initialize services
    const sessionService = new SessionService(db);
    const statsService = new StatsService(db);
    const groupService = new GroupService(db);

    // Get the existing session
    const session = await sessionService.getCompletedSession(sessionId);

    if (!session) {
      await interaction.editReply({
        content: '❌ Session not found. It may have been deleted.',
      });
      return;
    }

    // Authorization check - ensure user owns this session
    if (session.userId !== user.id) {
      await interaction.editReply({
        content: '❌ You can only edit your own sessions.',
      });
      return;
    }

    logger.info(`Editing session ${sessionId}: ${session.duration}s -> ${newDuration}s, intensity ${session.intensity} -> ${newIntensity}`);

    // Calculate OLD XP (what was originally awarded)
    const oldDuration = session.duration;
    const oldIntensity = session.intensity || 3;
    const oldXp = session.xpGained || 0;

    // Get user's current stats for level bonus calculation
    const userStats = await statsService.getUserStats(user.id);
    const userLevelBonus = userStats?.xp ? await import('../../utils/xp').then(m => m.calculateUserLevelBonus(userStats.xp || 0)) : 0;

    // Get group bonus (if applicable)
    let groupXpBonus = 0;
    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      if (userGroupData) {
        const groupLevel = userGroupData.group.level || 1;
        groupXpBonus = Math.min(0.5, groupLevel * 0.01);
      }
    } catch (error) {
      logger.error('Error fetching group for XP bonus:', error);
    }

    // Calculate NEW XP using the same formula
    const { calculateXpForSession } = await import('../../utils/xp');
    const newXp = calculateXpForSession(newDuration, newIntensity, groupXpBonus, userLevelBonus);

    // Calculate XP difference
    const xpDelta = newXp - oldXp;

    logger.info(`XP delta: ${xpDelta} (old: ${oldXp}, new: ${newXp})`);

    // Update user stats with XP delta
    if (xpDelta !== 0 && userStats) {
      const newTotalXp = (userStats.xp || 0) + xpDelta;
      const newTotalDuration = (userStats.totalDuration || 0) - oldDuration + newDuration;

      // Update stats
      await db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats')
        .doc(user.id)
        .update({
          xp: newTotalXp,
          totalDuration: newTotalDuration,
        });

      logger.info(`Updated user stats: XP ${userStats.xp} -> ${newTotalXp}, Duration ${userStats.totalDuration} -> ${newTotalDuration}`);
    }

    // Update group stats if in a group
    const durationDelta = newDuration - oldDuration;
    if (durationDelta !== 0) {
      try {
        const userGroupData = await groupService.getUserGroup(user.id);
        if (userGroupData) {
          await groupService.updateGroupStats(userGroupData.group.groupId);
          logger.info(`Updated group stats for ${userGroupData.group.name}`);
        }
      } catch (error) {
        logger.error('Error updating group stats:', error);
      }
    }

    // Update session record
    await db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .doc(sessionId)
      .update({
        activity,
        title,
        description,
        duration: newDuration,
        intensity: newIntensity,
        xpGained: newXp,
        editedAt: Timestamp.now(),
        editCount: (session.editCount || 0) + 1,
      });

    logger.info(`Updated session ${sessionId} in database`);

    // Regenerate image
    const durationStr = formatDuration(newDuration);
    const dateStr = session.endTime.toDate().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const avatarUrl = user.displayAvatarURL({ size: 128 });

    // Get group name if in group
    let groupName: string | undefined;
    try {
      const userGroupData = await groupService.getUserGroup(user.id);
      groupName = userGroupData?.group.name;
    } catch (error) {
      // Ignore
    }

    // Generate new image
    const imageBuffer = await postImageService.generateSessionPostImage(
      user.username,
      durationStr,
      newXp,
      activity,
      newIntensity,
      avatarUrl,
      title,
      description, // No edit indicator - Discord shows "edited" on the message
      dateStr,
      groupName
    );

    // Create new attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `session-${sessionId}.png`,
      description: `${user.username}'s session: ${title}`,
    });

    // Create edit button (preserve it)
    const editButton = new ButtonBuilder()
      .setCustomId(`edit_session_${sessionId}_${user.id}`)
      .setLabel('✏️ Edit')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(editButton);

    // Update the feed post
    if (session.feedMessageId) {
      try {
        const config = await getServerConfig(db, session.serverId);
        if (config?.feedChannelId) {
          const channel = await client.channels.fetch(config.feedChannelId);
          if (channel && channel.isTextBased()) {
            const message = await (channel as any).messages.fetch(session.feedMessageId);
            if (message) {
              await message.edit({
                files: [attachment],
                components: [row],
              });
              logger.info(`Updated feed post ${session.feedMessageId}`);
            }
          }
        }
      } catch (error) {
        logger.error('Error updating feed post:', error);
        // Non-critical - session is still updated
      }
    }

    await interaction.editReply({
      content: `✅ Session updated successfully!\n\n**Changes:**\n• Duration: ${formatDuration(oldDuration)} → ${formatDuration(newDuration)}\n• Intensity: ${oldIntensity} → ${newIntensity}\n• XP: ${oldXp} → ${newXp} (${xpDelta >= 0 ? '+' : ''}${xpDelta})`,
    });

    logger.info(`Session ${sessionId} edited successfully by user ${user.id}`);
  } catch (error) {
    logger.error('Error handling edit session modal:', error);

    const errorMessage = '❌ An error occurred while editing your session. Please try again.';

    try {
      await interaction.editReply({ content: errorMessage });
    } catch (replyError) {
      logger.error('Could not send error message to user:', replyError);
    }
  }
}
