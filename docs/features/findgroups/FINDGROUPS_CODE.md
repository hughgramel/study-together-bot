# /findgroups Command - Complete Code Implementation

## File: src/bot.ts

### 1. Command Registration (Added at line 389)

```typescript
new SlashCommandBuilder()
  .setName('findgroups')
  .setDescription('Browse public groups with available space'),
```

### 2. Pagination State (Added at lines 151-157)

```typescript
// Group pagination state
interface GroupPaginationState {
  userId: string;
  groups: any[];
  currentPage: number;
  messageId: string;
}
const groupPaginations = new Map<string, GroupPaginationState>();
```

### 3. Command Handler (Added at lines 4980-5096)

```typescript
// /findgroups command - Browse public groups with available space
if (commandName === 'findgroups') {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Query public groups with available space in this server
    const groupsSnapshot = await db
      .collection('discord-data')
      .doc('groups')
      .collection('all')
      .where('serverId', '==', guildId)
      .where('isPublic', '==', true)
      .get();

    // Filter groups with available space
    const availableGroups = groupsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((group: any) => {
        const currentMembers = group.members?.length || 0;
        const maxMembers = group.maxMembers || 6;
        return currentMembers < maxMembers;
      })
      .sort((a: any, b: any) => (b.level || 0) - (a.level || 0)); // Sort by level descending

    if (availableGroups.length === 0) {
      await interaction.editReply({
        content: 'No public groups with available space found. Try creating your own group!',
      });
      return;
    }

    // Store pagination state
    const paginationId = `findgroups:${user.id}:${Date.now()}`;
    const currentPage = 0;

    // Helper function to create embed for a page
    const createGroupsEmbed = (page: number): EmbedBuilder => {
      const itemsPerPage = 5;
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const pageGroups = availableGroups.slice(start, end);
      const totalPages = Math.ceil(availableGroups.length / itemsPerPage);

      const embed = new EmbedBuilder()
        .setColor(0x0080FF)
        .setTitle('Public Groups')
        .setDescription(`Browse public groups with available space\nPage ${page + 1} of ${totalPages}`)
        .setFooter({ text: `${availableGroups.length} groups found` });

      pageGroups.forEach((group: any) => {
        const currentMembers = group.members?.length || 0;
        const maxMembers = group.maxMembers || 6;
        const level = group.level || 1;
        const xpModifier = ((group.xpModifier || 0) * 100).toFixed(1);

        embed.addFields({
          name: `${group.name} (#${group.id})`,
          value: [
            `Members: ${currentMembers}/${maxMembers}`,
            `Level: ${level}`,
            `XP Modifier: +${xpModifier}%`,
            `\`/joingroup ${group.id}\` to join`
          ].join('\n'),
          inline: false
        });
      });

      return embed;
    };

    // Create navigation buttons
    const createButtons = (page: number): ActionRowBuilder<ButtonBuilder> => {
      const totalPages = Math.ceil(availableGroups.length / 5);

      const prevButton = new ButtonBuilder()
        .setCustomId(`${paginationId}:prev`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);

      const nextButton = new ButtonBuilder()
        .setCustomId(`${paginationId}:next`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1);

      return new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);
    };

    const embed = createGroupsEmbed(currentPage);
    const buttons = createButtons(currentPage);

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    // Store pagination state
    groupPaginations.set(paginationId, {
      userId: user.id,
      groups: availableGroups,
      currentPage: currentPage,
      messageId: reply.id,
    });

    // Clean up pagination state after 15 minutes
    setTimeout(() => {
      groupPaginations.delete(paginationId);
    }, 15 * 60 * 1000);

  } catch (error) {
    console.error('Error fetching groups:', error);
    await interaction.editReply({
      content: '❌ Failed to fetch groups. Please try again later.',
    });
  }
  return;
}
```

### 4. Button Interaction Handler (Added at lines 2224-2320)

```typescript
// Handle findgroups pagination buttons
if (interaction.customId.includes('findgroups:')) {
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

  const totalPages = Math.ceil(paginationState.groups.length / 5);

  // Clamp page number
  newPage = Math.max(0, Math.min(newPage, totalPages - 1));

  // Helper function to create embed for a page
  const createGroupsEmbed = (page: number): EmbedBuilder => {
    const itemsPerPage = 5;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const pageGroups = paginationState.groups.slice(start, end);
    const totalPages = Math.ceil(paginationState.groups.length / itemsPerPage);

    const embed = new EmbedBuilder()
      .setColor(0x0080FF)
      .setTitle('Public Groups')
      .setDescription(`Browse public groups with available space\nPage ${page + 1} of ${totalPages}`)
      .setFooter({ text: `${paginationState.groups.length} groups found` });

    pageGroups.forEach((group: any) => {
      const currentMembers = group.members?.length || 0;
      const maxMembers = group.maxMembers || 6;
      const level = group.level || 1;
      const xpModifier = ((group.xpModifier || 0) * 100).toFixed(1);

      embed.addFields({
        name: `${group.name} (#${group.id})`,
        value: [
          `Members: ${currentMembers}/${maxMembers}`,
          `Level: ${level}`,
          `XP Modifier: +${xpModifier}%`,
          `\`/joingroup ${group.id}\` to join`
        ].join('\n'),
        inline: false
      });
    });

    return embed;
  };

  // Create navigation buttons
  const createButtons = (page: number): ActionRowBuilder<ButtonBuilder> => {
    const totalPages = Math.ceil(paginationState.groups.length / 5);

    const prevButton = new ButtonBuilder()
      .setCustomId(`${paginationId}:prev`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    const nextButton = new ButtonBuilder()
      .setCustomId(`${paginationId}:next`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);
  };

  const embed = createGroupsEmbed(newPage);
  const buttons = createButtons(newPage);

  // Update pagination state
  paginationState.currentPage = newPage;
  groupPaginations.set(paginationId, paginationState);

  await interaction.update({
    embeds: [embed],
    components: [buttons],
  });

  return;
}
```

## Implementation Complete

All code has been successfully added to `/Users/hughgramelspacher/repos/discord-bot-main/worktrees/groups/src/bot.ts`.

The implementation follows the existing patterns in the codebase and adheres to the project's code style guidelines.
