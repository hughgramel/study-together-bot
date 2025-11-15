# Study Together Bot - Claude Code Rules

## Project Overview

A Discord bot for collaborative productivity tracking with Strava-style social features. Users track study/work sessions, compete on leaderboards, and share accomplishments in a community feed.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 18+
- **Framework**: Discord.js v14
- **Database**: Firebase Firestore
- **Deployment**: Railway

## Architecture

```
src/
├── bot.ts                 # Main entry point, command handlers, interactions
├── services/
│   ├── sessions.ts       # Session CRUD (active & completed sessions)
│   └── stats.ts          # User statistics and leaderboard queries
├── utils/
│   └── formatters.ts     # Duration/time formatting utilities
└── types.ts              # TypeScript interfaces
```

## Key Features

1. **Session Management**: `/start`, `/pause`, `/resume`, `/end`, `/cancel`
2. **Status Checking**: `/time` (shows elapsed time, pause status)
3. **Personal Stats**: `/mystats` (daily, weekly, monthly, all-time with streaks)
4. **Leaderboards**:
   - `/leaderboard` - Quick overview (top 3 + your position)
   - `/d` - Full daily leaderboard (top 10)
   - `/w` - Full weekly leaderboard (top 10)
   - `/m` - Full monthly leaderboard (top 10)
5. **Social Feed**: Strava-style embeds with reactions and comment threads
6. **Streak Tracking**: Current and longest streaks with fire emojis

## Database Schema

Firebase Firestore structure:
- `discord-data/activeSessions/sessions/{userId}` - Active sessions
- `discord-data/sessions/completed/{sessionId}` - Completed sessions
- `discord-data/userStats/stats/{userId}` - User statistics
- `discord-data/serverConfig/configs/{serverId}` - Server settings

## Development Guidelines

### Code Style
- Use TypeScript with strict types
- Prefer `async/await` over promises
- Use descriptive variable names
- Keep functions focused and single-purpose
- Use ephemeral replies for user-only messages

### Command Design Principles
- **Short commands**: Prefer `/time` over `/status`, `/d` over `/daily`
- **Ephemeral by default**: Most responses should be `ephemeral: true` (user-only)
- **Immediate feedback**: Use `deferReply()` for operations > 3 seconds
- **Graceful errors**: Always catch errors and provide user-friendly messages

### Discord Interaction Patterns
```typescript
// Standard command handler pattern
if (commandName === 'example') {
  const session = await sessionService.getActiveSession(user.id);

  if (!session) {
    await interaction.reply({
      content: 'No active session found.',
      ephemeral: true,
    });
    return;
  }

  // Process command...
  await interaction.reply({
    content: 'Success message',
    ephemeral: true,
  });
  return;
}
```

### Firestore Best Practices
- Use Timestamps for all date fields (`Timestamp.now()`)
- Batch reads with `Promise.all()` for parallel queries
- Use subcollections for organized data hierarchy
- Always handle missing documents gracefully

### Feed Channel Embeds
Use consistent styling:
- Color: `0x0080FF` (electric blue) for completed sessions
- Color: `0xFFD700` (gold) for leaderboards
- Include author with avatar
- Use inline fields for stats
- Add reactions (❤️) and create threads for comments

## Environment Variables

Required for deployment:
- `DISCORD_BOT_TOKEN` - Bot authentication token
- `DISCORD_CLIENT_ID` - Discord application ID
- `FIREBASE_PROJECT_ID` - Firebase project identifier
- `FIREBASE_SERVICE_ACCOUNT` - Full JSON service account (as string)

## Testing Strategy

Before deploying changes:
1. Test locally with `npm run dev`
2. Verify command registration in Discord
3. Test all command flows (success + error cases)
4. Check ephemeral vs public messages are correct
5. Verify Firebase writes/reads with console

## Common Tasks

### Adding a new command
1. Add `SlashCommandBuilder` to `commands` array
2. Add command handler in `interactionCreate` event
3. Use existing patterns for replies and error handling
4. Update README with new command

### Modifying embeds
- Keep consistent with existing design language
- Use semantic colors (green for success, gold for achievements)
- Test on both light and dark Discord themes

### Database queries
- Always filter by `userId` or `serverId` for security
- Use indexes for frequently queried fields
- Consider pagination for large result sets (future)

## Future Enhancements

Potential features to consider:
- Pomodoro timer integration
- Team/group sessions
- XP/leveling system
- Session categories/tags
- Export data functionality
- Mobile app notifications

## Known Issues

- Deprecation warning for `ready` event (use `clientReady` in Discord.js v15)
- Leaderboards currently use fake data for testing (lines 675-810)

## Deployment Rules

**CRITICAL: DO NOT PUSH TO PRODUCTION UNLESS USER EXPLICITLY SAYS TO DO SO**

- Always wait for explicit user confirmation before running `git push`
- Build and commit locally, but DO NOT push without permission
- If user says "commit and push" or "push this", then you may push
- If user just says "make this change", build and commit but DO NOT push
- When in doubt, ask before pushing

## Deployment Checklist

Before pushing to production:
1. Remove any fake data generators
2. Verify all environment variables are set
3. Test command registration
4. Confirm Firebase security rules are configured
5. Check Railway build logs for errors
6. Test bot in production Discord server
7. **Get explicit user confirmation before pushing**

## Support & Maintenance

- Keep dependencies updated (especially `discord.js` and `firebase-admin`)
- Monitor Railway logs for errors
- Track Firebase quota usage
- Back up Firestore data regularly
