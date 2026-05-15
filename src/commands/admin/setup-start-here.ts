/**
 * /setup-start-here Command
 *
 * Posts the onboarding guide to a designated channel and saves it as the
 * server's start-here channel. Admin only.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { Timestamp } from 'firebase-admin/firestore';
import type { Command } from '../types';
import { getServerConfig } from '../../utils/serverHelpers';
import { ServerConfig } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupStartHereCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup-start-here')
    .setDescription('Post the onboarding guide to a channel and set it as the start-here channel (Admin only)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to post the onboarding guide in')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addRoleOption((option) =>
      option
        .setName('mod-role')
        .setDescription('The moderator role to mention when users need group help (optional)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const guildId = interaction.guildId;
    const channel = interaction.options.getChannel('channel', true);
    const modRole = interaction.options.getRole('mod-role');

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Only server administrators can set up the start-here channel.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      logger.info(`User ${user.username} (${user.id}) setting up start-here channel ${channel.id} in guild ${guildId}`);

      const textChannel = await interaction.guild!.channels.fetch(channel.id) as TextChannel;
      if (!textChannel || !textChannel.isTextBased()) {
        await interaction.editReply({ content: 'Could not access that channel. Make sure the bot has permission to send messages there.' });
        return;
      }

      const modMention = modRole ? `<@&${modRole.id}>` : 'a moderator';

      // ── Embed 1: Getting Started ────────────────────────────────────────────
      const gettingStartedEmbed = new EmbedBuilder()
        .setColor(0x0080FF)
        .setTitle('📚  Getting Started with Study Together')
        .setDescription(
          'Welcome! This server uses a bot to help you track study and work sessions, ' +
          'earn XP, level up, and stay accountable with your community.\n\n' +
          'Follow the three steps below and you\'ll be up and running in under a minute.'
        )
        .addFields(
          {
            name: '① Start a session',
            value: 'Use `/start` in any channel when you begin studying or working.\nYou can describe what you\'re working on and set an intensity level (1–5) to earn more XP.',
            inline: false,
          },
          {
            name: '② Pause if you need a break',
            value: 'Use `/pause` to freeze your timer and `/unpause` to resume.\nPaused time is not counted toward your stats.',
            inline: false,
          },
          {
            name: '③ Stop when you\'re done',
            value: 'Use `/stop` to end your session, log your time, and earn XP.\nA summary will be posted to the feed channel automatically.',
            inline: false,
          },
          {
            name: '\u200b',
            value: '**Other useful commands**',
            inline: false,
          },
          {
            name: '`/time`',
            value: 'Check how long your current session has been running.',
            inline: true,
          },
          {
            name: '`/stats`',
            value: 'View your personal stats — daily, weekly, all-time, and streaks.',
            inline: true,
          },
          {
            name: '`/leaderboard`',
            value: 'See how you rank against the rest of the server.',
            inline: true,
          },
          {
            name: '`/goals`',
            value: 'Set daily goals and mark them complete as you finish them.',
            inline: true,
          },
          {
            name: '`/achievements`',
            value: 'Track your leveled achievements and XP boost progress.',
            inline: true,
          },
          {
            name: '`/help`',
            value: 'Full command list with descriptions.',
            inline: true,
          }
        )
        .setFooter({ text: 'Study Together Bot  •  /start to begin your first session' });

      // ── Embed 2: Levels & Colors ────────────────────────────────────────────
      const levelsEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏅  Levels & Role Colors')
        .setDescription(
          'You earn **100 XP per hour** of study time, with multipliers for session intensity, ' +
          'group membership, and achievement levels. As you level up you automatically receive ' +
          'a colored role that shows your dedication to the community.\n\u200b'
        )
        .addFields(
          {
            name: '⬛  Void  —  Level 1–3',
            value: 'Just getting started. Every journey begins here.',
            inline: false,
          },
          {
            name: '🩶  Charcoal  —  Level 4–8',
            value: 'Building habits and finding your rhythm.',
            inline: false,
          },
          {
            name: '🟫  Bronze  —  Level 9–15',
            value: 'Consistent studier. Sessions are becoming second nature.',
            inline: false,
          },
          {
            name: '⬜  Silver  —  Level 16–25',
            value: 'Dedicated learner putting in real hours.',
            inline: false,
          },
          {
            name: '🟡  Gold  —  Level 26–40',
            value: 'Productivity master. The leaderboard knows your name.',
            inline: false,
          },
          {
            name: '🟣  Amethyst  —  Level 41–60',
            value: 'Elite scholar. Sustained focus is your superpower.',
            inline: false,
          },
          {
            name: '🔷  Diamond  —  Level 61–85',
            value: 'Legendary focus. Few reach this tier.',
            inline: false,
          },
          {
            name: '✨  Radiant  —  Level 86+',
            value: 'Top-tier achiever. You are an inspiration to the server.',
            inline: false,
          },
          {
            name: '\u200b',
            value:
              '**XP Bonuses**\n' +
              '• Intensity 4 → +20% XP | Intensity 5 → +50% XP\n' +
              '• Group membership → up to +50% XP (1% per group level)\n' +
              '• Streak milestones → +100 XP at 7 days, +500 XP at 30 days\n' +
              '• Achievement levels → up to +4% XP total (all 4 achievements maxed)',
            inline: false,
          }
        )
        .setFooter({ text: 'Roles update automatically when you level up — no action needed.' });

      // ── Embed 3: Study Groups ───────────────────────────────────────────────
      const groupMention = modRole ? `ping ${modMention}` : 'ping a moderator';
      const groupsEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('👥  Study Groups')
        .setDescription(
          'Groups make studying more fun **and** more rewarding. ' +
          'Every group earns a shared XP bonus that grows as the group levels up — ' +
          'so it literally pays to study together.\n\u200b'
        )
        .addFields(
          {
            name: '📈  Group XP Bonus',
            value:
              'Groups level up every **25 combined study hours**.\n' +
              'Each group level grants **+1% XP** to every member (capped at +50% at level 50).\n' +
              'A level-50 group gives everyone a permanent 50% XP multiplier on every session.',
            inline: false,
          },
          {
            name: '✅  Make your own group (recommended!)',
            value:
              'We **strongly encourage** you to create a group with friends — the shared grind is the best part.\n' +
              '`/creategroup` — start a new group\n' +
              '`/invitegroup @friend` — invite someone to your group\n' +
              '`/joingroup <group-id>` — join a specific group by ID',
            inline: false,
          },
          {
            name: '🔍  Find a public group',
            value:
              '`/findgroups` — browse public groups looking for members\n' +
              '`/joinrandom` — be matched with a public group automatically',
            inline: false,
          },
          {
            name: '🛡️  Need help getting placed?',
            value:
              `You can ${groupMention} and we will help you find a group, ` +
              'but we really encourage you to form your own team and invite your friends. ' +
              'Groups you build together tend to stay more active!\n\n' +
              '`/group` — view your current group and its stats\n' +
              '`/leavegroup` — leave your current group',
            inline: false,
          }
        )
        .setFooter({ text: 'Groups hold up to 5 members and can be public or private.' });

      await textChannel.send({ embeds: [gettingStartedEmbed] });
      await textChannel.send({ embeds: [levelsEmbed] });
      await textChannel.send({ embeds: [groupsEmbed] });

      // Save start-here channel (and optional mod role) to server config
      const existingConfig = await getServerConfig(db, guildId);
      const config: ServerConfig = {
        ...existingConfig,
        startHereChannelId: channel.id,
        ...(modRole ? { modRoleId: modRole.id } : {}),
        setupAt: Timestamp.now(),
        setupBy: user.id,
      };

      await db
        .collection('discord-data')
        .doc('serverConfig')
        .collection('configs')
        .doc(guildId)
        .set(config);

      const modRoleNote = modRole ? `\nModerator role saved: <@&${modRole.id}>` : '';
      await interaction.editReply({
        content:
          `Start-here guide posted to <#${channel.id}> and saved as the onboarding channel.${modRoleNote}\n\n` +
          `New members will be directed there when they join. Use \`/set-welcome-channel\` to configure where those welcome pings appear.`,
      });

      logger.info(`Start-here channel set to ${channel.id} for guild ${guildId}`);
    } catch (error) {
      logger.error('Error setting up start-here channel', error);
      await interaction.editReply({
        content: 'An error occurred while posting the guide. Make sure the bot has permission to send messages in that channel.',
      });
    }
  },
};
