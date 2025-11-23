/**
 * /goal Command
 *
 * Goal management with subcommands: add, complete, list.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { DailyGoalService } from '../../services/dailyGoal';
import { TaskService } from '../../services/tasks';
import { XPService } from '../../services/xp';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GoalCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('goal')
    .setDescription('Manage your goals')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new goal')
        .addStringOption(option =>
          option
            .setName('goal')
            .setDescription('Your goal (e.g., "Finish homework")')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('difficulty')
            .setDescription('Goal difficulty')
            .setRequired(true)
            .addChoices(
              { name: 'Easy (50 XP)', value: 'easy' },
              { name: 'Medium (100 XP)', value: 'medium' },
              { name: 'Hard (200 XP)', value: 'hard' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('complete')
        .setDescription('Mark a goal as complete')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View all your goals')
    ),

  async execute(interaction, context) {
    const { db } = context;
    const user = interaction.user;
    const subcommand = interaction.options.getSubcommand();
    const dailyGoalService = new DailyGoalService(db);

    if (subcommand === 'add') {
      // /goal add
      const goalText = interaction.options.getString('goal', true);
      const difficulty = interaction.options.getString('difficulty', true) as 'easy' | 'medium' | 'hard';

      await interaction.deferReply({ ephemeral: false });

      try {
        logger.info(`User ${user.username} (${user.id}) adding goal: ${goalText} (${difficulty})`);

        // Add the goal
        const newGoal = await dailyGoalService.addGoal(user.id, user.username, goalText, difficulty);

        const xpAmount = difficulty === 'easy' ? 50 : difficulty === 'medium' ? 100 : 200;

        const embed = new EmbedBuilder()
          .setColor(0x58CC02) // Green
          .setTitle('Goal Added!')
          .setDescription(`**${goalText}**`)
          .addFields(
            { name: 'Difficulty', value: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`, inline: true },
            { name: 'Reward', value: `${xpAmount} XP upon completion`, inline: true }
          )
          .setFooter({ text: 'Use /goal complete to mark as done!' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Goal added successfully for user ${user.id}`);
      } catch (error) {
        logger.error('Error adding goal', error);
        await interaction.editReply({
          content: 'An error occurred while adding your goal. Please try again.',
        });
      }
      return;
    }

    if (subcommand === 'complete') {
      // /goal complete
      await interaction.deferReply({ ephemeral: false });

      try {
        logger.info(`User ${user.username} (${user.id}) completing a goal`);

        // Get active goals
        const activeGoals = await dailyGoalService.getActiveGoals(user.id);

        if (activeGoals.length === 0) {
          await interaction.editReply({
            content: 'You have no active goals! Use `/goal add` to create one.',
          });
          return;
        }

        // Create select menu for goal selection
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`goal_complete:${user.id}`)
          .setPlaceholder('Select a goal to mark as complete')
          .addOptions(
            activeGoals.map((goal) => {
              const xpAmount = goal.difficulty === 'easy' ? 50 : goal.difficulty === 'medium' ? 100 : 200;

              return {
                label: goal.text.substring(0, 100), // Discord limit
                description: `${goal.difficulty.charAt(0).toUpperCase() + goal.difficulty.slice(1)} - ${xpAmount} XP`,
                value: goal.id,
              };
            })
          );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const embed = new EmbedBuilder()
          .setColor(0x1CB0F6) // Blue
          .setTitle('Complete a Goal')
          .setDescription('Select which goal you completed:')
          .setFooter({ text: `${activeGoals.length} active ${activeGoals.length === 1 ? 'goal' : 'goals'}` });

        await interaction.editReply({ embeds: [embed], components: [row] });

        logger.info(`Goal selection menu displayed to user ${user.id}`);
      } catch (error) {
        logger.error('Error showing goals for completion', error);
        await interaction.editReply({
          content: 'An error occurred while loading your goals. Please try again.',
        });
      }
      return;
    }

    if (subcommand === 'list') {
      // /goal list
      await interaction.deferReply({ ephemeral: false });

      try {
        logger.info(`User ${user.username} (${user.id}) listing goals`);

        const allGoals = await dailyGoalService.getAllGoals(user.id);

        if (allGoals.length === 0) {
          await interaction.editReply({
            content: 'You have no goals yet! Use `/goal add` to create one.',
          });
          return;
        }

        const activeGoals = allGoals.filter(g => !g.isCompleted);
        const completedGoals = allGoals.filter(g => g.isCompleted);

        const embed = new EmbedBuilder()
          .setColor(0xFFD900) // Yellow
          .setTitle('Your Goals');

        // Add active goals
        if (activeGoals.length > 0) {
          const activeList = activeGoals.map((goal) => {
            const xpAmount = goal.difficulty === 'easy' ? 50 : goal.difficulty === 'medium' ? 100 : 200;
            return `**${goal.text}** (${xpAmount} XP)`;
          }).join('\n');

          embed.addFields({ name: 'Active Goals', value: activeList, inline: false });
        } else {
          embed.addFields({ name: 'Active Goals', value: 'No active goals! Use `/goal add` to create one.', inline: false });
        }

        // Show completed count only
        embed.setFooter({
          text: `${activeGoals.length} active • ${completedGoals.length} completed`
        });

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Goals list displayed to user ${user.id}`);
      } catch (error) {
        logger.error('Error listing goals', error);
        await interaction.editReply({
          content: 'An error occurred while loading your goals. Please try again.',
        });
      }
      return;
    }
  },
};
