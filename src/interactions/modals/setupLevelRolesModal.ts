/**
 * Setup Level Roles Modal Handler
 *
 * Handles submission of level roles configuration modal.
 */

import { ModalSubmitInteraction, Client } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { createLogger } from '../../utils/logger';
import { setLevelRoleConfig } from '../../services/levelRoles';
import { LevelRoleConfig } from '../../types';

const logger = createLogger('SetupLevelRolesModal');

/**
 * Parse level roles configuration from text input
 * Format: "level:roleId" one per line
 * Example:
 *   10:1234567890123456789
 *   25:9876543210987654321
 */
function parseLevelRoles(
  input: string,
  guild: { roles: { cache: Map<string, { id: string; name: string }> } }
): { roles: LevelRoleConfig[]; errors: string[] } {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const roles: LevelRoleConfig[] = [];
  const errors: string[] = [];
  const seenLevels = new Set<number>();
  const seenRoles = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(':');

    if (parts.length !== 2) {
      errors.push(`Line ${i + 1}: Invalid format "${line}" (use level:roleId)`);
      continue;
    }

    const level = parseInt(parts[0].trim(), 10);
    const roleId = parts[1].trim();

    // Validate level
    if (isNaN(level) || level < 1 || level > 1000) {
      errors.push(`Line ${i + 1}: Invalid level "${parts[0]}" (must be 1-1000)`);
      continue;
    }

    // Validate role ID format (Discord snowflake)
    if (!/^\d{17,20}$/.test(roleId)) {
      errors.push(`Line ${i + 1}: Invalid role ID "${roleId}"`);
      continue;
    }

    // Check for duplicate levels
    if (seenLevels.has(level)) {
      errors.push(`Line ${i + 1}: Duplicate level ${level}`);
      continue;
    }

    // Check for duplicate roles
    if (seenRoles.has(roleId)) {
      errors.push(`Line ${i + 1}: Role ${roleId} already used`);
      continue;
    }

    // Verify role exists in guild
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      errors.push(`Line ${i + 1}: Role ${roleId} not found in server`);
      continue;
    }

    seenLevels.add(level);
    seenRoles.add(roleId);

    roles.push({
      level,
      roleId,
      roleName: role.name,
    });
  }

  return { roles, errors };
}

/**
 * Handle setup level roles modal submission
 */
export async function handleSetupLevelRolesModal(
  interaction: ModalSubmitInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const guildId = interaction.customId.split(':')[1];

  if (!guildId || guildId !== interaction.guildId) {
    await interaction.reply({
      content: 'Invalid guild ID in modal.',
      ephemeral: true,
    });
    return;
  }

  const guild = await client.guilds.fetch(guildId);
  if (!guild) {
    await interaction.reply({
      content: 'Guild not found.',
      ephemeral: true,
    });
    return;
  }

  // Check admin permission
  if (!interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({
      content: 'Only server administrators can configure level roles.',
      ephemeral: true,
    });
    return;
  }

  try {
    const rolesInput = interaction.fields.getTextInputValue('roles').trim();

    // If empty, clear all level roles
    if (rolesInput.length === 0) {
      await setLevelRoleConfig(db, guildId, interaction.user.id, []);
      await interaction.reply({
        content: '✅ Level roles cleared. No automatic role assignment will occur.',
        ephemeral: true,
      });
      return;
    }

    // Parse and validate input
    const { roles, errors } = parseLevelRoles(rolesInput, guild);

    if (errors.length > 0 && roles.length === 0) {
      // All entries failed validation
      await interaction.reply({
        content: `❌ **Configuration failed:**\n\n${errors.join('\n')}\n\n**Format:** level:roleId (one per line)\n**Example:**\n10:1234567890123456789\n25:9876543210987654321`,
        ephemeral: true,
      });
      return;
    }

    // Save configuration
    await setLevelRoleConfig(db, guildId, interaction.user.id, roles);

    // Build success message
    let message = `✅ **Level roles configured successfully!**\n\n`;
    message += `**Active roles (${roles.length}):**\n`;
    roles.forEach((r) => {
      message += `• Level ${r.level} → <@&${r.roleId}> (${r.roleName})\n`;
    });

    if (errors.length > 0) {
      message += `\n⚠️ **Some entries were skipped:**\n${errors.join('\n')}`;
    }

    message += `\n\n**Next steps:**\n1. Run \`/sync-roles\` to assign roles to all existing members\n2. New members will automatically receive roles when they level up`;

    await interaction.reply({
      content: message,
      ephemeral: true,
    });

    logger.info(
      `Level roles configured for guild ${guildId}: ${roles.length} roles, ${errors.length} errors`
    );
  } catch (error) {
    logger.error('Error handling level roles modal', error);
    await interaction.reply({
      content: 'An error occurred while saving the configuration. Please try again.',
      ephemeral: true,
    });
  }
}
