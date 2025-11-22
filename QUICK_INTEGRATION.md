# Quick Integration Guide - Group Commands

## ✅ What's Done

7 group commands migrated to modular architecture:
- `/group` - View group overview
- `/creategroup` - Create new group
- `/joingroup` - Join a group
- `/leavegroup` - Leave group
- `/group_leaderboard` - View group rankings
- `/findgroups` - Browse available groups
- `/groupadmin delete` - Delete group
- `/groupadmin kick` - Kick member

**Location**: `src/commands/groups/` (954 lines total)

## 🔧 Step 1: Register Commands (2 minutes)

Edit `src/commands/index.ts`:

```typescript
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

  // Group commands - ADD THIS BLOCK
  const groupCommands = [
    '../commands/groups/group',
    '../commands/groups/creategroup',
    '../commands/groups/joingroup',
    '../commands/groups/leavegroup',
    '../commands/groups/group_leaderboard',
    '../commands/groups/findgroups',
    '../commands/groups/groupadmin',
  ];

  // Combine all command paths - UPDATE THIS LINE
  const allCommands = [...sessionCommands, ...statsCommands, ...groupCommands];

  // Rest stays the same...
}
```

## 🎯 Step 2: Handle Button Interactions (5 minutes)

### Option A: Quick Copy to bot.ts (Fastest)

Copy these button handler sections from `bot.legacy.ts` to your new `bot.ts`:
- Lines 2156-2224: `groupadmin_delete_confirm` handler
- Lines 2227-2245: `groupadmin_delete_cancel` handler
- Lines 2330-2394: Find groups pagination handler
- Lines 2397-2488: Group leaderboard pagination handler

Add this import at the top:
```typescript
import { groupPaginations } from './commands/groups/findgroups';
```

### Option B: Create Clean Module (Recommended)

Create `src/interactions/buttons/groupButtons.ts` and copy the full code from `INTEGRATION_GUIDE.md` (page 2).

Then in `bot.ts`:
```typescript
import { handleGroupButtonInteraction } from './interactions/buttons/groupButtons';

// In your button interaction handler:
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const handled = await handleGroupButtonInteraction(interaction, db, client);
    if (handled) return;

    // Other button handlers...
  }
});
```

## 🧪 Step 3: Test (10 minutes)

Run locally:
```bash
npm run dev
```

Test each command:
```
/creategroup name:TestGroup public:true
/joingroup group_id:GP-XXXX
/group
/group_leaderboard
/findgroups
/groupadmin delete
/leavegroup
```

## ✨ Step 4: Deploy

After successful local testing:
```bash
npm run build
git add src/commands/groups/
git add src/commands/index.ts
git commit -m "Migrate group commands to modular architecture"
```

## 🗑️ Step 5: Cleanup (After Deployment)

Once verified in production, remove from `bot.legacy.ts`:
- Lines 362-450 (command definitions)
- Lines 4972-6188 (command handlers)
- Lines 2156-2488 (button interaction handlers)

## 📝 Command Summary

| Command | Description | Ephemeral |
|---------|-------------|-----------|
| `/group [user]` | View group overview | No (public) |
| `/creategroup <name> [public]` | Create new group | Yes (private) |
| `/joingroup <group_id>` | Join a public group | Yes (private) |
| `/leavegroup` | Leave current group | Yes (private) |
| `/group_leaderboard` | View ranked groups | No (public) |
| `/findgroups` | Browse available groups | No (public) |
| `/groupadmin delete` | Delete your group | Yes (private) |
| `/groupadmin kick <user>` | Remove member | Yes (private) |

## 🐛 Troubleshooting

**Commands don't appear in Discord:**
- Run command registration: `npm run register-commands`
- Wait 1-2 minutes for Discord to update
- Try in a test server with guild commands first

**"Module not found" errors:**
- Verify all files exist in `src/commands/groups/`
- Check import paths are correct
- Rebuild: `npm run build`

**Button interactions fail:**
- Verify `groupPaginations` is imported
- Check button handler is registered
- Look for customId pattern matching issues

## 📚 Full Documentation

For complete details, see:
- `GROUP_COMMANDS_MIGRATION.md` - Full migration details
- `INTEGRATION_GUIDE.md` - Detailed integration steps with code
- `MIGRATION_COMPLETE.md` - Project status and verification

## ⏱️ Total Time Estimate

- Register commands: 2 min
- Add button handlers: 5 min
- Test locally: 10 min
- Deploy: 2 min
- **Total: ~20 minutes**

---

**Ready to integrate!** Start with Step 1 above. 🚀
