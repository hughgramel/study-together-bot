/**
 * /admin activeusers Command
 *
 * Shows an ephemeral leaderboard of all active users with analytics data (Admin only).
 * Displays users who have logged significant hours with their total time and stats.
 */

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../types';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('activeusers')
    .setDescription('View all active users with analytics data (admin only)')
    .addIntegerOption((option) =>
      option
        .setName('minimum_hours')
        .setDescription('Minimum hours to be considered active (default: 1)')
        .setRequired(false)
        .setMinValue(0)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db } = context;

    // Check if user has admin permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Only server administrators can view active users.',
        ephemeral: true,
      });
      return;
    }

    // Defer reply as this might take a moment
    await interaction.deferReply({ ephemeral: true });

    const minimumHours = interaction.options.getInteger('minimum_hours') ?? 1;
    const minimumSeconds = minimumHours * 3600;

    try {
      // Fetch all user stats
      const snapshot = await db
        .collection('discord-data')
        .doc('userStats')
        .collection('stats')
        .orderBy('totalDuration', 'desc')
        .get();

      if (snapshot.empty) {
        await interaction.editReply({
          content: 'No user data found.',
        });
        return;
      }

      // Filter users by minimum hours and collect data
      const activeUsers = snapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return (data.totalDuration || 0) >= minimumSeconds;
        })
        .map((doc, index) => {
          const data = doc.data();
          const totalHours = ((data.totalDuration || 0) / 3600).toFixed(1);
          const totalSessions = data.totalSessions || 0;
          const currentStreak = data.currentStreak || 0;
          const level = data.level || 0;
          const xp = data.xp || 0;

          return {
            rank: index + 1,
            userId: doc.id,
            username: data.username || 'Unknown',
            totalHours: parseFloat(totalHours),
            totalSessions,
            currentStreak,
            level,
            xp,
          };
        });

      if (activeUsers.length === 0) {
        await interaction.editReply({
          content: `No users found with at least ${minimumHours} hour${minimumHours !== 1 ? 's' : ''} of activity.`,
        });
        return;
      }

      // Calculate total stats
      const totalHours = activeUsers.reduce((sum, user) => sum + user.totalHours, 0);
      const totalSessions = activeUsers.reduce((sum, user) => sum + user.totalSessions, 0);
      const avgHoursPerUser = (totalHours / activeUsers.length).toFixed(1);

      // Create embed with user list
      // Discord embeds have a 4096 character limit for description
      // We'll split into multiple embeds if needed
      const embeds: EmbedBuilder[] = [];
      const usersPerEmbed = 25; // Discord limit for fields

      for (let i = 0; i < activeUsers.length; i += usersPerEmbed) {
        const chunk = activeUsers.slice(i, i + usersPerEmbed);
        const isFirstEmbed = i === 0;

        const embed = new EmbedBuilder()
          .setColor(0x0080ff)
          .setTimestamp();

        if (isFirstEmbed) {
          embed
            .setTitle(`📊 Active Users Analytics`)
            .setDescription(
              `Showing ${activeUsers.length} users with ≥${minimumHours}h of activity\n\n` +
              `**Total Hours:** ${totalHours.toFixed(1)}h\n` +
              `**Total Sessions:** ${totalSessions.toLocaleString()}\n` +
              `**Average per User:** ${avgHoursPerUser}h\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━`
            );
        } else {
          embed.setTitle(`📊 Active Users Analytics (continued)`);
        }

        // Add users as fields
        chunk.forEach((user) => {
          const streakEmoji = user.currentStreak >= 7 ? '🔥' : '';
          embed.addFields({
            name: `${user.rank}. ${user.username}`,
            value:
              `**${user.totalHours}h** | ${user.totalSessions} sessions | Lvl ${user.level}\n` +
              `Streak: ${user.currentStreak} days ${streakEmoji}`,
            inline: false,
          });
        });

        embeds.push(embed);
      }

      // Send all embeds (Discord allows up to 10 embeds per message)
      if (embeds.length <= 10) {
        await interaction.editReply({
          embeds,
        });
      } else {
        // If more than 10 embeds needed, send first 10 and inform about limit
        await interaction.editReply({
          content: `Showing first ${usersPerEmbed * 10} of ${activeUsers.length} active users (Discord embed limit).`,
          embeds: embeds.slice(0, 10),
        });
      }
    } catch (error) {
      console.error('Error fetching active users:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching active user data. Please try again.',
      });
    }
  },
};
