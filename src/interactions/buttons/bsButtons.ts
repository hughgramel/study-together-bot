/**
 * /bs Button Handlers
 *
 * Handles confirm/deny responses to slacking accusations.
 * Only the accused user can respond.
 * On confirm, the accuser earns +1 BS point toward the leaderboard.
 * Every 20 BS points earns +130 XP.
 */

import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
} from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { ModerationService, BS_XP_MILESTONE, BS_XP_REWARD } from '../../services/moderation';
import { XPService } from '../../services/xp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BsButtons');

function disabledRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('bs_confirm_done')
      .setLabel('Yeah, I am slacking 😅')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('bs_deny_done')
      .setLabel("No, I'm studying! 📚")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true)
  );
}

export async function handleBsButton(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const customId = interaction.customId;
  const isConfirm = customId.startsWith('bs_confirm_');

  // Extract pendingId (everything after the prefix)
  const pendingId = isConfirm
    ? customId.slice('bs_confirm_'.length)
    : customId.slice('bs_deny_'.length);

  const modService = new ModerationService(db);
  const pending = await modService.getPendingBs(pendingId);

  if (!pending) {
    await interaction.reply({
      content: 'This accusation has expired or was already resolved.',
      ephemeral: true,
    });
    return;
  }

  if (pending.resolved) {
    await interaction.reply({
      content: 'This accusation was already resolved.',
      ephemeral: true,
    });
    return;
  }

  // Only the accused can respond
  if (interaction.user.id !== pending.targetId) {
    await interaction.reply({
      content: 'Only the accused person can respond to this!',
      ephemeral: true,
    });
    return;
  }

  logger.info(
    `BS ${pendingId} resolved as ${isConfirm ? 'confirmed' : 'denied'} by ${interaction.user.username}`
  );

  await modService.resolvePendingBs(pendingId, isConfirm ? 'confirmed' : 'denied');

  if (isConfirm) {
    // Target admitted to slacking — accuser earns a bonus /bs token + a leaderboard point
    await modService.addBsToken(pending.bserId);

    const { newPoints, milestoneReached } = await modService.incrementBsPoints(
      pending.guildId,
      pending.bserId,
      pending.bserUsername
    );

    // Award XP if milestone crossed
    let xpLine = '';
    if (milestoneReached) {
      try {
        const xpService = new XPService(db, client);
        await xpService.awardXP(
          pending.bserId,
          pending.guildId,
          BS_XP_REWARD,
          `BS leaderboard milestone (${newPoints} correct calls)`
        );
        xpLine = `\n\n**Milestone!** <@${pending.bserId}> reached **${newPoints} BS points** and earned **+${BS_XP_REWARD} XP**!`;
        logger.info(
          `Awarded ${BS_XP_REWARD} XP to ${pending.bserId} for BS milestone at ${newPoints} points`
        );
      } catch (error) {
        // User may not have stats yet — skip XP award silently
        logger.warn(`Could not award BS milestone XP to ${pending.bserId}`, error);
      }
    }

    const pointsUntilNext = BS_XP_MILESTONE - (newPoints % BS_XP_MILESTONE);
    const progressLine =
      pointsUntilNext === BS_XP_MILESTONE
        ? `<@${pending.bserId}> just hit a milestone!`
        : `<@${pending.bserId}> now has **${newPoints} BS point${newPoints !== 1 ? 's' : ''}** (${pointsUntilNext} until +${BS_XP_REWARD} XP)`;

    const embed = new EmbedBuilder()
      .setTitle('✅ Slacking Confirmed!')
      .setDescription(
        `<@${pending.targetId}> admitted to slacking off!\n\n` +
          `<@${pending.bserId}> called it correctly and earned **+1 /bs token**.` +
          xpLine +
          `\n\n${progressLine}`
      )
      .setColor(0xff4444)
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [disabledRow()] });
  } else {
    // Target was actually studying — accuser wasted a token
    const embed = new EmbedBuilder()
      .setTitle('📚 Actually Studying!')
      .setDescription(
        `<@${pending.targetId}> is actually studying!\n\n` +
          `<@${pending.bserId}>, your /bs token was wasted. Maybe check before accusing next time.`
      )
      .setColor(0x00c851)
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [disabledRow()] });
  }
}
