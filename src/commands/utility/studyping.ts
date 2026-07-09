/**
 * /studyping Command
 *
 * Lets members schedule a study session by having the bot send a restricted
 * role ping into its configured channel.
 *
 * Why a bot command instead of a direct mention:
 *   - The restricted role is set as non-mentionable, so no user or spambot can
 *     ping it directly. This command is the only legitimate path.
 *   - The bot uses allowedMentions to send the ping, bypassing the non-mentionable
 *     flag in a controlled, auditable way.
 *   - Run this from your bot-commands channel; the ping lands in the study channel.
 *
 * Usage: /studyping role:<@role> [message:<text>]
 */

import {
  SlashCommandBuilder,
  Role,
  TextChannel,
} from 'discord.js';
import type { Command } from '../types';
import { ServerConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StudyPing');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('studyping')
    .setDescription('Schedule a study session — bot pings the study role in the designated channel')
    .addRoleOption(o =>
      o.setName('role')
        .setDescription('The study role to ping (e.g. @study with me)')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('message')
        .setDescription('Optional message to include with the ping (e.g. "anyone want to grind math?")')
        .setRequired(false)
        .setMaxLength(200)
    ),

  async execute(interaction, context) {
    const { db } = context;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      return;
    }

    // Defer immediately — Firestore read + channel fetch can exceed the 3s timeout
    await interaction.deferReply({ ephemeral: true });

    const role = interaction.options.getRole('role', true) as Role;
    const customMessage = interaction.options.getString('message');

    // Load server config to find where this role is allowed to be pinged
    const configDoc = await db
      .collection('discord-data')
      .doc('serverConfig')
      .collection('configs')
      .doc(guildId)
      .get();

    if (!configDoc.exists) {
      await interaction.editReply({
        content: 'No role restrictions are configured for this server. Ask an admin to run `/setup-role-restriction add` first.',
      });
      return;
    }

    const config = configDoc.data() as ServerConfig;
    const restriction = config.roleMentionRestrictions?.find(r => r.roleId === role.id);

    if (!restriction) {
      await interaction.editReply({
        content: `**@${role.name}** is not set up as a restricted study role. Ask an admin to configure it with \`/setup-role-restriction add\`.`,
      });
      return;
    }

    // Fetch the target channel
    const targetChannel = await interaction.guild!.channels.fetch(restriction.allowedChannelId).catch(() => null);
    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.editReply({
        content: `The configured target channel <#${restriction.allowedChannelId}> could not be found. Ask an admin to check the restriction config.`,
      });
      return;
    }

    // Build the ping content
    const body = customMessage
      ? `${customMessage}`
      : `${interaction.user} is scheduling a study session — who's joining?`;

    const content = `<@&${role.id}> — ${body}`;

    // Send the ping using allowedMentions so the non-mentionable role is pinged
    // in a controlled, bot-mediated way.
    try {
      await (targetChannel as TextChannel).send({
        content,
        allowedMentions: { roles: [role.id] },
      });
    } catch (err) {
      logger.error(`Failed to send study ping for @${role.name}: ${err}`);
      await interaction.editReply({
        content: `Failed to send the ping. Make sure the bot has **Send Messages** permission in <#${restriction.allowedChannelId}>.`,
      });
      return;
    }

    logger.info(
      `Study ping sent by ${interaction.user.username} (${interaction.user.id}) for @${role.name} → #${restriction.allowedChannelName}`
    );

    await interaction.editReply({
      content: `Ping sent to <#${restriction.allowedChannelId}>!`,
    });
  },
};
