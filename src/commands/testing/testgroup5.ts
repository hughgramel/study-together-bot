/**
 * /testgroup5 Command - TEST COMMAND
 *
 * UI mock-up for group overview with 5 members (full group).
 * Displays sample group data for testing the group overview UI with maximum capacity.
 *
 * @internal This is a testing command and should not be used in production
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../types';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TestGroup5Command');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testgroup5')
    .setDescription('View group overview with 5 members (UI mock-up)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      // Sample group data
      const groupRank = 2;
      const groupName = 'Full Squad';
      const groupId = 'GRP456';
      const currentMembers = 5;
      const maxMembers = 5;
      const groupLevel = 5;
      const totalXpModifier = 0.005; // 0.5% when displayed as percentage
      const currentLevelHours = 80; // Current hours towards next level
      const nextLevelHours = 100; // Hours needed for next level
      const nextLevelXpModifier = 0.006; // 0.6% at next level

      // Sample leaderboard members - all 5 slots filled
      const members = [
        {
          rank: 1,
          username: 'TopStudier',
          hours: 25,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        {
          rank: 2,
          username: 'GrindMaster',
          hours: 22,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png'
        },
        {
          rank: 3,
          username: 'FocusPro',
          hours: 18,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png'
        },
        {
          rank: 4,
          username: 'StudyBuddy',
          hours: 15,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/3.png'
        },
        {
          rank: 5,
          username: 'LearnFast',
          hours: 12,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/4.png'
        },
      ];

      // Generate the group overview image
      const imageBuffer = await groupOverviewImageService.generateGroupOverviewImage(
        groupRank,
        groupName,
        groupId,
        currentMembers,
        maxMembers,
        groupLevel,
        totalXpModifier,
        currentLevelHours,
        nextLevelHours,
        nextLevelXpModifier,
        members
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-overview-6.png' });

      // Send the preview
      await interaction.editReply({
        content: '**Group Overview - Full Group (UI Mock-up)**',
        files: [attachment],
      });

      logger.info('Test group5 overview generated successfully');
    } catch (error) {
      logger.error('Error generating group overview:', error);
      await interaction.editReply({
        content: '❌ Failed to generate group overview. Please try again later.',
      });
    }
  },
};
