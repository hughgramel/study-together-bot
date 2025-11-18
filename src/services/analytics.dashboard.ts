import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { AnalyticsQueries } from './analytics.queries';
import { formatDuration } from '../utils/formatters';

/**
 * AnalyticsDashboard - Discord embed builder for analytics data
 *
 * Creates beautiful, readable analytics dashboards directly in Discord
 */
export class AnalyticsDashboard {
  private queries: AnalyticsQueries;

  constructor(queries: AnalyticsQueries) {
    this.queries = queries;
  }

  /**
   * Create main dashboard embed
   */
  async createDashboardEmbed(): Promise<EmbedBuilder> {
    const summary = await this.queries.getDashboardSummary();

    const embed = new EmbedBuilder()
      .setTitle('Study Together Bot - Analytics Dashboard')
      .setColor(0x0080ff)
      .setTimestamp();

    // Active Users Section
    embed.addFields({
      name: 'Active Users',
      value: [
        `**DAU:** ${summary.activeUsers.dau} users`,
        `**WAU:** ${summary.activeUsers.wau} users`,
        `**MAU:** ${summary.activeUsers.mau} users`,
        `**DAU/WAU Ratio:** ${(summary.activeUsers.dauWauRatio * 100).toFixed(1)}%`,
        `**New Users (7d):** ${summary.growth.newUsersThisWeek}`,
      ].join('\n'),
      inline: true,
    });

    // Session Metrics Section
    embed.addFields({
      name: 'Sessions (Last 7 Days)',
      value: [
        `**Started:** ${summary.sessions.started}`,
        `**Completed:** ${summary.sessions.completed}`,
        `**Cancelled:** ${summary.sessions.cancelled}`,
        `**Completion Rate:** ${(summary.sessions.completionRate * 100).toFixed(1)}%`,
        `**Avg Duration:** ${formatDuration(summary.sessions.averageDuration)}`,
        `**Avg XP/Session:** ${Math.round(summary.sessions.averageXp)} XP`,
      ].join('\n'),
      inline: true,
    });

    // Top Commands
    if (summary.commands.topCommands.length > 0) {
      embed.addFields({
        name: 'Top Commands (Last 7 Days)',
        value: summary.commands.topCommands
          .map(([cmd, count], i) => `${i + 1}. **/${cmd}** - ${count} uses`)
          .join('\n'),
        inline: false,
      });
    }

    // Least Used Commands (potential removal candidates)
    if (summary.commands.leastUsedCommands.length > 0) {
      embed.addFields({
        name: 'Least Used Commands (Last 30 Days)',
        value: summary.commands.leastUsedCommands
          .map(([cmd, count], i) => `${i + 1}. **/${cmd}** - ${count} uses`)
          .join('\n'),
        inline: false,
      });
    }

    // Feature Usage
    const featureEntries = Object.entries(summary.features.usage);
    if (featureEntries.length > 0) {
      embed.addFields({
        name: 'Feature Usage (Last 7 Days)',
        value: featureEntries
          .map(([feature, count]) => `**${feature}:** ${count} uses`)
          .join('\n'),
        inline: false,
      });
    }

    // Achievements
    embed.addFields({
      name: 'Achievements',
      value: `**Unlocked (7d):** ${summary.achievements.unlocked}`,
      inline: true,
    });

    return embed;
  }

  /**
   * Create command health embed (identifies broken/underused commands)
   */
  async createCommandHealthEmbed(): Promise<EmbedBuilder> {
    const commandHealth = await this.queries.getCommandHealth(7);

    const embed = new EmbedBuilder()
      .setTitle('Command Health Report')
      .setDescription('Analysis of command performance and reliability')
      .setColor(0xffd700)
      .setTimestamp();

    // Identify problem commands
    const errorProne = commandHealth.filter((c) => c.isErrorProne);
    const underutilized = commandHealth.filter((c) => c.isUnderutilized);
    const slow = commandHealth.filter((c) => c.isSlow);

    if (errorProne.length > 0) {
      embed.addFields({
        name: 'Error-Prone Commands (Success Rate < 90%)',
        value: errorProne
          .map(
            (c) =>
              `**/${c.commandName}** - ${(c.successRate * 100).toFixed(1)}% success (${c.errorCount} errors)`
          )
          .join('\n'),
        inline: false,
      });
    }

    if (underutilized.length > 0) {
      embed.addFields({
        name: 'Underutilized Commands (< 10 uses/week)',
        value: underutilized
          .map((c) => `**/${c.commandName}** - ${c.totalExecutions} uses`)
          .join('\n'),
        inline: false,
      });
    }

    if (slow.length > 0) {
      embed.addFields({
        name: 'Slow Commands (> 3s avg response)',
        value: slow
          .map((c) => `**/${c.commandName}** - ${c.averageResponseTimeMs.toFixed(0)}ms avg`)
          .join('\n'),
        inline: false,
      });
    }

    if (errorProne.length === 0 && underutilized.length === 0 && slow.length === 0) {
      embed.setDescription('All commands are healthy! No issues detected.');
    }

    return embed;
  }

  /**
   * Create retention metrics embed
   */
  async createRetentionEmbed(): Promise<EmbedBuilder> {
    const dau = await this.queries.getDAU();
    const wau = await this.queries.getWAU();
    const mau = await this.queries.getMAU();

    // Calculate stickiness metrics
    const dauWauRatio = wau > 0 ? (dau / wau) * 100 : 0;
    const wauMauRatio = mau > 0 ? (wau / mau) * 100 : 0;

    const embed = new EmbedBuilder()
      .setTitle('User Retention Metrics')
      .setColor(0x00ff80)
      .setTimestamp();

    embed.addFields({
      name: 'Active Users',
      value: [
        `**Daily Active Users (DAU):** ${dau}`,
        `**Weekly Active Users (WAU):** ${wau}`,
        `**Monthly Active Users (MAU):** ${mau}`,
      ].join('\n'),
      inline: false,
    });

    embed.addFields({
      name: 'Stickiness Metrics',
      value: [
        `**DAU/WAU Ratio:** ${dauWauRatio.toFixed(1)}% (target: >20%)`,
        `**WAU/MAU Ratio:** ${wauMauRatio.toFixed(1)}% (target: >40%)`,
      ].join('\n'),
      inline: false,
    });

    embed.addFields({
      name: 'Interpretation',
      value: [
        'DAU/WAU > 20% = users return multiple times per week (good engagement)',
        'WAU/MAU > 40% = users return throughout the month (good retention)',
      ].join('\n'),
      inline: false,
    });

    return embed;
  }

  /**
   * Create session funnel embed (drop-off analysis)
   */
  async createSessionFunnelEmbed(): Promise<EmbedBuilder> {
    const funnel = await this.queries.getSessionFunnel(7);

    const embed = new EmbedBuilder()
      .setTitle('Session Funnel Analysis')
      .setDescription('Where do users drop off in the session flow?')
      .setColor(0xff8000)
      .setTimestamp();

    embed.addFields({
      name: 'Funnel Stages (Last 7 Days)',
      value: [
        `**Sessions Started:** ${funnel.sessionsStarted}`,
        `**Sessions Completed:** ${funnel.sessionsCompleted} (${(funnel.completionRate * 100).toFixed(1)}%)`,
        `**Sessions Cancelled:** ${funnel.sessionsCancelled} (${(funnel.cancellationRate * 100).toFixed(1)}%)`,
      ].join('\n'),
      inline: false,
    });

    embed.addFields({
      name: 'Session Quality',
      value: [
        `**Avg Duration:** ${formatDuration(funnel.averageDuration)}`,
        `**Avg XP/Session:** ${Math.round(funnel.averageXpPerSession)} XP`,
      ].join('\n'),
      inline: false,
    });

    // Health assessment
    const completionRate = funnel.completionRate * 100;
    let health = '';
    if (completionRate >= 70) {
      health = 'Healthy - Most sessions are completed';
    } else if (completionRate >= 50) {
      health = 'Moderate - Some users abandoning sessions';
    } else {
      health = 'Warning - High abandonment rate, investigate UX issues';
    }

    embed.addFields({
      name: 'Health Status',
      value: health,
      inline: false,
    });

    return embed;
  }

  /**
   * Create feature adoption embed
   */
  async createFeatureAdoptionEmbed(): Promise<EmbedBuilder> {
    const featureUsage = await this.queries.getFeatureUsage(7);

    const embed = new EmbedBuilder()
      .setTitle('Feature Adoption Report')
      .setDescription('Which features are users actually using?')
      .setColor(0xff00ff)
      .setTimestamp();

    if (featureUsage.size === 0) {
      embed.setDescription('No feature usage data available yet.');
      return embed;
    }

    // Sort by usage count descending
    const sortedFeatures = Array.from(featureUsage.entries()).sort((a, b) => b[1] - a[1]);

    embed.addFields({
      name: 'Feature Usage (Last 7 Days)',
      value: sortedFeatures
        .map(([feature, count]) => `**${this.formatFeatureName(feature)}:** ${count} users`)
        .join('\n'),
      inline: false,
    });

    return embed;
  }

  /**
   * Format feature names for display
   */
  private formatFeatureName(feature: string): string {
    const nameMap: Record<string, string> = {
      leaderboard: 'Leaderboard',
      stats: 'Personal Stats',
      feed: 'Activity Feed',
      goal_setting: 'Goal Setting',
      goal_completion: 'Goal Completion',
      reactions: 'Social Reactions',
    };

    return nameMap[feature] || feature;
  }

  /**
   * Create quick stats embed (for frequent checking)
   */
  async createQuickStatsEmbed(): Promise<EmbedBuilder> {
    const [dau, topCommands, sessionFunnel] = await Promise.all([
      this.queries.getDAU(),
      this.queries.getTopCommands(3, 1), // Top 3 commands today
      this.queries.getSessionFunnel(1), // Today's sessions
    ]);

    const embed = new EmbedBuilder()
      .setTitle('Quick Stats - Today')
      .setColor(0x00ffff)
      .setTimestamp();

    embed.addFields({
      name: 'Today at a Glance',
      value: [
        `**Active Users:** ${dau}`,
        `**Sessions:** ${sessionFunnel.sessionsCompleted} completed, ${sessionFunnel.sessionsCancelled} cancelled`,
        `**Completion Rate:** ${(sessionFunnel.completionRate * 100).toFixed(1)}%`,
      ].join('\n'),
      inline: false,
    });

    if (topCommands.length > 0) {
      embed.addFields({
        name: 'Top Commands Today',
        value: topCommands.map(([cmd, count]) => `**/${cmd}** - ${count} uses`).join('\n'),
        inline: false,
      });
    }

    return embed;
  }
}

/**
 * Helper function to handle /analytics command interaction
 *
 * Usage in bot.ts:
 * ```typescript
 * if (commandName === 'analytics') {
 *   await handleAnalyticsCommand(interaction, analyticsQueries);
 * }
 * ```
 */
export async function handleAnalyticsCommand(
  interaction: CommandInteraction,
  queries: AnalyticsQueries,
  reportType?: string
): Promise<void> {
  const dashboard = new AnalyticsDashboard(queries);

  // Default to main dashboard if no report type specified
  const type = reportType || (interaction.isChatInputCommand() ? interaction.options.getString('report') : null) || 'overview';

  await interaction.deferReply({ ephemeral: true });

  try {
    let embed: EmbedBuilder;

    switch (type) {
      case 'overview':
        embed = await dashboard.createDashboardEmbed();
        break;
      case 'commands':
        embed = await dashboard.createCommandHealthEmbed();
        break;
      case 'retention':
        embed = await dashboard.createRetentionEmbed();
        break;
      case 'sessions':
        embed = await dashboard.createSessionFunnelEmbed();
        break;
      case 'features':
        embed = await dashboard.createFeatureAdoptionEmbed();
        break;
      case 'quick':
        embed = await dashboard.createQuickStatsEmbed();
        break;
      default:
        embed = await dashboard.createDashboardEmbed();
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error('[Analytics] Dashboard error:', error);
    await interaction.editReply({
      content: `Failed to generate analytics report: ${error.message}`,
    });
  }
}
