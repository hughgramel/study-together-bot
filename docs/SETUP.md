# Setup Guide

Complete guide to setting up Study Together bot for local development and production deployment.

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** or **yarn** - Comes with Node.js
- **Git** - For version control
- **Discord Account** - To create a bot application
- **Firebase Account** - For database (free tier is sufficient)

### System Requirements

- OS: macOS, Linux, or Windows (WSL recommended)
- RAM: 2GB minimum (4GB recommended for image generation)
- Disk Space: 500MB for dependencies

## Part 1: Discord Bot Setup

### Step 1: Create Discord Application

1. Navigate to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Enter a name (e.g., "Study Together Bot")
4. Click **Create**

### Step 2: Configure Bot User

1. In your application, navigate to the **Bot** tab
2. Click **Add Bot** → **Yes, do it!**
3. Under **Token**, click **Copy** (save this for later)
   - **IMPORTANT**: Never share this token publicly!
4. Enable the following **Privileged Gateway Intents**:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent

### Step 3: Configure OAuth2 Permissions

1. Navigate to the **OAuth2** → **URL Generator** tab
2. Under **Scopes**, select:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Under **Bot Permissions**, select:
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Use Slash Commands
   - ✅ Add Reactions
   - ✅ Create Public Threads
4. Copy the generated URL at the bottom
5. Open the URL in a browser and invite the bot to your test server

### Step 4: Get Application ID

1. Navigate to **General Information** tab
2. Under **Application ID**, click **Copy** (save this for later)

## Part 2: Firebase Setup

### Step 1: Create Firebase Project

1. Navigate to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Enter a project name (e.g., "study-together-bot")
4. Disable Google Analytics (optional)
5. Click **Create project**

### Step 2: Enable Firestore Database

1. In the Firebase Console, click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Select **Start in production mode** (we'll configure security rules later)
4. Choose a location (select one closest to your users)
5. Click **Enable**

### Step 3: Get Firebase Project ID

1. In Firebase Console, click the **gear icon** → **Project settings**
2. Under **General** tab, copy the **Project ID** (save this for later)

### Step 4: Generate Service Account

1. In **Project settings**, navigate to the **Service Accounts** tab
2. Click **Generate new private key**
3. Click **Generate key** in the confirmation dialog
4. A JSON file will download - save this securely

**IMPORTANT**: This file contains sensitive credentials. Never commit it to version control!

### Step 5: Configure Firestore Security Rules (Optional)

1. In Firestore Database, navigate to the **Rules** tab
2. Replace with the following rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow bot service account full access
    match /discord-data/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

## Part 3: Local Development Setup

### Step 1: Clone Repository

```bash
git clone <your-repo-url>
cd study-together-bot
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- `discord.js` - Discord API library
- `firebase-admin` - Firebase SDK
- `puppeteer` - Image generation
- `react` & `react-dom` - Component rendering
- `typescript` - Type safety
- Other utilities

### Step 3: Configure Environment Variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Open `.env` in a text editor and fill in your credentials:

```env
# Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token_from_step_1.2.3
DISCORD_CLIENT_ID=your_application_id_from_step_1.4.2

# Firebase Configuration
FIREBASE_PROJECT_ID=your_firebase_project_id_from_step_2.3.2

# For local development, leave this empty (we'll use the JSON file)
FIREBASE_SERVICE_ACCOUNT=
```

### Step 4: Add Firebase Service Account File

1. Rename the downloaded service account JSON file to:
   ```
   firebase-service-account.json
   ```

2. Place it in the **project root directory** (same level as `package.json`)

3. Verify `.gitignore` includes this file:
   ```
   firebase-service-account.json
   ```

### Step 5: Verify Installation

Check that everything is set up correctly:

```bash
# Verify Node.js version
node --version
# Should show v18.x.x or higher

# Verify dependencies installed
npm list discord.js firebase-admin
```

### Step 6: Run the Bot

Start the bot in development mode:

```bash
npm run dev
```

You should see:
```
✅ Loaded Firebase credentials from local file
Firebase initialized successfully
Bot is ready! Logged in as Study Together Bot#1234
Registered 25 slash commands
```

### Step 7: Test in Discord

1. Go to your Discord server where you invited the bot
2. Type `/` in any channel
3. You should see a list of Study Together commands
4. Test a basic command:
   ```
   /ping
   ```
   Expected response: `Pong! Bot is responsive.`

## Part 4: Initial Configuration

### Step 1: Set Up Feed Channel

1. Create a dedicated channel for session posts (e.g., `#study-feed`)
2. Run the setup command:
   ```
   /setup-feed channel: #study-feed
   ```
3. The bot should confirm: `Feed channel set to #study-feed`

### Step 2: Test Session Flow

1. Start a session:
   ```
   /start activity: Testing the bot setup
   ```

2. Check session status:
   ```
   /time
   ```

3. Complete the session:
   ```
   /stop title: Setup Test description: Successfully configured the bot!
   ```

4. Verify:
   - Session post appears in `#study-feed`
   - You received XP
   - Your stats were updated

### Step 3: View Your Stats

```
/stats
```

You should see a generated image with:
- Your total sessions
- Total study time
- Current streak
- Level and XP progress

## Part 5: Development Commands

### Available Scripts

```bash
# Development mode (hot reload with ts-node)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production mode (runs compiled code)
npm start

# Clean up duplicate sessions (maintenance)
npm run cleanup-duplicates
```

### Project Structure

```
study-together-bot/
├── src/                    # Source code
│   ├── bot.ts             # Main entry point
│   ├── types.ts           # Type definitions
│   ├── services/          # Business logic
│   ├── components/        # React components
│   ├── data/              # Static data (achievements, badges)
│   └── utils/             # Utility functions
├── dist/                  # Compiled JavaScript (after build)
├── .env                   # Environment variables (not committed)
├── .env.example           # Environment template
├── firebase-service-account.json  # Firebase credentials (not committed)
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── README.md
```

## Troubleshooting

### Bot doesn't appear online

**Possible causes:**
- Invalid `DISCORD_BOT_TOKEN`
- Bot not invited to server
- Intents not enabled

**Solution:**
1. Verify token in `.env` matches Discord Developer Portal
2. Re-invite bot using OAuth2 URL
3. Enable all required intents in Bot settings

### Commands don't appear in Discord

**Possible causes:**
- Commands not registered
- Bot lacks `applications.commands` scope

**Solution:**
1. Check console for "Registered X slash commands" message
2. Wait 5-10 minutes (Discord caches commands)
3. Re-invite bot with correct OAuth2 scopes

### Firebase connection fails

**Error**: `❌ Firebase service account file not found`

**Solution:**
1. Ensure `firebase-service-account.json` exists in project root
2. Verify file is valid JSON
3. Check `FIREBASE_PROJECT_ID` matches your Firebase project

### Puppeteer fails to launch

**Error**: `Failed to launch the browser process`

**Solution (Linux):**
```bash
# Install required dependencies
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  libasound2
```

**Solution (macOS):**
- Puppeteer should work out-of-the-box
- If issues persist, reinstall: `npm install puppeteer`

**Solution (Windows):**
- Use WSL2 (Windows Subsystem for Linux)
- Or install Windows build tools: `npm install --global windows-build-tools`

### Image generation is slow

**Symptoms**: `/stats` or `/me` commands take 10+ seconds

**Causes**:
- First-time Puppeteer browser launch (slow)
- Subsequent generations should be faster (200-500ms)

**Optimization**:
- Ensure adequate RAM (4GB+)
- Close other applications
- Browser instance is reused after first launch

### Session doesn't appear in feed

**Possible causes:**
- Feed channel not configured
- Bot lacks Send Messages permission in feed channel
- Feed channel was deleted

**Solution:**
1. Check feed channel configuration:
   ```
   /setup-feed channel: #study-feed
   ```
2. Verify bot has permissions in that channel
3. Test with a new session

### "No active session found" error

**Cause**: Session document doesn't exist or was corrupted

**Solution:**
1. Try canceling and restarting:
   ```
   /cancel
   /start activity: New session
   ```
2. Check Firebase Console → Firestore → `activeSessions/sessions/{userId}`

## Advanced Configuration

### Setting Server Timezone

By default, the bot uses UTC. To set a custom timezone:

```typescript
// In bot.ts or via admin command
await serverConfigRef.set({
  timezone: 'America/New_York',  // IANA timezone
  feedChannelId: channelId,
  setupAt: Timestamp.now(),
  setupBy: adminUserId
});
```

### Customizing XP Rates

Edit the XP calculation in `src/services/xp.ts`:

```typescript
export class XPService {
  async calculateSessionXP(duration: number, intensity?: number): Promise<number> {
    // Change base rate (default: 10 XP/hour)
    const baseXP = (duration / 3600) * 20; // Now 20 XP/hour
    // ... rest of calculation
  }
}
```

### Adding Custom Achievements

Edit `src/data/achievements.ts`:

```typescript
{
  id: 'my_custom_achievement',
  name: 'Custom Achievement',
  emoji: '🎯',
  description: 'Custom description',
  category: 'milestone',
  xpReward: 100,
  condition: {
    type: 'sessions',
    threshold: 50,
    field: 'totalSessions'
  },
  rarity: 'rare',
  order: 999
}
```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | ✅ Yes | Bot authentication token | `MTIzNDU2Nzg5MDEyMzQ1Njc4OTAuGh7Kj8.Xy9-Ab...` |
| `DISCORD_CLIENT_ID` | ✅ Yes | Discord application ID | `1234567890123456789` |
| `FIREBASE_PROJECT_ID` | ✅ Yes | Firebase project identifier | `study-together-prod` |
| `FIREBASE_SERVICE_ACCOUNT` | Production only | Full service account JSON (for Railway) | `{"type":"service_account",...}` |

## Security Best Practices

### Local Development

1. **Never commit credentials**:
   - Add `.env` to `.gitignore`
   - Add `firebase-service-account.json` to `.gitignore`

2. **Protect your bot token**:
   - Regenerate if accidentally exposed
   - Use environment variables, never hardcode

3. **Firebase security rules**:
   - Restrict write access to service account only
   - Consider read permissions based on use case

### Production

1. **Use environment variables**:
   - Store credentials in Railway/hosting platform
   - Never store in code

2. **Monitor Firebase quota**:
   - Free tier: 50k reads/day, 20k writes/day
   - Upgrade if needed

3. **Regular backups**:
   - Export Firestore data periodically
   - Use Firebase Console → Firestore → Export/Import

## Next Steps

Now that your bot is set up:

1. Read the [Commands Reference](./COMMANDS.md) to learn all available commands
2. Review [Architecture](./ARCHITECTURE.md) to understand how the bot works
3. Check [API Documentation](./API.md) for service layer details
4. Deploy to production using the [Deployment Guide](./DEPLOYMENT.md)

## Getting Help

If you encounter issues not covered here:

1. Check [GitHub Issues](your-repo/issues) for similar problems
2. Review Firebase Console logs
3. Check Railway deployment logs (for production)
4. Enable debug logging in `bot.ts`

## Additional Resources

- [Discord.js Guide](https://discordjs.guide/)
- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [Puppeteer Documentation](https://pptr.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
