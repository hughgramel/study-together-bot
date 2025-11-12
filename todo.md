# Ambira Discord Bot - Development Checklist

## Phase 0: Setup & Prerequisites

### Discord Developer Portal Setup
- [ ] Create Discord application at https://discord.com/developers/applications
- [ ] Name the application "Ambira Bot"
- [ ] Navigate to Bot tab and create bot user
- [ ] Copy and save bot token securely
- [ ] Enable "Server Members Intent" in Privileged Gateway Intents
- [ ] Enable "Message Content Intent" in Privileged Gateway Intents
- [ ] Save bot configuration changes
- [ ] Navigate to OAuth2 → General and copy Application ID (Client ID)
- [ ] Navigate to OAuth2 → URL Generator
- [ ] Select scopes: `bot` and `applications.commands`
- [ ] Select permissions: Send Messages, Read Messages/View Channels, Use Slash Commands
- [ ] Copy generated OAuth2 URL
- [ ] Create test Discord server (or use existing)
- [ ] Use OAuth2 URL to invite bot to test server
- [ ] Verify bot appears in server member list (offline is expected)

### Firebase Setup
- [ ] Open Firebase Console for Ambira project
- [ ] Navigate to Project Settings → Service Accounts
- [ ] Click "Generate new private key"
- [ ] Download and save service account JSON file
- [ ] Copy Firebase Project ID from General tab
- [ ] Verify Firestore Database is enabled
- [ ] (Optional) Create `discord-data` collection manually to verify access

### Local Development Environment
- [ ] Verify Node.js is installed (v18+): `node --version`
- [ ] Verify npm is installed: `npm --version`
- [ ] Create project directory: `mkdir -p ~/repos/ambira-main/discordbot`
- [ ] Navigate to project: `cd ~/repos/ambira-main/discordbot`

---

## Phase 1: Project Initialization

### NPM Project Setup
- [ ] Initialize npm: `npm init -y`
- [ ] Install dependencies: `npm install discord.js firebase-admin dotenv`
- [ ] Install dev dependencies: `npm install -D typescript @types/node ts-node`
- [ ] Initialize TypeScript: `npx tsc --init`
- [ ] Update `tsconfig.json` with proper settings (target: ES2020, module: commonjs, etc.)

### Project Structure
- [ ] Create `src/` directory
- [ ] Create `.gitignore` file
- [ ] Add `node_modules/` to .gitignore
- [ ] Add `.env` to .gitignore
- [ ] Add `firebase-service-account.json` to .gitignore
- [ ] Add `dist/` to .gitignore
- [ ] Add `*.log` to .gitignore

### Environment Configuration
- [ ] Create `.env` file in project root
- [ ] Add `DISCORD_BOT_TOKEN=` with your bot token
- [ ] Add `DISCORD_CLIENT_ID=` with your application ID
- [ ] Add `FIREBASE_PROJECT_ID=` with your project ID
- [ ] Move downloaded service account JSON to project root
- [ ] Rename service account file to `firebase-service-account.json`
- [ ] Verify .env and service account are in .gitignore

### Package.json Scripts
- [ ] Add `"dev": "ts-node src/bot.ts"` to scripts
- [ ] Add `"build": "tsc"` to scripts
- [ ] Add `"start": "node dist/bot.js"` to scripts
- [ ] Test scripts section is properly formatted JSON

---

## Phase 2: Basic Bot Connection

### Create Minimal Bot
- [ ] Create `src/bot.ts` file
- [ ] Import discord.js Client, GatewayIntentBits
- [ ] Import firebase-admin app, cert, firestore
- [ ] Import dotenv and call `dotenv.config()`
- [ ] Initialize Firebase with service account
- [ ] Create Discord client with Guilds intent
- [ ] Add `ready` event listener with console.log
- [ ] Add bot login with `DISCORD_BOT_TOKEN`

### Test Bot Connection
- [ ] Run bot: `npm run dev`
- [ ] Verify "Bot is online" message in console
- [ ] Verify bot shows online (green dot) in Discord server
- [ ] Check no error messages in console
- [ ] Stop bot with Ctrl+C
- [ ] Verify bot goes offline in Discord

---

## Phase 3: Slash Command Registration

### Setup Command Registration
- [ ] Import REST and Routes from discord.js
- [ ] Import SlashCommandBuilder from discord.js
- [ ] Create `/ping` command definition with SlashCommandBuilder
- [ ] Create `registerCommands()` async function
- [ ] Use REST API to register commands globally
- [ ] Call `registerCommands()` before bot login

### Implement Ping Command
- [ ] Add `interactionCreate` event listener
- [ ] Check if interaction is chat input command
- [ ] Handle `/ping` command
- [ ] Reply with "Pong! 🏓" message
- [ ] Add error handling for reply failures

### Test Command Registration
- [ ] Run bot: `npm run dev`
- [ ] Wait 1-2 minutes for Discord to sync commands
- [ ] Type `/` in Discord and verify `/ping` appears
- [ ] Execute `/ping` command
- [ ] Verify "Pong! 🏓" reply appears
- [ ] Check console for any errors
- [ ] Test command works in multiple channels

---

## Phase 4: Firebase Connection Test

### Add Test Firebase Command
- [ ] Create `/test-firebase` command definition
- [ ] Export `db` from firestore initialization
- [ ] Implement command handler for `/test-firebase`
- [ ] Write test document to `discord-data/test` collection
- [ ] Add try/catch error handling
- [ ] Reply with success or error message

### Test Firebase Integration
- [ ] Run bot: `npm run dev`
- [ ] Execute `/test-firebase` in Discord
- [ ] Verify success message appears
- [ ] Open Firebase Console → Firestore Database
- [ ] Verify `discord-data` collection exists
- [ ] Verify `test` document exists with timestamp
- [ ] Test multiple times to ensure writes work
- [ ] Check console for any Firebase errors

---

## Phase 5: Session Start Command

### Data Model Setup
- [ ] Create TypeScript interface for `ActiveSession`
- [ ] Define fields: userId, username, serverId, intention, startTime, isPaused, pausedDuration
- [ ] Create helper function `getActiveSession(userId: string)`
- [ ] Create helper function `setActiveSession(userId: string, data: ActiveSession)`
- [ ] Create helper function `deleteActiveSession(userId: string)`

### Implement /start Command
- [ ] Create `/start` command definition with intention parameter (required string)
- [ ] Register command in commands array
- [ ] Add command handler in interactionCreate
- [ ] Check if user already has active session
- [ ] If active session exists, reply with error (ephemeral)
- [ ] Create active session document in Firebase
- [ ] Use Firebase server timestamp for startTime
- [ ] Reply with success message (ephemeral) showing intention and start time

### Test /start Command
- [ ] Run bot and execute `/start "Test intention"`
- [ ] Verify success message appears (only visible to you)
- [ ] Check Firebase for `discord-data/activeSessions/{yourUserId}` document
- [ ] Verify all fields are populated correctly
- [ ] Try `/start` again without ending first
- [ ] Verify error message appears about existing session
- [ ] Test with very long intention (500+ chars)
- [ ] Test with special characters and emojis

---

## Phase 6: Session Status Command

### Implement Duration Helpers
- [ ] Create `calculateDuration(startTime: Timestamp, pausedDuration: number)` function
- [ ] Calculate current elapsed time minus paused time
- [ ] Create `formatDuration(seconds: number)` function
- [ ] Format as "Xh Ym" for hours+minutes or "Ym" for minutes only
- [ ] Handle edge cases (0 seconds, very long durations)

### Implement /status Command
- [ ] Create `/status` command definition (no parameters)
- [ ] Register command in commands array
- [ ] Add command handler in interactionCreate
- [ ] Retrieve active session for user
- [ ] If no session, reply with helpful message to use `/start`
- [ ] Calculate current elapsed time
- [ ] Format duration string
- [ ] Reply with intention, elapsed time, start time, pause state
- [ ] Add helpful next steps in message

### Test /status Command
- [ ] Start a session with `/start`
- [ ] Immediately run `/status`
- [ ] Verify shows 0m or 1m elapsed
- [ ] Wait 5 minutes
- [ ] Run `/status` again
- [ ] Verify shows ~5m elapsed
- [ ] Try `/status` without active session
- [ ] Verify helpful error message appears
- [ ] Verify all messages are ephemeral (only you see them)

---

## Phase 7: Session Pause/Resume

### Implement /pause Command
- [ ] Create `/pause` command definition
- [ ] Register command in commands array
- [ ] Add command handler
- [ ] Get active session
- [ ] Check session exists (error if not)
- [ ] Check session not already paused (error if already paused)
- [ ] Update session: set isPaused=true, pausedAt=now
- [ ] Reply with confirmation message

### Implement /resume Command
- [ ] Create `/resume` command definition
- [ ] Register command in commands array
- [ ] Add command handler
- [ ] Get active session
- [ ] Check session exists (error if not)
- [ ] Check session is paused (error if not paused)
- [ ] Calculate pause duration (now - pausedAt)
- [ ] Add pause duration to total pausedDuration
- [ ] Update session: set isPaused=false, remove pausedAt
- [ ] Reply with confirmation and current elapsed time

### Test Pause/Resume Flow
- [ ] Start session with `/start`
- [ ] Run `/status` to see elapsed time
- [ ] Run `/pause`
- [ ] Verify confirmation message
- [ ] Wait 2 minutes
- [ ] Run `/status` - verify still shows paused state
- [ ] Run `/resume`
- [ ] Verify elapsed time doesn't include the 2 minutes paused
- [ ] Try `/pause` twice in a row (should error)
- [ ] Try `/resume` without pausing (should error)
- [ ] Try `/pause` without session (should error)

---

## Phase 8: Session Cancel Command

### Implement /cancel Command
- [ ] Create `/cancel` command definition
- [ ] Register command in commands array
- [ ] Add command handler
- [ ] Get active session
- [ ] Check session exists (error if not)
- [ ] Delete active session from Firebase
- [ ] Reply with confirmation message
- [ ] Mention that no stats were updated

### Test /cancel Command
- [ ] Start session with `/start`
- [ ] Run `/status` to verify session exists
- [ ] Run `/cancel`
- [ ] Verify confirmation message
- [ ] Run `/status` again
- [ ] Verify "no active session" message
- [ ] Check Firebase to ensure active session deleted
- [ ] Try `/cancel` without session (should error)

---

## Phase 9: User Stats System

### Create Stats Data Model
- [ ] Create TypeScript interface for `UserStats`
- [ ] Define fields: username, totalSessions, totalDuration, currentStreak, longestStreak, lastSessionAt, firstSessionAt
- [ ] Create helper function `getUserStats(userId: string)`
- [ ] Create helper function `updateUserStats(userId: string, sessionDuration: number)`

### Implement Streak Logic
- [ ] In `updateUserStats`, get existing stats (if any)
- [ ] If no stats, create first entry with streak=1
- [ ] If stats exist, get lastSessionAt date
- [ ] Compare lastSessionAt to today and yesterday
- [ ] If yesterday: increment streak
- [ ] If today: keep streak same
- [ ] If 2+ days ago: reset streak to 1
- [ ] Update longestStreak if current > longest
- [ ] Update totalSessions, totalDuration, lastSessionAt

### Test Stats Updates (Manual)
- [ ] Add console.log to updateUserStats function
- [ ] Manually call updateUserStats with test user ID
- [ ] Check Firebase for `discord-data/userStats/{userId}` document
- [ ] Verify fields are correct
- [ ] Call again next "day" (manually change lastSessionAt)
- [ ] Verify streak increments
- [ ] Call after 2+ day gap
- [ ] Verify streak resets to 1

---

## Phase 10: Session End & Feed Posting

### Create Completed Session Model
- [ ] Create TypeScript interface for `CompletedSession`
- [ ] Define fields: userId, username, serverId, intention, description, duration, startTime, endTime, createdAt

### Implement /end Command
- [ ] Create `/end` command definition with description parameter (required string)
- [ ] Register command in commands array
- [ ] Add command handler
- [ ] Get active session (error if none)
- [ ] Calculate final duration
- [ ] Create completed session document in Firebase
- [ ] Call `updateUserStats()` with duration
- [ ] Delete active session
- [ ] Reply with ephemeral confirmation

### Add Feed Posting Logic
- [ ] In `/end` handler, after saving session
- [ ] Get server config to find feedChannelId
- [ ] If no feed channel configured, skip posting (still save session)
- [ ] If feed channel exists, fetch channel by ID
- [ ] Verify channel is text-based
- [ ] Format feed message with @username, duration, intention, description
- [ ] Send message to feed channel
- [ ] Handle errors gracefully (log but don't fail)

### Test /end Without Feed
- [ ] Start session with `/start "Testing end command"`
- [ ] Wait a few minutes
- [ ] Run `/end "Successfully tested end command"`
- [ ] Verify ephemeral confirmation message
- [ ] Check Firebase for completed session in `discord-data/sessions/`
- [ ] Verify active session deleted
- [ ] Check userStats updated (totalSessions=1, totalDuration>0, streak=1)
- [ ] Verify no error about missing feed channel

---

## Phase 11: Feed Channel Setup

### Implement /setup-feed Command
- [ ] Create `/setup-feed` command with channel parameter (required channel type)
- [ ] Register command in commands array
- [ ] Add command handler
- [ ] Check user has Administrator permission
- [ ] If not admin, reply with error (ephemeral)
- [ ] Save channel ID to `discord-data/serverConfig/{serverId}`
- [ ] Include setupAt timestamp and setupBy userId
- [ ] Reply with confirmation showing channel mention

### Test Feed Setup & Posting
- [ ] Run `/setup-feed #general` (or create test channel first)
- [ ] Verify confirmation message
- [ ] Check Firebase for serverConfig document
- [ ] Start new session with `/start "Testing feed"`
- [ ] End session with `/end "Feed should appear now"`
- [ ] Check designated feed channel for post
- [ ] Verify format: @username, duration, intention, description
- [ ] Try setup-feed as non-admin (test with second user)
- [ ] Verify permission error

---

## Phase 12: Statistics Display Command

### Implement Timeframe Filtering
- [ ] Create helper to calculate cutoff date for timeframe
- [ ] Handle "today" (midnight today)
- [ ] Handle "week" (7 days ago)
- [ ] Handle "month" (30 days ago)
- [ ] Handle "all-time" (beginning of time)

### Implement /mystats Command
- [ ] Create `/mystats` command with optional timeframe choice parameter
- [ ] Add choices: today, week, month, all-time (default: week)
- [ ] Register command in commands array
- [ ] Add command handler
- [ ] Get user stats document
- [ ] If no stats, reply "No stats yet"
- [ ] Query completed sessions in timeframe
- [ ] Calculate: total sessions, total time, avg time, longest session
- [ ] Get current streak and longest streak from userStats
- [ ] Format as text block with box drawing characters
- [ ] Reply with formatted stats (ephemeral)

### Test /mystats Command
- [ ] Complete at least 3 sessions of varying lengths
- [ ] Run `/mystats` (default: week)
- [ ] Verify stats are accurate
- [ ] Run `/mystats today`
- [ ] Verify only today's sessions counted
- [ ] Run `/mystats all-time`
- [ ] Verify all sessions counted
- [ ] Try `/mystats` with no sessions (new user)
- [ ] Verify helpful "no stats yet" message
- [ ] Verify formatting looks good on desktop and mobile

---

## Phase 13: Code Cleanup & Refactoring

### Organize Code Structure
- [ ] Create `src/commands/` directory
- [ ] Move each command to separate file (start.ts, end.ts, etc.)
- [ ] Create `src/services/` directory
- [ ] Move session logic to `services/sessions.ts`
- [ ] Move stats logic to `services/stats.ts`
- [ ] Create `src/utils/` directory
- [ ] Move formatters to `utils/formatters.ts`
- [ ] Update imports in bot.ts

### Error Handling Improvements
- [ ] Add try/catch blocks to all command handlers
- [ ] Log errors to console with context
- [ ] Reply to user with friendly error messages
- [ ] Don't expose internal errors to users
- [ ] Add error handling for Firebase connection issues
- [ ] Add error handling for Discord API errors

### Code Review Checklist
- [ ] All functions have clear names
- [ ] No duplicate code
- [ ] All Firebase queries use proper error handling
- [ ] All Discord replies handle potential failures
- [ ] TypeScript types are used (no `any`)
- [ ] Console.log statements are helpful and not excessive
- [ ] No sensitive data in logs

---

## Phase 14: Testing & Bug Fixes

### Comprehensive Manual Testing
- [ ] Test all commands with valid inputs
- [ ] Test all commands with invalid inputs
- [ ] Test all error cases (no session, already exists, etc.)
- [ ] Test as admin and non-admin
- [ ] Test in multiple Discord servers
- [ ] Test with 2+ concurrent users
- [ ] Test very long intentions/descriptions (1000+ chars)
- [ ] Test special characters, emojis, mentions, URLs in text
- [ ] Test pause/resume multiple times in one session
- [ ] Test streaks over multiple days (manually adjust dates if needed)

### Edge Case Testing
- [ ] Start session, then bot goes offline, then comes back (session should persist)
- [ ] Very short session (<10 seconds)
- [ ] Very long session (8+ hours)
- [ ] Complete 10+ sessions in one day
- [ ] Test stats with 0 sessions
- [ ] Test stats with 100+ sessions
- [ ] Multiple users ending sessions simultaneously
- [ ] Feed channel deleted after setup (should fail gracefully)
- [ ] Change feed channel to different channel

### Bug Tracking
- [ ] Create list of any bugs found
- [ ] Prioritize bugs (critical, high, medium, low)
- [ ] Fix critical bugs before deployment
- [ ] Document known issues if not fixed

---

## Phase 15: Documentation

### Create README.md
- [ ] Project title and description
- [ ] What the bot does (brief overview)
- [ ] Setup instructions (Discord, Firebase, local)
- [ ] Environment variables needed
- [ ] How to run locally
- [ ] How to deploy to Railway
- [ ] Available commands list
- [ ] Contributing guidelines (if applicable)
- [ ] License information

### Create .env.example
- [ ] Copy .env structure
- [ ] Replace actual values with placeholders
- [ ] Add comments explaining each variable
- [ ] Commit to git (this file is safe to commit)

### Code Comments
- [ ] Add JSDoc comments to all exported functions
- [ ] Add inline comments for complex logic
- [ ] Add comments explaining any "magic numbers"
- [ ] Add TODO comments for future improvements

---

## Phase 16: Deployment Preparation

### Git Repository Setup
- [ ] Initialize git: `git init`
- [ ] Create .gitignore (should already exist)
- [ ] Verify .env and firebase-service-account.json are ignored
- [ ] Commit initial code: `git add .`
- [ ] Create initial commit: `git commit -m "Initial commit"`
- [ ] Create GitHub repository
- [ ] Add remote: `git remote add origin <url>`
- [ ] Push to GitHub: `git push -u origin main`

### Production Environment Variables
- [ ] Document all required environment variables
- [ ] Create Railway-compatible format for FIREBASE_SERVICE_ACCOUNT
- [ ] Test that service account JSON can be parsed from env var
- [ ] Update bot.ts to handle both local file and env var

### Build & Start Scripts
- [ ] Test `npm run build` produces dist/ folder
- [ ] Test `npm run start` runs from dist/
- [ ] Verify TypeScript compilation has no errors
- [ ] Add "engines" field to package.json specifying Node version

---

## Phase 17: Railway Deployment

### Railway Setup
- [ ] Create account at https://railway.app
- [ ] Create new project
- [ ] Connect GitHub repository
- [ ] Select repository and branch (main)

### Configure Environment Variables
- [ ] Add DISCORD_BOT_TOKEN
- [ ] Add DISCORD_CLIENT_ID
- [ ] Add FIREBASE_PROJECT_ID
- [ ] Add FIREBASE_SERVICE_ACCOUNT (entire JSON as string)
- [ ] Save environment variables

### Deploy & Monitor
- [ ] Railway auto-deploys from main branch
- [ ] Monitor deployment logs
- [ ] Check for successful build
- [ ] Check for successful start
- [ ] Verify bot shows online in Discord
- [ ] Test all commands in production

### Post-Deployment Testing
- [ ] Test `/ping` command
- [ ] Test `/start` and `/end` workflow
- [ ] Verify feed posts appear
- [ ] Test `/mystats` displays correctly
- [ ] Check Firebase for new data
- [ ] Monitor Railway logs for errors
- [ ] Test with multiple users
- [ ] Verify uptime over 24 hours

---

## Phase 18: Production Monitoring & Maintenance

### Initial Monitoring (First Week)
- [ ] Check Railway logs daily
- [ ] Monitor Firebase usage in console
- [ ] Check for any user-reported issues
- [ ] Verify bot stays online
- [ ] Monitor response times
- [ ] Check for any error patterns

### User Feedback
- [ ] Gather feedback from test users
- [ ] Create issues for bugs
- [ ] Create issues for feature requests
- [ ] Prioritize improvements

### Documentation Updates
- [ ] Update README with production URL (if applicable)
- [ ] Document any deployment issues encountered
- [ ] Add troubleshooting section to README
- [ ] Update spec.md with any changes made

---

## Phase 19: Future Enhancements (Optional)

### Social Features
- [ ] Design support/like system
- [ ] Design comment system
- [ ] Design follow system
- [ ] Implement feed filtering (following only)

### Advanced Stats
- [ ] Server-wide leaderboards
- [ ] Category/tag tracking
- [ ] Productivity insights
- [ ] Week-over-week comparisons

### Quality of Life
- [ ] Edit intention mid-session
- [ ] Set estimated duration
- [ ] Timer alerts at intervals
- [ ] Streak reminders via DM
- [ ] Daily/weekly summary DMs

### Integration
- [ ] Link Discord to Ambira web app
- [ ] Sync sessions across platforms
- [ ] Export data (CSV/JSON)
- [ ] Calendar integration

---

## Completion Criteria

### Ready for Production
- [x] All MVP commands implemented and tested
- [x] Feed posting works correctly
- [x] Stats calculate accurately
- [x] Streak tracking works
- [x] Error handling is robust
- [x] Code is clean and organized
- [x] Documentation is complete
- [x] Deployed to Railway successfully
- [x] Bot stays online >99% uptime
- [x] No critical bugs

### Success Metrics (First Month)
- [ ] Bot uptime: >99%
- [ ] 10+ active users
- [ ] 100+ sessions completed
- [ ] Average 3+ sessions per user per week
- [ ] No data loss incidents
- [ ] Positive user feedback

---

**Last Updated:** 2025-01-11
**Status:** Ready to begin Phase 0
