/**
 * Leaderboard Select Menu Handlers
 *
 * Handles leaderboard timeframe selection interactions.
 */

import {
  StringSelectMenuInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { SessionService } from '../../services/sessions';
import { StatsService } from '../../services/stats';
import { LeaderboardImageService } from '../../services/leaderboardImage';
import { getStartOfDayPacific, getStartOfWeekPacific, getStartOfMonthPacific } from '../../utils/timeHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LeaderboardSelect');

/**
 * Handle leaderboard timeframe select menu
 */
export async function handleLeaderboardTimeframeSelect(
  interaction: StringSelectMenuInteraction,
  db: Firestore
): Promise<void> {
  const selectedValue = interaction.values[0];
  const user = interaction.user;
  const guildId = interaction.guildId;

  // Defer the update to prevent timeout
  await interaction.deferUpdate();

  try {
    const sessionService = new SessionService(db);
    const statsService = new StatsService(db);

    // Get data for all timeframes
    const today = getStartOfDayPacific();
    const weekStart = getStartOfWeekPacific();
    const monthStart = getStartOfMonthPacific();

    const [dailyAll, weeklyAll, monthlyAll] = await Promise.all([
      sessionService.getTopUsers(Timestamp.fromDate(today), 20, guildId!),
      sessionService.getTopUsers(Timestamp.fromDate(weekStart), 20, guildId!),
      sessionService.getTopUsers(Timestamp.fromDate(monthStart), 20, guildId!),
    ]);

    let embed: EmbedBuilder;

    if (selectedValue === 'overview') {
      // Overview: Top 3 from each timeframe + user position
      const formatLeaderboard = (
        allUsers: Array<{ userId: string; username: string; totalDuration: number }>,
        emoji: string,
        label: string
      ) => {
        if (allUsers.length === 0) return `${emoji} **${label}**\nNo data yet`;

        const lines: string[] = [];
        const userPosition = allUsers.findIndex((u) => u.userId === user.id);

        // Add top 3
        for (let i = 0; i < Math.min(3, allUsers.length); i++) {
          const u = allUsers[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          lines.push(`${medal} **${u.username}** - ${(u.totalDuration / 3600).toFixed(1)}h`);
        }

        // Add current user if not in top 3
        if (userPosition > 2) {
          const current = allUsers[userPosition];
          lines.push(
            `**${userPosition + 1}. ${current.username} - ${(current.totalDuration / 3600).toFixed(1)}h**`
          );
        }

        return `${emoji} **${label}**\n${lines.join('\n')}`;
      };

      embed = new EmbedBuilder()
        .setColor(0xffd900) // Yellow
        .setTitle('🏆 Your Leaderboard Position')
        .addFields(
          { name: '\u200B', value: formatLeaderboard(dailyAll, '📅', 'Daily'), inline: false },
          { name: '\u200B', value: formatLeaderboard(weeklyAll, '📊', 'Weekly'), inline: false },
          { name: '\u200B', value: formatLeaderboard(monthlyAll, '🌟', 'Monthly'), inline: false }
        )
        .setFooter({ text: 'Use the dropdown below to view full leaderboards' });
    } else if (selectedValue === 'xp') {
      // XP Leaderboard
      const xpUsers = await statsService.getTopUsersByXP(20);

      if (xpUsers.length === 0) {
        embed = new EmbedBuilder()
          .setColor(0xffd900) // Yellow
          .setTitle('⚡ XP Leaderboard')
          .setDescription('No XP data yet! Complete sessions to earn XP! 🚀')
          .setFooter({ text: 'Use the dropdown below to view other timeframes' });
      } else {
        const top10 = xpUsers.slice(0, 10);
        const ranks: string[] = [];
        const names: string[] = [];
        const xpLevels: string[] = [];

        top10.forEach((u, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          ranks.push(medal);
          names.push(`**${u.username}** 🏆 ${u.achievementCount}`);
          xpLevels.push(`Lvl ${u.level} • ${u.xp.toLocaleString()} XP`);
        });

        // Add current user if not in top 10
        const userPosition = xpUsers.findIndex((u) => u.userId === user.id);
        if (userPosition >= 10) {
          const currentUser = xpUsers[userPosition];
          ranks.push(`**#${userPosition + 1}**`);
          names.push(`**${currentUser.username}** 🏆 ${currentUser.achievementCount}`);
          xpLevels.push(`**Lvl ${currentUser.level} • ${currentUser.xp.toLocaleString()} XP**`);
        }

        embed = new EmbedBuilder()
          .setColor(0xffd900) // Yellow
          .setTitle('⚡ XP Leaderboard')
          .addFields(
            { name: 'Rank', value: ranks.join('\n'), inline: true },
            { name: 'Name', value: names.join('\n'), inline: true },
            { name: 'Level • XP', value: xpLevels.join('\n'), inline: true }
          )
          .setFooter({ text: 'Complete sessions to earn XP and level up! 💪' });
      }
    } else {
      // Full leaderboard for specific time-based timeframe (sorted by hours)
      let users: Array<{
        userId: string;
        username: string;
        totalDuration: number;
        sessionCount: number;
      }>;
      let title: string;
      let emoji: string;

      if (selectedValue === 'daily') {
        users = dailyAll;
        title = '📅 Daily Leaderboard';
        emoji = '📅';
      } else if (selectedValue === 'weekly') {
        users = weeklyAll;
        title = '📊 Weekly Leaderboard';
        emoji = '📊';
      } else {
        users = monthlyAll;
        title = '🌟 Monthly Leaderboard';
        emoji = '🌟';
      }

      if (users.length === 0) {
        embed = new EmbedBuilder()
          .setColor(0xffd900) // Yellow
          .setTitle(title)
          .setDescription('No sessions completed in this timeframe yet! Be the first! 🚀')
          .setFooter({ text: 'Use the dropdown below to view other timeframes' });
      } else {
        const top10 = users.slice(0, 10);
        const ranks: string[] = [];
        const names: string[] = [];
        const hours: string[] = [];

        top10.forEach((u, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          ranks.push(medal);
          names.push(`**${u.username}**`);
          hours.push(`${(u.totalDuration / 3600).toFixed(1)}h`);
        });

        // Add current user if not in top 10
        const userPosition = users.findIndex((u) => u.userId === user.id);
        if (userPosition >= 10) {
          const currentUser = users[userPosition];
          ranks.push(`**#${userPosition + 1}**`);
          names.push(`**${currentUser.username}**`);
          hours.push(`**${(currentUser.totalDuration / 3600).toFixed(1)}h**`);
        }

        embed = new EmbedBuilder()
          .setColor(0xffd900) // Yellow
          .setTitle(title)
          .addFields(
            { name: 'Rank', value: ranks.join('\n'), inline: true },
            { name: 'Name', value: names.join('\n'), inline: true },
            { name: 'Hours', value: hours.join('\n'), inline: true }
          )
          .setFooter({
            text: 'Ranked by hours studied in this timeframe. Keep grinding! 💪',
          });
      }
    }

    // Keep the same select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('leaderboard_timeframe')
      .setPlaceholder('Select a timeframe to view')
      .addOptions([
        {
          label: 'Overview',
          description: 'Top 3 from each timeframe + your position',
          value: 'overview',
          emoji: '🏆',
        },
        {
          label: 'Daily Leaderboard',
          description: 'Full top 10 daily rankings by hours',
          value: 'daily',
          emoji: '📅',
        },
        {
          label: 'Weekly Leaderboard',
          description: 'Full top 10 weekly rankings by hours',
          value: 'weekly',
          emoji: '📊',
        },
        {
          label: 'Monthly Leaderboard',
          description: 'Full top 10 monthly rankings by hours',
          value: 'monthly',
          emoji: '🌟',
        },
        {
          label: 'XP Leaderboard',
          description: 'Top 10 by total XP and level',
          value: 'xp',
          emoji: '⚡',
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({ embeds: [embed], components: [row] });
    logger.info(`User ${user.username} viewed leaderboard: ${selectedValue}`);
  } catch (error) {
    logger.error('Error handling leaderboard timeframe select:', error);
    await interaction.editReply({
      content: '❌ Failed to load leaderboard. Please try again later.',
      components: [],
    });
  }
}

/**
 * Handle leaderboard image timeframe select menu
 */
export async function handleLeaderboardImageTimeframeSelect(
  interaction: StringSelectMenuInteraction,
  db: Firestore
): Promise<void> {
  const selectedValue = interaction.values[0];
  const guildId = interaction.guildId;

  await interaction.deferUpdate();

  try {
    const sessionService = new SessionService(db);
    const leaderboardImageService = new LeaderboardImageService();

    let users: Array<{ userId: string; username: string; totalDuration: number }>;
    let startTime: Date;
    let title: string;

    const today = getStartOfDayPacific();
    const weekStart = getStartOfWeekPacific();
    const monthStart = getStartOfMonthPacific();

    if (selectedValue === 'daily') {
      startTime = today;
      title = 'Daily Leaderboard';
      users = await sessionService.getTopUsers(Timestamp.fromDate(startTime), 10, guildId!);
    } else if (selectedValue === 'weekly') {
      startTime = weekStart;
      title = 'Weekly Leaderboard';
      users = await sessionService.getTopUsers(Timestamp.fromDate(startTime), 10, guildId!);
    } else {
      // monthly
      startTime = monthStart;
      title = 'Monthly Leaderboard';
      users = await sessionService.getTopUsers(Timestamp.fromDate(startTime), 10, guildId!);
    }

    // Fetch user avatars
    const usersWithAvatars = await Promise.all(
      users.map(async (u) => {
        const discordUser = await interaction.client.users.fetch(u.userId);
        return {
          ...u,
          avatarUrl: discordUser.displayAvatarURL({ size: 128, extension: 'png' }),
        };
      })
    );

    // Generate leaderboard image
    const imageBuffer = await leaderboardImageService.generateLeaderboardImage(
      title,
      usersWithAvatars,
      selectedValue
    );

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `leaderboard-${selectedValue}.png`,
    });

    // Recreate select menu with updated default
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('leaderboard_image_timeframe')
      .setPlaceholder('Select a timeframe')
      .addOptions([
        {
          label: 'Daily',
          description: 'Top 10 users by hours today',
          value: 'daily',
          emoji: '📅',
          default: selectedValue === 'daily',
        },
        {
          label: 'Weekly',
          description: 'Top 10 users by hours this week',
          value: 'weekly',
          emoji: '📊',
          default: selectedValue === 'weekly',
        },
        {
          label: 'Monthly',
          description: 'Top 10 users by hours this month',
          value: 'monthly',
          emoji: '🌟',
          default: selectedValue === 'monthly',
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.editReply({
      files: [attachment],
      components: [row],
    });

    logger.info(`Generated leaderboard image: ${selectedValue}`);
  } catch (error) {
    logger.error('Error handling leaderboard image timeframe select:', error);
    await interaction.editReply({
      content: '❌ Failed to generate leaderboard image. Please try again later.',
      components: [],
    });
  }
}
