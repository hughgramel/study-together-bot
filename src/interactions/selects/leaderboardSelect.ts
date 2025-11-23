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
import { ProfileImageService } from '../../services/profileImage';
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
    const statsService = new StatsService(db);
    const profileImageService = new ProfileImageService();

    let topUsers: Array<{
      userId: string;
      username: string;
      totalDuration: number;
      xp?: number;
    }> = [];

    if (selectedValue === 'all-time') {
      // Get all-time top users by XP - filtered by server
      const xpUsers = await statsService.getTopUsersByXP(20, guildId!);
      topUsers = xpUsers.map((u) => ({
        userId: u.userId,
        username: u.username,
        totalDuration: u.totalDuration || 0,
        xp: u.xp,
      }));
    } else {
      let startTime: Date;
      if (selectedValue === 'daily') {
        startTime = getStartOfDayPacific();
      } else if (selectedValue === 'weekly') {
        startTime = getStartOfWeekPacific();
      } else {
        startTime = getStartOfMonthPacific();
      }

      topUsers = await sessionService.getTopUsers(
        Timestamp.fromDate(startTime),
        20,
        guildId!
      );
    }

    // Prepare leaderboard entries
    let entries: Array<{
      userId: string;
      username: string;
      avatarUrl: string;
      xp: number;
      totalDuration: number;
      rank: number;
    }> = [];
    let currentUserEntry = undefined;

    if (topUsers.length > 0) {
      // Get top 10
      const top10 = topUsers.slice(0, 10);

      // Check if current user is in top 10
      const userPosition = topUsers.findIndex((u) => u.userId === interaction.user.id);

      // Prepare leaderboard entries with avatars
      entries = await Promise.all(
        top10.map(async (u, index) => {
          try {
            const discordUser = await interaction.client.users.fetch(u.userId);
            const stats = await statsService.getUserStats(u.userId);
            return {
              userId: u.userId,
              username: u.username,
              avatarUrl: discordUser.displayAvatarURL({ size: 128, extension: 'png' }),
              xp: stats?.xp || 0,
              totalDuration: u.totalDuration,
              rank: index + 1,
            };
          } catch (error) {
            logger.error(`Failed to fetch user ${u.userId}:`, error);
            return {
              userId: u.userId,
              username: u.username,
              avatarUrl: '',
              xp: 0,
              totalDuration: u.totalDuration,
              rank: index + 1,
            };
          }
        })
      );

      // Prepare current user entry if they're not in top 10
      if (userPosition > 9) {
        const userStats = await statsService.getUserStats(interaction.user.id);
        currentUserEntry = {
          userId: interaction.user.id,
          username: interaction.user.username,
          avatarUrl: interaction.user.displayAvatarURL({ size: 128, extension: 'png' }),
          xp: userStats?.xp || 0,
          totalDuration: topUsers[userPosition].totalDuration,
          rank: userPosition + 1,
        };
      }
    }

    // Generate leaderboard image
    const imageBuffer = await profileImageService.generateLeaderboardImage(
      selectedValue as 'daily' | 'weekly' | 'monthly' | 'all-time',
      entries,
      currentUserEntry
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
          description: "Today's top performers",
          value: 'daily',
          emoji: '📅',
          default: selectedValue === 'daily',
        },
        {
          label: 'Weekly',
          description: "This week's leaders",
          value: 'weekly',
          emoji: '📊',
          default: selectedValue === 'weekly',
        },
        {
          label: 'Monthly',
          description: "This month's champions",
          value: 'monthly',
          emoji: '🌟',
          default: selectedValue === 'monthly',
        },
        {
          label: 'All Time',
          description: 'Top performers of all time',
          value: 'all-time',
          emoji: '🏆',
          default: selectedValue === 'all-time',
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
