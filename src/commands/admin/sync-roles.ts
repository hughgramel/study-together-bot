/**
 * /sync-roles Command
 *
 * Sync level-based roles for all members in the server (Admin only).
 * Assigns appropriate roles based on each user's current level.
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../types';
import { syncAllRoles, getLevelRoleConfig } from '../../services/levelRoles';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SyncRolesCommand');

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sync-roles')
    .setDescription('Sync level-based roles for all server members (Admin only)')
    .addBooleanOption((option) =>
      option
        .setName('dry-run')
        .setDescription('Preview changes without actually modifying roles')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, context) {
    const { db, client } = context;
    const guildId = interaction.guildId;
    const dryRun = interaction.options.getBoolean('dry-run') ?? false;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    // Check if user has admin permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Only server administrators can sync roles.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Check if level roles are configured
      const levelRoles = await getLevelRoleConfig(db, guildId);
      if (levelRoles.length === 0) {
        await interaction.reply({
          content:
            '❌ No level roles configured.\n\nUse `/setup-level-roles` first to configure automatic role assignment.',
          ephemeral: true,
        });
        return;
      }

      // Defer reply since this will take a while
      await interaction.deferReply({ ephemeral: true });

      logger.info(
        `User ${interaction.user.username} started role sync${dryRun ? ' (DRY RUN)' : ''} for guild ${guildId}`
      );

      let lastUpdate = Date.now();
      let progressMessage = '';

      // Sync all roles with progress updates
      const results = await syncAllRoles(
        db,
        client,
        guildId,
        (current, total, username) => {
          // Update progress every 2 seconds to avoid rate limits
          const now = Date.now();
          if (now - lastUpdate > 2000) {
            lastUpdate = now;
            const percent = Math.round((current / total) * 100);
            progressMessage = `${dryRun ? '🔍 Previewing' : '⏳ Syncing'} roles... ${current}/${total} (${percent}%)\nCurrent: ${username}`;

            // Edit the deferred reply with progress
            interaction
              .editReply(progressMessage)
              .catch((err) => logger.warn('Failed to update progress', err));
          }
        },
        dryRun // Pass dry-run flag
      );

      // Build final report
      const embed = new EmbedBuilder()
        .setTitle(dryRun ? '🔍 Role Sync Preview (Dry Run)' : '✅ Role Sync Complete')
        .setColor(dryRun ? 0xffaa00 : 0x00ff00)
        .addFields([
          {
            name: '📊 Summary',
            value: dryRun
              ? `**Total members:** ${results.total}\n**Would be synced:** ${results.synced}\n**Errors:** ${results.errors}\n\n⚠️ **No changes were made** - this was a preview only.`
              : `**Total members:** ${results.total}\n**Successfully synced:** ${results.synced}\n**Errors:** ${results.errors}`,
          },
          {
            name: '🎭 Configured Roles',
            value: levelRoles
              .map((r) => `Level ${r.level} → <@&${r.roleId}>`)
              .join('\n'),
          },
        ])
        .setTimestamp();

      // Add preview details if dry run
      if (dryRun && results.changes && results.changes.length > 0) {
        const changePreview = results.changes
          .slice(0, 10)
          .map((c) => {
            const added = c.roleAdded ? `+<@&${c.roleAdded}>` : '';
            const removed = c.rolesRemoved.length > 0
              ? c.rolesRemoved.map(r => `-<@&${r}>`).join(' ')
              : '';
            const changes = [added, removed].filter(Boolean).join(' ');
            return `• ${c.username}: ${changes || 'No changes'}`;
          })
          .join('\n');

        embed.addFields([
          {
            name: '🔄 Sample Changes (First 10)',
            value: changePreview || 'No changes detected',
          },
        ]);

        if (results.changes.length > 10) {
          embed.setFooter({
            text: `... and ${results.changes.length - 10} more members would be affected. Run without --dry-run to apply changes.`,
          });
        } else {
          embed.setFooter({
            text: 'Run without --dry-run to apply these changes.',
          });
        }
      }

      if (results.errors > 0) {
        const errorDetails = results.details
          .filter((d) => d.error)
          .slice(0, 10) // Limit to first 10 errors
          .map((d) => `• ${d.username}: ${d.error}`)
          .join('\n');

        embed.addFields([
          {
            name: '⚠️ Errors',
            value:
              errorDetails || 'Unknown errors occurred.',
          },
        ]);

        if (results.errors > 10) {
          embed.setFooter({
            text: `... and ${results.errors - 10} more errors. Check logs for details.`,
          });
        }
      }

      await interaction.editReply({
        content: '',
        embeds: [embed],
      });

      logger.info(
        `Role sync completed for guild ${guildId}: ${results.synced} synced, ${results.errors} errors`
      );
    } catch (error) {
      logger.error('Error syncing roles', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred';

      await interaction
        .editReply({
          content: `❌ **Role sync failed:**\n${errorMessage}\n\nPlease check:\n• Bot has "Manage Roles" permission\n• Bot's role is above the roles it needs to assign\n• Level roles are properly configured`,
        })
        .catch(() => {
          // If editReply fails, try regular reply
          interaction.reply({
            content: `❌ Role sync failed: ${errorMessage}`,
            ephemeral: true,
          });
        });
    }
  },
};
