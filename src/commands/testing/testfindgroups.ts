/**
 * /testfindgroups Command - TEST COMMAND
 *
 * UI mock-up for find groups with sample data and pagination.
 * Displays 8 sample groups across multiple pages for testing the find groups UI.
 *
 * @internal This is a testing command and should not be used in production
 */

import { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import type { Command } from '../types';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TestFindGroupsCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('testfindgroups')
    .setDescription('Browse groups (UI mock-up with sample data)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      // Sample data for testing findgroups UI - 8 groups for pagination demo
      const allSampleGroups = [
        {
          groupId: 'STUDY001',
          groupName: 'Study Warriors',
          groupLevel: 42,
          xpModifier: 0.42,
          currentMembers: 5,
          maxMembers: 5,
        },
        {
          groupId: 'CODE789',
          groupName: 'Code Crushers',
          groupLevel: 38,
          xpModifier: 0.38,
          currentMembers: 5,
          maxMembers: 5,
        },
        {
          groupId: 'MATH456',
          groupName: 'Math Masters',
          groupLevel: 35,
          xpModifier: 0.35,
          currentMembers: 4,
          maxMembers: 5,
        },
        {
          groupId: 'FOCUS123',
          groupName: 'Focus Squad',
          groupLevel: 28,
          xpModifier: 0.28,
          currentMembers: 5,
          maxMembers: 5,
        },
        {
          groupId: 'DEEP999',
          groupName: 'Deep Work Crew',
          groupLevel: 22,
          xpModifier: 0.22,
          currentMembers: 3,
          maxMembers: 5,
        },
        {
          groupId: 'GRIND555',
          groupName: 'Grind Gang',
          groupLevel: 18,
          xpModifier: 0.18,
          currentMembers: 2,
          maxMembers: 5,
        },
        {
          groupId: 'LEARN777',
          groupName: 'Learn Together',
          groupLevel: 15,
          xpModifier: 0.15,
          currentMembers: 4,
          maxMembers: 5,
        },
        {
          groupId: 'HUSTLE88',
          groupName: 'Hustle Hub',
          groupLevel: 12,
          xpModifier: 0.12,
          currentMembers: 1,
          maxMembers: 5,
        },
      ];

      // Page 1 - first 5 groups
      const page = 0;
      const pageSize = 5;
      const totalPages = Math.ceil(allSampleGroups.length / pageSize);
      const sampleGroups = allSampleGroups.slice(page * pageSize, (page + 1) * pageSize);

      // Generate find groups image
      const imageBuffer = await groupOverviewImageService.generateFindGroupsImage(
        sampleGroups,
        page + 1,
        totalPages
      );

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'find-groups.png' });

      // Create pagination buttons
      const prevButton = new ButtonBuilder()
        .setCustomId(`find_groups_page:${page - 1}:test`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);

      const nextButton = new ButtonBuilder()
        .setCustomId(`find_groups_page:${page + 1}:test`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1);

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

      // Send the image with pagination buttons
      await interaction.editReply({
        content: `**Find Groups (UI Mock-up)** - Page ${page + 1}/${totalPages}`,
        files: [attachment],
        components: [buttonRow],
      });

      logger.info('Test findgroups generated successfully');
    } catch (error) {
      logger.error('Error showing test findgroups:', error);
      await interaction.editReply({
        content: '❌ Failed to show test findgroups. Please try again later.',
      });
    }
  },
};
