/**
 * Group Button Handlers
 *
 * Handles button interactions for group management operations.
 * Extracted from bot.legacy.ts to maintain modular architecture.
 */

import { ButtonInteraction, Client } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { GroupService } from '../../services/groups';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupButtons');

/**
 * Handle group-related button interactions
 *
 * @param interaction - The button interaction
 * @param db - Firestore database instance
 * @param client - Discord client instance
 */
export async function handleGroupButtons(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const groupService = new GroupService(db);
  const user = interaction.user;

  // Group admin delete confirmation
  if (interaction.customId.startsWith('groupadmin_delete_confirm:')) {
    const parts = interaction.customId.split(':');
    const groupId = parts[1];
    const originalUserId = parts[2];

    // Verify this is the same user who initiated the deletion
    if (user.id !== originalUserId) {
      await interaction.reply({
        content: '❌ Only the user who initiated the deletion can confirm it.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      // Get group info before deletion for notifications
      const group = await groupService.getGroup(groupId);
      if (!group) {
        await interaction.editReply({
          content: '❌ Group not found. It may have already been deleted.',
          components: [],
        });
        return;
      }

      // Get all members to notify them
      const members = await groupService.getGroupMembers(groupId);

      // Delete the group
      await groupService.deleteGroup(groupId);

      // Send success message to the owner
      await interaction.editReply({
        content: `✅ **${group.name}** has been permanently deleted.\n\nAll ${group.memberCount} member(s) have been removed from the group.`,
        components: [],
      });

      // Notify all members (except owner who already got confirmation)
      // Note: We attempt to notify via DM, but this is best-effort
      for (const memberData of members) {
        if (memberData.membership.userId !== user.id) {
          try {
            const memberUser = await client.users.fetch(memberData.membership.userId);
            await memberUser.send(
              `📢 The group **${group.name}** has been deleted by the owner.\n\nYou are no longer a member of this group.`
            ).catch(() => {
              logger.warn(`Could not DM user ${memberData.membership.userId} about group deletion`);
            });
          } catch (error) {
            logger.warn(`Could not fetch user ${memberData.membership.userId} for group deletion notification`);
          }
        }
      }

      logger.info(`${user.username} deleted group ${group.name} (${groupId})`);
    } catch (error) {
      logger.error('Error confirming group deletion:', error);
      await interaction.editReply({
        content: '❌ Failed to delete group. Please try again later.',
        components: [],
      });
    }
    return;
  }

  // Group admin delete cancellation
  if (interaction.customId.startsWith('groupadmin_delete_cancel:')) {
    const parts = interaction.customId.split(':');
    const originalUserId = parts[2];

    // Verify this is the same user who initiated the deletion
    if (user.id !== originalUserId) {
      await interaction.reply({
        content: '❌ Only the user who initiated the deletion can cancel it.',
        ephemeral: true,
      });
      return;
    }

    await interaction.update({
      content: '❌ Group deletion cancelled. Your group is safe.',
      components: [],
    });
    return;
  }
}
