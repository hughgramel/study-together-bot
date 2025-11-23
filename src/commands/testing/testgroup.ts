/**
 * /testgroup Command - TEST COMMAND
 *
 * UI mock-up for group overview with 3 members.
 * Displays sample group data for testing the group overview UI.
 *
 * @internal This is a testing command and should not be used in production
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../types';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TestGroupCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testgroup')
    .setDescription('View group overview (UI mock-up)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      // Sample group data
      const groupRank = 1;
      const groupName = 'group name';
      const groupId = 'GRP123';
      const currentMembers = 3;
      const maxMembers = 5;
      const groupLevel = 3;
      const totalXpModifier = 0.003; // 0.3% when displayed as percentage
      const currentLevelHours = 24; // Current hours towards next level
      const nextLevelHours = 50; // Hours needed for next level
      const nextLevelXpModifier = 0.004; // 0.4% at next level

      // Sample leaderboard members
      const members = [
        {
          rank: 1,
          username: 'hgram',
          hours: 10,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        {
          rank: 2,
          username: 'hameeth',
          hours: 8,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png'
        },
        {
          rank: 3,
          username: 'member3',
          hours: 6,
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png'
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
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-overview.png' });

      // Send the preview
      await interaction.editReply({
        content: '**Group Overview (UI Mock-up)**',
        files: [attachment],
      });

      logger.info('Test group overview generated successfully');
    } catch (error) {
      logger.error('Error generating group overview:', error);
      await interaction.editReply({
        content: '❌ Failed to generate group overview. Please try again later.',
      });
    }
  },
};
