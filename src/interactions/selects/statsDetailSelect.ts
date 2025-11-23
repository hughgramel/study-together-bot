/**
 * Stats Detail Select Menu Handler
 *
 * Handles the stats_select_* dropdown for detailed stats breakdown visualization.
 * Shows hourly/daily/weekly/monthly breakdowns with comparisons.
 */

import {
  StringSelectMenuInteraction,
  AttachmentBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { SessionService } from '../../services/sessions';
import { StatsOverviewImageService } from '../../services/statsOverviewImage';
import { getStartOfDayPacific, getStartOfMonthPacific } from '../../utils/timeHelpers';
import { createLogger } from '../../utils/logger';

const logger = createLogger('StatsDetailSelect');

/**
 * Handle stats_select_* dropdown menu
 */
export async function handleStatsDetailSelect(
  interaction: StringSelectMenuInteraction,
  db: Firestore
): Promise<void> {
  const targetUserId = interaction.customId.replace('stats_select_', '');
  const user = interaction.user;

  if (user.id !== targetUserId) {
    await interaction.reply({
      content: '❌ You can only change your own statistics view.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    const sessionService = new SessionService(db);
    const statsOverviewImageService = new StatsOverviewImageService();

    // Parse metric and timeframe from selected value
    const [metric, timeframe] = interaction.values[0].split('_');

    // Get data based on timeframe
    let startTime: Date;
    let previousStartTime: Date;
    let previousEndTime: Date;
    let breakdown: Array<{ label: string; value: number }> = [];
    let breakdownLabels: string[];

    const today = getStartOfDayPacific();
    const monthStart = getStartOfMonthPacific();

    // Use rolling 7-day window (same as /graph)
    const now = new Date();
    const weekStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);

    if (timeframe === 'today') {
      startTime = today;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      previousStartTime = yesterday;
      previousEndTime = today;
      breakdownLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    } else if (timeframe === 'week') {
      startTime = weekStart;
      const twoWeeksAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
      twoWeeksAgo.setHours(0, 0, 0, 0);
      previousStartTime = twoWeeksAgo;
      previousEndTime = weekStart;
      // Generate day names for rolling 7-day window
      breakdownLabels = [];
      const tempDate = new Date(weekStart);
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      for (let i = 0; i < 7; i++) {
        breakdownLabels.push(dayNames[tempDate.getDay()]);
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else if (timeframe === 'month') {
      startTime = monthStart;
      const lastMonthStart = new Date(monthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      previousStartTime = lastMonthStart;
      previousEndTime = monthStart;
      // Show 4 weeks for month
      breakdownLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    } else {
      // all-time
      startTime = new Date(0);
      previousStartTime = new Date(0);
      previousEndTime = new Date(0);
      // Show Today, This Week, This Month, All Time
      breakdownLabels = ['Today', 'This Week', 'This Month', 'All Time'];
    }

    // Fetch sessions
    const currentSessions = await sessionService.getCompletedSessions(
      user.id,
      Timestamp.fromDate(startTime)
    );

    let previousSessions: any[] = [];
    if (timeframe !== 'all-time') {
      const allPreviousSessions = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(previousStartTime)
      );
      // Filter to only include sessions before the current period
      previousSessions = allPreviousSessions.filter(
        (s) => s.endTime.toDate() < startTime
      );
    }

    // Calculate values based on metric
    let currentValue: number;
    let previousValue: number;

    if (metric === 'hours') {
      currentValue = Math.round(
        currentSessions.reduce((sum, s) => sum + s.duration, 0) / 3600
      );
      previousValue = Math.round(
        previousSessions.reduce((sum, s) => sum + s.duration, 0) / 3600
      );
    } else if (metric === 'sessions') {
      currentValue = currentSessions.length;
      previousValue = previousSessions.length;
    } else {
      // xp
      currentValue = Math.round(
        currentSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0)
      );
      previousValue = Math.round(
        previousSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0)
      );
    }

    // Calculate breakdown and highlight index
    let highlightIndex: number | undefined = undefined;
    const currentDate = new Date();

    if (timeframe === 'today') {
      // Hourly breakdown for today
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(startTime);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hour + 1, 0, 0, 0);

        const hourSessions = currentSessions.filter((s) => {
          const sessionDate = s.endTime.toDate();
          return sessionDate >= hourStart && sessionDate < hourEnd;
        });

        let value = 0;
        if (metric === 'hours') {
          value = Math.round(hourSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
        } else if (metric === 'sessions') {
          value = hourSessions.length;
        } else {
          value = Math.round(hourSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
        }

        breakdown.push({ label: breakdownLabels[hour], value });

        // Highlight current hour
        if (currentDate.getHours() === hour) {
          highlightIndex = hour;
        }
      }
    } else if (timeframe === 'week') {
      // Daily breakdown for week
      const dayStart = new Date(startTime);
      for (let i = 0; i < 7; i++) {
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const daySessions = currentSessions.filter((s) => {
          const sessionDate = s.endTime.toDate();
          return sessionDate >= dayStart && sessionDate < dayEnd;
        });

        let value = 0;
        if (metric === 'hours') {
          value = Math.round(daySessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
        } else if (metric === 'sessions') {
          value = daySessions.length;
        } else {
          value = Math.round(daySessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
        }

        breakdown.push({ label: breakdownLabels[i], value });

        // Highlight today
        if (dayStart.toDateString() === currentDate.toDateString()) {
          highlightIndex = i;
        }

        dayStart.setDate(dayStart.getDate() + 1);
      }
    } else if (timeframe === 'month') {
      // Weekly breakdown for month (4 weeks)
      const weekStart = new Date(startTime);

      for (let i = 0; i < 4; i++) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekSessions = currentSessions.filter((s) => {
          const sessionDate = s.endTime.toDate();
          return sessionDate >= weekStart && sessionDate < weekEnd;
        });

        let value = 0;
        if (metric === 'hours') {
          value = Math.round(weekSessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
        } else if (metric === 'sessions') {
          value = weekSessions.length;
        } else {
          value = Math.round(weekSessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
        }

        // Check if this is the current week
        const isCurrentWeek = currentDate >= weekStart && currentDate < weekEnd;
        if (isCurrentWeek) {
          highlightIndex = i;
        }

        // Use "This Week" for current week, otherwise use default label
        const weekLabel = isCurrentWeek ? 'This Week' : breakdownLabels[i];
        breakdown.push({ label: weekLabel, value });

        weekStart.setDate(weekStart.getDate() + 7);
      }
    } else {
      // all-time: show Today, This Week, This Month, All Time
      const todayValue = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(today)
      );
      const weekValue = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(weekStart)
      );
      const monthValue = await sessionService.getCompletedSessions(
        user.id,
        Timestamp.fromDate(monthStart)
      );

      const calculateValue = (sessions: any[]) => {
        if (metric === 'hours') {
          return Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 3600);
        } else if (metric === 'sessions') {
          return sessions.length;
        } else {
          return Math.round(sessions.reduce((sum, s) => sum + (s.xpGained || 0), 0));
        }
      };

      breakdown = [
        { label: 'Today', value: calculateValue(todayValue) },
        { label: 'This Week', value: calculateValue(weekValue) },
        { label: 'This Month', value: calculateValue(monthValue) },
        { label: 'All Time', value: currentValue },
      ];

      // All-time: don't highlight anything
      highlightIndex = undefined;
    }

    // Generate new stats image
    const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });
    const imageBuffer = await statsOverviewImageService.generateStatsOverviewImage(
      user.username,
      metric as 'hours' | 'sessions' | 'xp',
      timeframe as 'today' | 'week' | 'month' | 'all-time',
      currentValue,
      previousValue,
      breakdown,
      avatarUrl,
      highlightIndex
    );

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: 'stats-overview.png',
    });

    // Update select menu to reflect current selection
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`stats_select_${user.id}`)
      .setPlaceholder('Change metric or timeframe')
      .addOptions([
        {
          label: '⏱️ Hours - This Week',
          value: 'hours_week',
          default: metric === 'hours' && timeframe === 'week',
        },
        {
          label: '⏱️ Hours - This Month',
          value: 'hours_month',
          default: metric === 'hours' && timeframe === 'month',
        },
        {
          label: '⏱️ Hours - All Time',
          value: 'hours_all-time',
          default: metric === 'hours' && timeframe === 'all-time',
        },
        {
          label: '📚 Sessions - This Week',
          value: 'sessions_week',
          default: metric === 'sessions' && timeframe === 'week',
        },
        {
          label: '📚 Sessions - This Month',
          value: 'sessions_month',
          default: metric === 'sessions' && timeframe === 'month',
        },
        {
          label: '📚 Sessions - All Time',
          value: 'sessions_all-time',
          default: metric === 'sessions' && timeframe === 'all-time',
        },
        {
          label: '⚡ XP - This Week',
          value: 'xp_week',
          default: metric === 'xp' && timeframe === 'week',
        },
        {
          label: '⚡ XP - This Month',
          value: 'xp_month',
          default: metric === 'xp' && timeframe === 'month',
        },
        {
          label: '⚡ XP - All Time',
          value: 'xp_all-time',
          default: metric === 'xp' && timeframe === 'all-time',
        },
      ]);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    const graphButton = new ButtonBuilder()
      .setCustomId(`view_graph_${user.id}`)
      .setLabel('View Graph')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📊');

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(graphButton);

    await interaction.editReply({
      files: [attachment],
      components: [selectRow, buttonRow],
    });

    logger.info(`User ${user.username} viewed stats detail: ${metric}_${timeframe}`);
  } catch (error) {
    logger.error('Error updating statistics:', error);
    await interaction.followUp({
      content: '❌ Failed to update statistics. Please try again later.',
      ephemeral: true,
    });
  }
}
