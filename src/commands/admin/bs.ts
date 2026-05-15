/**
 * /bs Command
 *
 * Call out a user for not studying. The target gets a ping with buttons to
 * confirm or deny. Rules:
 *   - 30-minute cooldown per target
 *   - Each caller gets 2 /bs tokens per day
 *   - A correct call (target confirms) earns +1 extra token
 */

import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { ModerationService } from '../../services/moderation';

function formatMs(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  return `${mins} minute${mins !== 1 ? 's' : ''}`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('bs')
    .setDescription('Call out someone for not studying!')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user you think is slacking').setRequired(true)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const caller = interaction.user;
    const target = interaction.options.getUser('user', true);

    if (target.id === caller.id) {
      await interaction.reply({
        content: "You can't call yourself out.",
        ephemeral: true,
      });
      return;
    }

    if (target.bot) {
      await interaction.reply({
        content: 'Bots are always studying.',
        ephemeral: true,
      });
      return;
    }

    const modService = new ModerationService(db);

    // Check caller's daily token count
    const callerState = await modService.getBsUserState(caller.id);
    if (!modService.canUseBs(callerState)) {
      const total = 2 + callerState.extraTokens;
      await interaction.reply({
        content: `You've used all ${total} of your /bs tokens for today. Earn more by getting correct calls.`,
        ephemeral: true,
      });
      return;
    }

    // Check 30-min cooldown on the target
    const onCooldown = await modService.isTargetOnCooldown(target.id);
    if (onCooldown) {
      const remaining = await modService.getCooldownRemainingMs(target.id);
      await interaction.reply({
        content: `${target.username} was already called out recently. Try again in **${formatMs(remaining)}**.`,
        ephemeral: true,
      });
      return;
    }

    // Consume one token and set cooldown
    await modService.incrementBsCount(caller.id);
    await modService.setTargetCooldown(target.id);

    const pendingId = `${caller.id}_${target.id}_${Date.now()}`;

    const embed = new EmbedBuilder()
      .setTitle('📢 Slacking Accusation!')
      .setDescription(
        `**${caller.username}** thinks <@${target.id}> is **not studying right now!**\n\n` +
          `<@${target.id}> — are you slacking off?`
      )
      .setColor(0xff6b00)
      .setFooter({ text: 'Only the accused can respond • Buttons expire after 5 minutes' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bs_confirm_${pendingId}`)
        .setLabel('Yeah, I am slacking 😅')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`bs_deny_${pendingId}`)
        .setLabel("No, I'm studying! 📚")
        .setStyle(ButtonStyle.Success)
    );

    const reply = await interaction.reply({
      content: `<@${target.id}>`,
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    // Persist pending record
    await modService.createPendingBs({
      pendingId,
      bserId: caller.id,
      bserUsername: caller.username,
      targetId: target.id,
      targetUsername: target.username,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      messageId: reply.id,
      createdAt: Timestamp.now(),
      resolved: false,
      result: null,
    });

    // Let the caller know their remaining tokens
    const remaining = modService.remainingBs(callerState) - 1;
    if (remaining > 0) {
      await interaction.followUp({
        content: `You have **${remaining}** /bs token${remaining !== 1 ? 's' : ''} remaining today.`,
        ephemeral: true,
      });
    } else {
      await interaction.followUp({
        content: "That was your last /bs token for today. Get one right to earn another!",
        ephemeral: true,
      });
    }
  },
};
