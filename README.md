# Study Together Bot

A Discord bot for collaborative productivity tracking with Strava-style social features. Track study/work sessions, earn XP and achievements, compete on leaderboards, and build study groups.

## Features

- **Session Tracking** - Start, pause, and complete sessions with live timers
- **XP & Leveling** - Earn 10 XP per hour, level up, unlock 50+ achievements
- **Leaderboards** - Compete daily, weekly, monthly, and all-time
- **Study Groups** - Team up (max 5 members) for XP bonuses up to 50%
- **Social Feed** - Share sessions with auto-generated images and reactions
- **Goals & Events** - Set daily goals and create collaborative study sessions
- **Rich Visualizations** - Beautiful stats, profiles, and leaderboards

## Quick Start

### For Users

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (.env file)
cp .env.example .env
# Add: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, FIREBASE_PROJECT_ID
# Place: firebase-service-account.json in project root

# 3. Test Puppeteer (especially on Windows)
npm run test:puppeteer

# 4. Run the bot
npm run dev
```

**Windows users**: If you encounter Puppeteer issues, see [WINDOWS_SETUP.md](./WINDOWS_SETUP.md) for detailed setup instructions.

### For Production

Deploy to Railway in minutes:

```bash
# Push to GitHub
git push origin main

# Connect to Railway (railway.app)
# Set environment variables
# Auto-deploy on push!
```

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

## Core Commands

| Command | Description |
|---------|-------------|
| `/start` | Start a productivity session |
| `/stop` | Complete session and post to feed |
| `/time` | Check session status |
| `/stats` | View your statistics |
| `/me` | View your profile |
| `/leaderboard` | Server rankings |
| `/creategroup` | Create a study group |
| `/group` | View group overview |

**50+ total commands** - See [Commands Reference](./docs/COMMANDS.md) for complete list.

## Documentation

### User Guides
- **[Setup Guide](./docs/SETUP.md)** - Installation and configuration
- **[Commands Reference](./docs/COMMANDS.md)** - All available commands explained

### Developer Resources
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and data flow
- **[API Documentation](./docs/API.md)** - Service layer reference
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment
- **[Contributing](./docs/CONTRIBUTING.md)** - How to contribute

**[View all documentation →](./docs/README.md)**

## Tech Stack

- **TypeScript** - Type-safe development
- **Discord.js v14** - Discord API framework
- **Firebase Firestore** - Real-time database
- **Puppeteer + React** - Image generation
- **Railway** - Deployment platform

## Project Structure

```
src/
├── bot.ts              # Main entry point, command handlers
├── types.ts            # TypeScript interfaces
├── services/           # Business logic (Session, Stats, XP, etc.)
├── components/         # React components for images
├── data/               # Static data (achievements, badges)
└── utils/              # Utility functions

docs/                   # Complete documentation
├── README.md           # Documentation hub
├── SETUP.md            # Installation guide
├── COMMANDS.md         # Command reference
├── ARCHITECTURE.md     # System architecture
├── API.md              # Developer API
├── DEPLOYMENT.md       # Deploy to production
└── CONTRIBUTING.md     # Contribution guide
```

## How It Works

```
User runs /start
  ↓
SessionService creates active session
  ↓
User runs /stop
  ↓
SessionService completes session
  ↓
XPService calculates XP (10/hour + bonuses)
  ↓
StatsService updates stats & streaks
  ↓
AchievementService checks unlocks
  ↓
PostService creates feed post with image
  ✓
User earns XP, levels up, unlocks achievements!
```

See [Architecture Documentation](./docs/ARCHITECTURE.md) for detailed flow diagrams.

## XP & Leveling

**Base XP:** 10 XP per hour

**Bonuses:**
- Group membership: +1% per group level (max 50%)
- Streak milestones: +50-250 XP
- Achievement unlocks: +50-1000 XP

**Leveling:** Exponential curve
- Level 1 → 2: 100 XP
- Level 10 → 11: 3,162 XP
- Level 20 → 21: 8,944 XP

## Study Groups

Create teams of up to 5 members:
- **Group XP:** All member sessions contribute
- **Group Levels:** Same progression as users
- **XP Bonus:** 1% per group level for all members
- **Public/Private:** Control discoverability
- **Group Leaderboard:** Compete with other groups

Example: Level 25 group = 25% XP bonus for all members!

## Database Schema

Firebase Firestore collections:

```
discord-data/
├── activeSessions/sessions/{userId}      # One active session per user
├── sessions/completed/{sessionId}        # All completed sessions
├── userStats/stats/{userId}              # Stats, XP, achievements
├── groups/active/{groupId}               # Study groups
├── groupMembers/memberships/{userId}     # User group memberships
├── sessionPosts/posts/{messageId}        # Feed posts
├── dailyGoals/goals/{userId}             # User goals
├── events/scheduled/{eventId}            # Study events
└── serverConfig/configs/{serverId}       # Server settings
```

## Development

```bash
npm run dev      # Development mode (auto-reload)
npm run build    # Compile TypeScript
npm start        # Production mode
```

See [Contributing Guide](./docs/CONTRIBUTING.md) for development workflow.

## Examples

### Session Tracking
```
/start activity: Learning React hooks
 → ✅ Session started! 0h 0m elapsed

/time
 → 📊 Active session: Learning React hooks
    Elapsed: 1h 23m | Status: Active

/stop
 → (Modal appears)
    Title: React Practice
    Description: Built a todo app with useState and useEffect
 → ✅ Session completed! +83 XP | Posted to feed
```

### Group Creation
```
/creategroup name: Study Warriors public: true
 → ✅ Group Created! Study Warriors (GP-A1B2)
    Share: /joingroup GP-A1B2

/group
 → (Image shows group stats)
    Study Warriors | Level 10 (+10% XP)
    5/5 members | 245 total hours
```

## Achievements

50+ unlockable achievements:
- **Milestones:** First session, 100 sessions
- **Time:** 10h, 100h, 1000h studied
- **Streaks:** 7 days, 30 days, 100 days
- **Schedule:** Early Bird, Night Owl, Weekend Warrior
- **Social:** Reactions, kudos given/received
- **Meta:** All achievements unlocked

Each achievement awards bonus XP (50-1000 XP)!

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application ID from Discord |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT` | Production | Service account JSON (for Railway) |

Local: Use `.env` file + `firebase-service-account.json`
Production: Use Railway environment variables

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Connect repository to Railway
3. Set environment variables
4. Deploy automatically!

**Cost:** Free tier available, ~$5-10/month for production

See [Deployment Guide](./docs/DEPLOYMENT.md) for complete instructions.

## Support

- **Documentation:** [docs/](./docs/README.md)
- **Issues:** [GitHub Issues](your-repo/issues)
- **Questions:** Check [Setup Guide](./docs/SETUP.md) and [Commands Reference](./docs/COMMANDS.md)

## Contributing

We welcome contributions! See [Contributing Guide](./docs/CONTRIBUTING.md) for:
- Code style guidelines
- Development workflow
- Pull request process
- Issue reporting

## License

ISC

---

**Ready to get started?**
1. [Setup Guide](./docs/SETUP.md) - Install the bot
2. [Commands Reference](./docs/COMMANDS.md) - Learn all commands
3. [Deployment Guide](./docs/DEPLOYMENT.md) - Deploy to production
