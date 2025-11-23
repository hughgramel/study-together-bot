/**
 * /testgroupleaderboard Command - TEST COMMAND
 *
 * UI mock-up for group leaderboard with sample data.
 * Displays 12 sample groups with pagination for testing the leaderboard UI.
 *
 * @internal This is a testing command and should not be used in production
 */

import { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { Command } from '../types';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TestGroupLeaderboardCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testgroupleaderboard')
    .setDescription('View group leaderboard (UI mock-up with sample data)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      // Extended sample data for testing pagination (12 groups total)
      const allSampleGroups = [
        {
          rank: 1,
          groupName: 'Study Warriors',
          groupId: 'STUDY001',
          currentMembers: 5,
          maxMembers: 5,
          groupLevel: 42,
          ownerUsername: 'alice',
        },
        {
          rank: 2,
          groupName: 'Code Crushers',
          groupId: 'CODE789',
          currentMembers: 5,
          maxMembers: 5,
          groupLevel: 38,
          ownerUsername: 'bob',
        },
        {
          rank: 3,
          groupName: 'Math Masters',
          groupId: 'MATH456',
          currentMembers: 4,
          maxMembers: 5,
          groupLevel: 35,
          ownerUsername: 'charlie',
        },
        {
          rank: 4,
          groupName: 'Focus Squad',
          groupId: 'FOCUS123',
          currentMembers: 5,
          maxMembers: 5,
          groupLevel: 28,
          ownerUsername: 'diana',
        },
        {
          rank: 5,
          groupName: 'Deep Work Crew',
          groupId: 'DEEP999',
          currentMembers: 3,
          maxMembers: 5,
          groupLevel: 22,
          ownerUsername: 'eve',
        },
        {
          rank: 6,
          groupName: 'Night Owls',
          groupId: 'NIGHT555',
          currentMembers: 4,
          maxMembers: 5,
          groupLevel: 19,
          ownerUsername: 'frank',
        },
        {
          rank: 7,
          groupName: 'Early Birds',
          groupId: 'EARLY888',
          currentMembers: 5,
          maxMembers: 5,
          groupLevel: 17,
          ownerUsername: 'grace',
        },
        {
          rank: 8,
          groupName: 'The Grinders',
          groupId: 'GRIND444',
          currentMembers: 3,
          maxMembers: 5,
          groupLevel: 15,
          ownerUsername: 'henry',
        },
        {
          rank: 9,
          groupName: 'Exam Prep Squad',
          groupId: 'EXAM222',
          currentMembers: 5,
          maxMembers: 5,
          groupLevel: 12,
          ownerUsername: 'iris',
        },
        {
          rank: 10,
          groupName: 'Thesis Writers',
          groupId: 'THESIS777',
          currentMembers: 2,
          maxMembers: 5,
          groupLevel: 10,
          ownerUsername: 'jack',
        },
        {
          rank: 11,
          groupName: 'Language Learners',
          groupId: 'LANG333',
          currentMembers: 4,
          maxMembers: 5,
          groupLevel: 8,
          ownerUsername: 'karen',
        },
        {
          rank: 12,
          groupName: 'Creative Minds',
          groupId: 'CREATE666',
          currentMembers: 3,
          maxMembers: 5,
          groupLevel: 5,
          ownerUsername: 'leo',
        },
      ];

      // Show first page (ranks 1-5)
      const page = 0;
      const pageSize = 5;
      const totalPages = Math.ceil(allSampleGroups.length / pageSize);
      const sampleGroups = allSampleGroups.slice(page * pageSize, (page + 1) * pageSize);

      // Generate group leaderboard image
      const imageBuffer = await groupOverviewImageService.generateGroupLeaderboardImage(sampleGroups);

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-leaderboard.png' });

      // Create pagination buttons
      const prevButton = new ButtonBuilder()
        .setCustomId(`group_leaderboard_page:${page - 1}:test`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);

      const nextButton = new ButtonBuilder()
        .setCustomId(`group_leaderboard_page:${page + 1}:test`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1);

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

      // Send the image with pagination buttons
      await interaction.editReply({
        content: `**Group Leaderboard (UI Mock-up)** - Page ${page + 1}/${totalPages}`,
        files: [attachment],
        components: [buttonRow],
      });

      logger.info('Test group leaderboard generated successfully');
    } catch (error) {
      logger.error('Error generating group leaderboard:', error);
      await interaction.editReply({
        content: '❌ Failed to generate group leaderboard. Please try again later.',
      });
    }
  },
};
