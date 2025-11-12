# Ambira Discord Bot - Technical Specification

## Project Overview

A Discord bot for intention-based productivity tracking. Users start sessions with their intention, end with a reflection on what they accomplished, and view personal statistics. All completed sessions are posted to a designated feed channel for the server to see.

**Core Philosophy**: Simple, focused productivity tracking with intention → reflection pattern for accountability and self-awareness.

## MVP Feature Set

### Session Management Commands

#### `/start {intention}`
Starts a new productivity session with the user's stated intention.

**Parameters:**
- `intention` (string, required): What the user intends to work on

**Behavior:**
- Checks if user already has an active session (only one active session per user)
- Creates active session record in Firebase with:
  - User ID (Discord user ID)
  - Username (Discord username)
  - Server ID (Discord guild ID)
  - Intention text
  - Start timestamp
  - Pause state (initially false)
  - Paused duration (initially 0)
- Responds with ephemeral message confirming session started

**Error Cases:**
- User already has active session → "You already have an active session! Use /end to complete it first."

#### `/end {description}`
Completes the active session with a description of what was accomplished.

**Parameters:**
- `description` (string, required): What the user actually accomplished

**Behavior:**
- Retrieves active session from Firebase
- Calculates total duration (elapsed time - paused time)
- Creates completed session record in Firebase
- Updates user statistics (total sessions, total time, streak tracking)
- Deletes active session record
- Posts session to configured feed channel
- Responds with ephemeral confirmation message

**Error Cases:**
- No active session → "No active session found! Use /start first."
- No feed channel configured → Still saves session, but doesn't post to feed

#### `/pause`
Pauses the active timer without ending the session.

**Parameters:** None

**Behavior:**
- Checks for active session
- Marks session as paused
- Records pause timestamp
- Responds with ephemeral confirmation

**Error Cases:**
- No active session → "No active session to pause"
- Session already paused → "Session is already paused"

#### `/resume`
Resumes a paused session.

**Parameters:** None

**Behavior:**
- Checks for active paused session
- Calculates pause duration (time between pause and resume)
- Adds pause duration to total paused time
- Marks session as not paused
- Responds with ephemeral confirmation showing elapsed time

**Error Cases:**
- No active session → "No active session to resume"
- Session not paused → "Session is not paused"

#### `/status`
Shows details about the user's current active session.

**Parameters:** None

**Behavior:**
- Retrieves active session
- Calculates current elapsed time (minus paused time)
- Shows intention, elapsed time, start time, pause state
- Displays available next actions

**Error Cases:**
- No active session → "No active session. Use /start {intention} to begin tracking"

#### `/cancel`
Discards the active session without saving it.

**Parameters:** None

**Behavior:**
- Deletes active session record
- Responds with ephemeral confirmation
- Does NOT update stats or post to feed

**Error Cases:**
- No active session → "No active session to cancel"

### Statistics Commands

#### `/mystats [timeframe]`
Displays user's productivity statistics for a given timeframe.

**Parameters:**
- `timeframe` (choice, optional): today | week | month | all-time (default: week)

**Behavior:**
- Retrieves user stats document from Firebase
- Queries completed sessions within timeframe
- Calculates:
  - Total sessions
  - Total time
  - Average session duration
  - Longest session
  - Current streak (days)
  - Longest streak (days)
  - Most productive day (optional, for week/month)
- Displays in formatted text block

**Error Cases:**
- No stats yet → "No stats yet! Complete your first session with /start and /end"

### Admin Commands

#### `/setup-feed {#channel}`
Configures the feed channel where completed sessions are posted.

**Parameters:**
- `channel` (channel, required): The Discord channel to use as feed

**Permissions Required:**
- Administrator permission in server

**Behavior:**
- Checks user has Administrator permission
- Saves channel ID to server configuration in Firebase
- Responds with ephemeral confirmation

**Error Cases:**
- Not an admin → "Only server administrators can set up the feed channel"

## Feed Channel Behavior

### Auto-Posting on Session Completion

When a user completes a session with `/end`, the bot automatically posts to the configured feed channel:

**Message Format:**
```
@username completed a session · {duration}

🎯 Intended:
"{intention text}"

✨ Accomplished:
"{description text}"

─────────────────────────
```

**Features:**
- Mentions the user (@username)
- Shows formatted duration (e.g., "2h 15m" or "45m")
- Clean visual separator
- No reactions, comments, or engagement features (MVP scope)

## Data Architecture

### Firebase Structure

All data stored in existing Ambira Firebase project under `discord-data/` collection.

#### `discord-data/activeSessions/{userId}`

Active session records (one per user maximum):

```typescript
{
  userId: string;           // Discord user ID
  username: string;         // Discord username (updated on each action)
  serverId: string;         // Discord guild/server ID
  intention: string;        // User's stated intention
  startTime: Timestamp;     // Firebase server timestamp
  isPaused: boolean;        // Current pause state
  pausedAt?: Timestamp;     // Timestamp when last paused (if isPaused = true)
  pausedDuration: number;   // Total seconds spent paused
}
```

#### `discord-data/sessions/{sessionId}`

Completed session records:

```typescript
{
  userId: string;           // Discord user ID
  username: string;         // Discord username
  serverId: string;         // Discord guild/server ID
  intention: string;        // Original intention
  description: string;      // What was actually accomplished
  duration: number;         // Total session duration in seconds
  startTime: Timestamp;     // When session started
  endTime: Timestamp;       // When session ended
  createdAt: Timestamp;     // Document creation time (for sorting)
}
```

#### `discord-data/userStats/{userId}`

User statistics (one per user):

```typescript
{
  username: string;         // Discord username (updated on each session)
  totalSessions: number;    // All-time session count
  totalDuration: number;    // All-time duration in seconds
  currentStreak: number;    // Current consecutive days with sessions
  longestStreak: number;    // Best streak ever
  lastSessionAt: Timestamp; // Most recent session timestamp
  firstSessionAt: Timestamp; // First ever session timestamp
}
```

#### `discord-data/serverConfig/{serverId}`

Server configuration (one per Discord server):

```typescript
{
  feedChannelId: string;    // Discord channel ID for feed posts
  setupAt: Timestamp;       // When feed was configured
  setupBy: string;          // Discord user ID of admin who set it up
}
```

### Streak Calculation Logic

Streaks track consecutive days with at least one completed session:

**Increment streak:**
- If last session was yesterday, increment current streak
- If last session was today (same day), keep current streak

**Break streak:**
- If last session was 2+ days ago, reset current streak to 1

**Update longest streak:**
- Always update `longestStreak = max(currentStreak, longestStreak)`

## Technical Stack

### Core Dependencies

- **discord.js** (v14.x): Discord bot framework with slash command support
- **firebase-admin**: Firebase Admin SDK for Firestore access
- **dotenv**: Environment variable management
- **TypeScript**: Type safety and better developer experience
- **ts-node**: Run TypeScript directly during development

### Runtime Environment

**Development:**
- Run locally on developer machine using `npm run dev`
- Requires `.env` file with tokens and credentials
- Hot reload with ts-node

**Production:**
- Deploy to Railway.app (recommended) or similar PaaS
- Environment variables configured in hosting platform
- Auto-deploy from GitHub on push

### Environment Variables

Required environment variables:

```env
DISCORD_BOT_TOKEN=<bot token from Discord Developer Portal>
DISCORD_CLIENT_ID=<application/client ID from Discord Developer Portal>
FIREBASE_PROJECT_ID=<Firebase project ID>
```

For production deployment, also need:
```env
FIREBASE_SERVICE_ACCOUNT=<entire service account JSON as string>
```

### Project Structure

```
ambira-discord-bot/
├── src/
│   ├── bot.ts              # Main bot entry point
│   ├── commands/           # Command handlers (future refactor)
│   │   ├── start.ts
│   │   ├── end.ts
│   │   ├── status.ts
│   │   ├── pause.ts
│   │   ├── resume.ts
│   │   ├── cancel.ts
│   │   ├── mystats.ts
│   │   └── setup-feed.ts
│   ├── services/           # Business logic (future refactor)
│   │   ├── sessions.ts     # Session CRUD operations
│   │   └── stats.ts        # Statistics calculations
│   └── utils/              # Helper functions
│       ├── formatters.ts   # Duration formatting, etc.
│       └── validators.ts   # Input validation
├── .env                    # Local environment variables (NOT committed)
├── .gitignore
├── package.json
├── tsconfig.json
├── firebase-service-account.json  # Firebase credentials (NOT committed)
└── README.md
```

## Discord Bot Setup Requirements

### Discord Developer Portal Configuration

1. Create application at https://discord.com/developers/applications
2. Add bot user with required token
3. Enable Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent
4. Generate OAuth2 URL with scopes:
   - `bot`
   - `applications.commands`
5. Required bot permissions:
   - Send Messages
   - Read Messages/View Channels
   - Use Slash Commands

### Firebase Configuration

1. Use existing Ambira Firebase project
2. Generate service account key (JSON)
3. Firestore must be initialized (should already exist)
4. No new Firebase indexes required for MVP
5. Security rules allow authenticated writes to `discord-data/` collection

## User Experience Flows

### First-Time User Flow

1. User joins server with Ambira bot
2. User types `/start "Learn Discord bot development"`
3. Bot responds (ephemeral): "⏱️ Session started! Use /end when done"
4. User works on their task
5. User types `/end "Built basic bot commands and tested locally"`
6. Bot posts to feed channel (if configured)
7. User can type `/mystats` to see their first session

### Typical Session Flow

1. `/start "intention"` → Begin session
2. Work on task...
3. `/pause` → Take a break
4. Return from break...
5. `/resume` → Continue session
6. `/status` → Check how long I've been working
7. Work more...
8. `/end "description"` → Complete and share

### Multi-User Server Experience

- Each user tracks their own sessions independently
- All completed sessions appear in shared feed channel
- Users can see what others are working on (accountability)
- Each user has independent statistics
- No cross-user interactions (no likes, comments, follows in MVP)

## Future Feature Considerations (Out of Scope for MVP)

### Social Features
- Support/like sessions
- Comment on sessions
- Follow specific users
- Filtered feeds (following only)

### Advanced Stats
- Leaderboards (server-wide or timeframe-based)
- Category/tag tracking
- Week-over-week comparisons
- Productivity insights ("You're most productive on Thursdays")

### Engagement Features
- Streak reminders via DM
- Daily/weekly summary DMs
- Challenges (e.g., "Work 10 hours this week")
- Achievements/badges

### Integration
- Link Discord account to Ambira web app
- Sync sessions across Discord and web
- Export data (CSV/JSON)
- Calendar integration
- Webhook support

### Quality of Life
- Edit intention mid-session
- Add tags/categories to sessions
- Set estimated duration
- Timer alerts at intervals
- Custom session visibility (private sessions)

## Success Metrics

### Technical Metrics
- Bot uptime: >99%
- Command response time: <1 second
- Firebase read/write errors: <0.1%

### Usage Metrics
- Daily active users
- Sessions per user per week
- Average session duration
- Streak retention (% users maintaining 7+ day streaks)
- Feed channel engagement (views, reactions in future)

## Known Limitations

1. **One active session per user** - Cannot track multiple concurrent tasks
2. **No time estimates** - Cannot set target duration or get alerts
3. **No categories** - All sessions are undifferentiated (no activity types)
4. **No privacy controls** - All sessions posted to feed (everyone visibility)
5. **Server-scoped** - Stats and streaks are global, not per-server
6. **No editing** - Cannot edit intention or description after submission
7. **No deletion** - Cannot delete completed sessions
8. **Limited timezone support** - Streaks based on UTC, not user timezone

## Development Phases

### Phase 1: Local Testing (Current)
- Set up Discord bot application
- Create basic project structure
- Implement `/ping` test command
- Test Firebase connection
- Run bot locally during development

### Phase 2: Core Commands
- Implement `/start`, `/end`, `/cancel`
- Implement `/pause`, `/resume`, `/status`
- Add feed channel posting
- Test with 2-3 users

### Phase 3: Statistics
- Implement `/mystats` with timeframes
- Add streak calculation
- Test accuracy of stats

### Phase 4: Polish & Deploy
- Error handling improvements
- Better formatting and messages
- Deploy to Railway
- Production testing

### Phase 5: Production Launch
- Invite to main Ambira community server
- Monitor for bugs and issues
- Gather user feedback
- Plan next features based on usage

## Deployment Guide

### Railway Deployment Steps

1. Push code to GitHub repository
2. Create Railway project
3. Connect GitHub repository
4. Add environment variables in Railway dashboard
5. Railway auto-deploys on every push to main branch
6. Monitor logs in Railway dashboard

### Environment Variables for Railway

```
DISCORD_BOT_TOKEN=<your token>
DISCORD_CLIENT_ID=<your client id>
FIREBASE_PROJECT_ID=<your project id>
FIREBASE_SERVICE_ACCOUNT=<paste entire JSON file contents>
```

### Post-Deployment Checklist

- [ ] Bot shows online in Discord
- [ ] Slash commands registered and visible
- [ ] `/ping` responds successfully
- [ ] `/start` creates session in Firebase
- [ ] `/end` posts to feed channel
- [ ] `/mystats` displays correctly
- [ ] Monitor Railway logs for errors
- [ ] Check Firebase Firestore for data

## Cost Estimates

### Development (Free)
- Discord bot: $0
- Firebase Firestore: $0 (free tier: 50K reads, 20K writes/day)
- Local testing: $0

### Production
- Railway hosting: $5/month (or free with $5 monthly credit)
- Firebase Firestore: $0-5/month depending on usage
- Total: ~$5-10/month

### Scaling Considerations
- Firebase free tier supports ~1,500 sessions/day
- Railway free tier supports small bot (1-50 concurrent users)
- If exceeding limits, costs scale predictably

## Testing Strategy

### Manual Testing Checklist

**Session Flow:**
- [ ] Start session with short intention
- [ ] Start session with long intention (500+ chars)
- [ ] Try to start second session (should error)
- [ ] Check status of active session
- [ ] Pause session
- [ ] Resume session
- [ ] Complete session
- [ ] Verify feed post appears

**Edge Cases:**
- [ ] End session without starting
- [ ] Pause without active session
- [ ] Resume without pausing
- [ ] Cancel without active session
- [ ] Very short session (<1 min)
- [ ] Very long session (8+ hours)

**Statistics:**
- [ ] Check stats before any sessions
- [ ] Check stats after 1 session
- [ ] Complete sessions on consecutive days (test streak)
- [ ] Skip a day (test streak break)
- [ ] Test different timeframes (today/week/month/all-time)

**Multi-User:**
- [ ] Two users start sessions simultaneously
- [ ] Both users complete (verify separate stats)
- [ ] Both sessions appear in feed

**Admin:**
- [ ] Non-admin tries to setup feed (should error)
- [ ] Admin sets up feed channel
- [ ] Change feed channel
- [ ] Complete session posts to correct channel

## Security Considerations

### Token Security
- Never commit `.env` or `firebase-service-account.json` to git
- Use `.gitignore` to exclude sensitive files
- Rotate tokens if accidentally exposed
- Use environment variables in production

### Permissions
- Bot only requests minimum required Discord permissions
- Admin commands check for Administrator role
- Users can only modify their own sessions
- No elevated Firestore permissions required

### Data Privacy
- User IDs are Discord IDs (not personally identifiable)
- Session data visible to all server members (by design)
- No DMs or private data stored
- Comply with Discord ToS and Firebase terms

## Support & Maintenance

### Monitoring
- Railway provides application logs
- Firebase console shows Firestore usage
- Discord Developer Portal shows bot online status

### Debugging
- Check Railway logs for runtime errors
- Use `/ping` to verify bot responsiveness
- Check Firestore console for data integrity
- Test commands in isolated test server

### Updates
- Git commit and push to main branch
- Railway auto-deploys
- Monitor logs after deployment
- Test critical commands post-deploy

## License & Attribution

- Project: Ambira Discord Bot
- Related to: Ambira productivity tracking web application
- Technology: Built with Discord.js and Firebase
- Hosting: Railway.app (recommended)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-11
**Status:** Ready for Development
