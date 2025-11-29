/**
 * /analytics Command
 *
 * View bot analytics dashboard (Admin only).
 */

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../types';
import { AnalyticsQueries } from '../../services/analytics.queries';
import { handleAnalyticsCommand } from '../../services/analytics.dashboard';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('View bot analytics dashboard (admin only)')
    .addStringOption((option) =>
      option
        .setName('report')
        .setDescription('Type of analytics report to view')
        .setRequired(false)
        .addChoices(
          { name: 'Overview', value: 'overview' },
          { name: 'Active Users', value: 'users' },
          { name: 'Command Health', value: 'commands' },
          { name: 'Retention Metrics', value: 'retention' },
          { name: 'Session Funnel', value: 'sessions' },
          { name: 'Feature Adoption', value: 'features' },
          { name: 'Quick Stats', value: 'quick' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;

    // Check if user has admin permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Only server administrators can view analytics.',
        ephemeral: true,
      });
      return;
    }

    // Create analytics queries instance
    const analyticsQueries = new AnalyticsQueries(db);

    // Get the report type
    const reportType = interaction.options.getString('report') || undefined;

    // Delegate to the dashboard handler
    await handleAnalyticsCommand(interaction, analyticsQueries, reportType);
  },
};
