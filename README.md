# Study Together Bot

A Discord bot for collaborative productivity tracking with Strava-style social features. Track study/work sessions, compete on leaderboards, and share accomplishments with your community.

## Features

- **Session Tracking**: Start, pause, unpause, and complete productivity sessions with live status updates
- **Personal Stats Dashboard**: View your daily, weekly, monthly, and all-time statistics with streak tracking
- **Competitive Leaderboards**: See how you rank against others with daily, weekly, and monthly leaderboards
- **Social Feed**: Completed sessions post as Strava-style embeds with reactions and comment threads
- **Streak System**: Build consecutive day streaks with fire emoji rewards (🔥🔥🔥 for 30+ days!)
- **Real-time Updates**: Check your session progress anytime with elapsed time tracking

## Available Commands

### Session Management
- `/start {activity}` - Start a new productivity session
- `/time` - Check your current session status and elapsed time
- `/pause` - Take a break without ending your session
- `/unpause` - Continue your paused session
- `/stop {title} {description}` - Complete and share your session
- `/cancel` - Discard your active session without saving

### Statistics & Leaderboards
- `/stats` - View your personal statistics with Duolingo-style images
- `/me` - View your Duolingo-style profile overview
- `/leaderboard [timeframe]` - Interactive leaderboard with daily/weekly/monthly/all-time selector

### Admin
- `/setup-feed {#channel}` - Configure feed channel for completed sessions (Admin only)
- `/ping` - Test bot responsiveness

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Discord Application created at https://discord.com/developers/applications
- Firebase project with Firestore enabled
- Firebase service account JSON file

### Local Development Setup

1. **Clone or navigate to the project directory**
```bash
cd /path/to/discordbot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot token, client ID, and Firebase project ID
   - Place your `firebase-service-account.json` file in the project root

4. **Run the bot locally**
```bash
npm run dev
```

The bot should show online in your Discord server.

### Discord Bot Configuration

1. Create a Discord application at https://discord.com/developers/applications
2. Navigate to the "Bot" tab and create a bot user
3. Copy the bot token for your `.env` file
4. Enable the following Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent
5. Copy the Application ID from the "General Information" tab for your `.env` file
6. Use the OAuth2 URL Generator to create an invite link with:
   - Scopes: `bot` and `applications.commands`
   - Permissions: Send Messages, Read Messages/View Channels, Use Slash Commands
7. Invite the bot to your test server

### Firebase Configuration

1. Open your Firebase project console
2. Navigate to Project Settings → Service Accounts
3. Click "Generate new private key" to download the service account JSON
4. Save it as `firebase-service-account.json` in the project root
5. Copy your Firebase Project ID from the General tab
6. Ensure Firestore Database is enabled in your project

## Production Deployment

### Railway Deployment

1. **Push code to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

2. **Create Railway project**
   - Go to https://railway.app
   - Create a new project
   - Connect your GitHub repository

3. **Configure environment variables in Railway**
   - `DISCORD_BOT_TOKEN` - Your Discord bot token
   - `DISCORD_CLIENT_ID` - Your Discord application ID
   - `FIREBASE_PROJECT_ID` - Your Firebase project ID
   - `FIREBASE_SERVICE_ACCOUNT` - Paste the entire contents of your service account JSON file as a single-line string

4. **Deploy**
   - Railway will automatically deploy on push to main branch
   - Monitor deployment logs to ensure successful start

## Project Structure

```
discordbot/
├── src/
│   ├── bot.ts              # Main bot entry point, command handlers
│   ├── types.ts            # TypeScript interfaces
│   ├── services/
│   │   ├── sessions.ts     # Session CRUD operations
│   │   └── stats.ts        # Statistics and leaderboard calculations
│   └── utils/
│       └── formatters.ts   # Duration formatting and date utilities
├── .claude/
│   └── claude.md           # Claude Code rules and project context
├── .env                    # Local environment variables (NOT committed)
├── .env.example            # Example environment variables
├── .gitignore
├── railway.json            # Railway deployment configuration
├── package.json
├── tsconfig.json
├── firebase-service-account.json  # Firebase credentials (NOT committed)
└── README.md
```

## Data Architecture

All data is stored in Firebase Firestore under the `discord-data/` collection:

- **activeSessions/sessions/{userId}** - One active session per user
- **sessions/completed/{sessionId}** - All completed sessions
- **userStats/stats/{userId}** - User statistics and streaks
- **serverConfig/configs/{serverId}** - Server configuration (feed channel)

## Usage Example

1. Start a session:
```
/start activity: Learn Discord.js and build a bot
```

2. Check your progress:
```
/time
```

3. Take a break:
```
/pause
```

4. Resume working:
```
/unpause
```

5. Complete the session:
```
/stop title: Discord Bot Project description: Built a complete Discord bot with Firebase integration and leaderboards
```

6. View your stats:
```
/stats      # View detailed statistics
/me         # View your profile overview
```

7. Check the leaderboards:
```
/leaderboard timeframe: daily   # Daily leaderboard
/leaderboard                    # Defaults to daily
```

## Development Commands

```bash
npm run dev      # Run bot in development mode with ts-node
npm run build    # Compile TypeScript to JavaScript
npm start        # Run compiled bot from dist/
```

## Support

For issues or questions, please refer to the project specification in `spec.md` or create an issue in the repository.

## License

ISC
