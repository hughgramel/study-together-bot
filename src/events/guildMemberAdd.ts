/**
 * Guild Member Add Event Handler
 *
 * Welcomes new members in the configured welcome channel and optionally
 * sends them a DM with quick-start info.
 */

import { EmbedBuilder, GuildMember, TextChannel } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { getServerConfig } from '../utils/serverHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('GuildMemberAdd');

/**
 * Handle new member joining the server.
 * Posts a welcome embed in the configured welcome channel and attempts a DM.
 */
export async function handleGuildMemberAdd(member: GuildMember, db: Firestore): Promise<void> {
  if (member.user.bot) {
    return;
  }

  logger.info(`New member joined: ${member.user.username} (${member.id})`);

  // Post welcome message in the configured welcome channel
  await postWelcomeToChannel(member, db);

  // Also attempt a DM (many users have DMs disabled — failure is silent)
  await sendWelcomeDM(member, db);
}

/**
 * Post a welcome embed in the server's welcome channel.
 */
async function postWelcomeToChannel(member: GuildMember, db: Firestore): Promise<void> {
  try {
    const config = await getServerConfig(db, member.guild.id);

    if (!config?.welcomeChannelId) {
      logger.info(`No welcome channel configured for guild ${member.guild.id} — skipping channel welcome`);
      return;
    }

    const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`Welcome channel ${config.welcomeChannelId} not found or not text-based`);
      return;
    }

    const startHereMention = config.startHereChannelId
      ? `Head over to <#${config.startHereChannelId}> to learn how everything works!`
      : 'Check the pinned messages to get started!';

    const embed = new EmbedBuilder()
      .setColor(0x0080FF)
      .setTitle(`Welcome to ${member.guild.name}!`)
      .setDescription(
        `Hey ${member}, glad you're here! 👋\n\n` +
        `${startHereMention}\n\n` +
        'When you\'re ready, type `/start` in any channel to log your first study session and start earning XP. 🚀'
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'Study Together Bot  •  /help for the full command list' })
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
    logger.info(`Posted welcome message for ${member.user.username} in channel ${config.welcomeChannelId}`);
  } catch (error) {
    logger.error(`Failed to post welcome message for ${member.user.username}`, error);
  }
}

/**
 * Attempt to DM the new member with a quick-start summary.
 * Silently handles the common case where users have DMs disabled.
 */
async function sendWelcomeDM(member: GuildMember, db: Firestore): Promise<void> {
  try {
    const config = await getServerConfig(db, member.guild.id);

    const startHereLine = config?.startHereChannelId
      ? `Read the <#${config.startHereChannelId}> channel in the server for the full guide.`
      : 'Check the server\'s start-here channel for the full guide.';

    const dmMessage =
      `🎓 **Welcome to ${member.guild.name}!**\n\n` +
      'This server helps you stay consistent with studying through:\n' +
      '📊 Tracking your study sessions\n' +
      '🏆 Friendly competition with other students\n' +
      '📈 Seeing your progress over time\n\n' +
      `${startHereLine}\n\n` +
      '**Quick commands:**\n' +
      '`/start` — Begin a study session\n' +
      '`/stop` — End your session and earn XP\n' +
      '`/stats` — View your personal progress\n' +
      '`/leaderboard` — See how you rank\n\n' +
      "Let's make this your most productive semester! 🚀";

    await member.send(dmMessage);
    logger.info(`Sent welcome DM to ${member.user.username}`);
  } catch (error) {
    if ((error as any).code === 50007) {
      logger.info(`Cannot DM ${member.user.username} — DMs disabled`);
    } else {
      logger.error(`Failed to send welcome DM to ${member.user.username}`, error);
    }
  }
}
