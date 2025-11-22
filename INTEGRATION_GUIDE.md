# Group Commands Integration Guide

## Quick Start: Adding Commands to Registry

Update `/src/commands/index.ts`:

```typescript
/**
 * Load all commands
 */
export async function loadCommands(): Promise<void> {
  logger.info('Loading commands...');

  // Session commands
  const sessionCommands = [
    '../commands/session/start',
    '../commands/session/stop',
    '../commands/session/pause',
    '../commands/session/unpause',
    '../commands/session/time',
    '../commands/session/cancel',
  ];

  // Stats commands
  const statsCommands = [
    '../commands/stats/me',
  ];

  // Group commands
  const groupCommands = [
    '../commands/groups/group',
    '../commands/groups/creategroup',
    '../commands/groups/joingroup',
    '../commands/groups/leavegroup',
    '../commands/groups/group_leaderboard',
    '../commands/groups/findgroups',
    '../commands/groups/groupadmin',
  ];

  // Combine all command paths
  const allCommands = [...sessionCommands, ...statsCommands, ...groupCommands];

  // Rest of the function remains the same...
}
```

## Button Interaction Handlers

### Option 1: Add to bot.ts (Temporary)

If you want to keep button handlers in the main bot file for now, they're already working in `bot.legacy.ts`. You can copy them directly.

### Option 2: Create Interaction Module (Recommended)

Create `/src/interactions/buttons/groupButtons.ts`:

```typescript
/**
 * Group Button Interaction Handlers
 */

import { ButtonInteraction, Client, AttachmentBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Firestore } from 'firebase-admin/firestore';
import { GroupService } from '../../services/groups';
import { groupOverviewImageService } from '../../services/groupOverviewImage';
import { createLogger } from '../../utils/logger';
import { groupPaginations } from '../../commands/groups/findgroups';

const logger = createLogger('GroupButtons');

/**
 * Handle group admin delete confirmation
 */
export async function handleGroupDeleteConfirm(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<void> {
  const parts = interaction.customId.split(':');
  const groupId = parts[1];
  const originalUserId = parts[2];
  const user = interaction.user;

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
    const groupService = new GroupService(db);

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
      content: `✅ **${group.name}** has been permanently deleted.\\n\\nAll ${group.memberCount} member(s) have been removed from the group.`,
      components: [],
    });

    // Notify all members (except owner who already got confirmation)
    const guildId = interaction.guildId;
    if (guildId) {
      const guild = await client.guilds.fetch(guildId);
      for (const memberData of members) {
        if (memberData.membership.userId !== user.id) {
          try {
            const member = await guild.members.fetch(memberData.membership.userId);
            await member.send(
              `📢 The group **${group.name}** has been deleted by the owner.\\n\\nYou are no longer a member of this group.`
            ).catch(() => {
              logger.info(`Could not DM user ${memberData.membership.userId} about group deletion`);
            });
          } catch (error) {
            logger.info(`Could not fetch member ${memberData.membership.userId}`);
          }
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
}

/**
 * Handle group admin delete cancellation
 */
export async function handleGroupDeleteCancel(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const originalUserId = parts[2];
  const user = interaction.user;

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
}

/**
 * Handle find groups pagination
 */
export async function handleFindGroupsPagination(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  const user = interaction.user;
  const parts = interaction.customId.split(':');
  const paginationId = `${parts[0]}:${parts[1]}:${parts[2]}`;
  const action = parts[3]; // 'prev' or 'next'

  const paginationState = groupPaginations.get(paginationId);

  if (!paginationState || paginationState.userId !== user.id) {
    await interaction.reply({
      content: '❌ This group browser has expired or does not belong to you.',
      ephemeral: true
    });
    return;
  }

  // Calculate new page
  let newPage = paginationState.currentPage;
  if (action === 'next') {
    newPage++;
  } else if (action === 'prev') {
    newPage--;
  }

  const itemsPerPage = 5;
  const totalPages = Math.ceil(paginationState.groups.length / itemsPerPage);

  // Clamp page number
  newPage = Math.max(0, Math.min(newPage, totalPages - 1));

  // Get groups for this page
  const start = newPage * itemsPerPage;
  const end = start + itemsPerPage;
  const pageGroups = paginationState.groups.slice(start, end);

  // Generate find groups image
  const imageBuffer = await groupOverviewImageService.generateFindGroupsImage(
    pageGroups,
    newPage + 1, // Display page is 1-indexed
    totalPages
  );

  // Create attachment
  const attachment = new AttachmentBuilder(imageBuffer, { name: 'find-groups.png' });

  // Create navigation buttons
  const prevButton = new ButtonBuilder()
    .setCustomId(`${paginationId}:prev`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(newPage === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId(`${paginationId}:next`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(newPage >= totalPages - 1);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

  // Update pagination state
  paginationState.currentPage = newPage;
  groupPaginations.set(paginationId, paginationState);

  await interaction.update({
    files: [attachment],
    components: [row],
  });
}

/**
 * Handle group leaderboard pagination
 */
export async function handleGroupLeaderboardPagination(
  interaction: ButtonInteraction,
  db: Firestore
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const parts = interaction.customId.split(':');
    const newPage = parseInt(parts[1], 10);
    const mode = parts[2]; // 'test' or 'real'
    const serverId = interaction.guildId;

    if (!serverId) {
      await interaction.editReply({
        content: '❌ This command can only be used in a server.',
      });
      return;
    }

    const groupService = new GroupService(db);
    const groups = await groupService.getAllServerGroups(serverId);
    const allGroups = groups.map((group, index) => ({
      rank: index + 1,
      groupName: group.name,
      groupId: group.groupId,
      currentMembers: group.memberCount,
      maxMembers: group.maxMembers,
      groupLevel: group.level,
    }));

    const pageSize = 5;
    const totalPages = Math.ceil(allGroups.length / pageSize);

    // Get current page of groups
    const startIdx = newPage * pageSize;
    const endIdx = Math.min((newPage + 1) * pageSize, allGroups.length);
    const pageGroups = allGroups.slice(startIdx, endIdx);

    // Generate group leaderboard image
    const imageBuffer = await groupOverviewImageService.generateGroupLeaderboardImage(pageGroups);

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'group-leaderboard.png' });

    // Create pagination buttons
    const prevButton = new ButtonBuilder()
      .setCustomId(`group_leaderboard_page:${newPage - 1}:${mode}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);

    const nextButton = new ButtonBuilder()
      .setCustomId(`group_leaderboard_page:${newPage + 1}:${mode}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage >= totalPages - 1);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

    // Update the message
    await interaction.editReply({
      content: totalPages > 1 ? `Page ${newPage + 1}/${totalPages}` : undefined,
      files: [attachment],
      components: [buttonRow],
    });
  } catch (error) {
    logger.error('Error handling group leaderboard pagination:', error);
    await interaction.editReply({
      content: '❌ Failed to update leaderboard. Please try again later.',
    });
  }
}

/**
 * Main router for group button interactions
 */
export async function handleGroupButtonInteraction(
  interaction: ButtonInteraction,
  db: Firestore,
  client: Client
): Promise<boolean> {
  const customId = interaction.customId;

  // Group admin delete confirm
  if (customId.startsWith('groupadmin_delete_confirm:')) {
    await handleGroupDeleteConfirm(interaction, db, client);
    return true;
  }

  // Group admin delete cancel
  if (customId.startsWith('groupadmin_delete_cancel:')) {
    await handleGroupDeleteCancel(interaction);
    return true;
  }

  // Find groups pagination
  if (customId.startsWith('findgroups:')) {
    await handleFindGroupsPagination(interaction, db);
    return true;
  }

  // Group leaderboard pagination
  if (customId.startsWith('group_leaderboard_page:')) {
    await handleGroupLeaderboardPagination(interaction, db);
    return true;
  }

  return false; // Not handled
}
```

Then in your main bot file, import and use:

```typescript
import { handleGroupButtonInteraction } from './interactions/buttons/groupButtons';

// In your button interaction handler:
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const handled = await handleGroupButtonInteraction(interaction, db, client);
    if (handled) return;

    // Handle other button interactions...
  }
});
```

## Testing Checklist

- [ ] Commands load successfully
- [ ] Commands appear in Discord
- [ ] `/group` displays group overview correctly
- [ ] `/creategroup` creates new groups
- [ ] `/joingroup` validates and joins groups
- [ ] `/leavegroup` removes user from group
- [ ] `/group_leaderboard` shows ranked groups
- [ ] `/findgroups` browses available groups
- [ ] `/groupadmin delete` shows confirmation
- [ ] `/groupadmin kick` removes members
- [ ] Delete confirmation works
- [ ] Delete cancellation works
- [ ] Find groups pagination works
- [ ] Leaderboard pagination works
- [ ] Error handling works correctly
- [ ] Logging is working

## Deployment

Once tested, you can remove the corresponding code from `bot.legacy.ts`:
- Lines 362-450 (command definitions)
- Lines 4972-6188 (command handlers)
- Lines 2156-2488 (button interaction handlers)
