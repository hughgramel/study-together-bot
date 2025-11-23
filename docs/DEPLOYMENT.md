# Deployment Guide

Complete guide to deploying Study Together bot to production on Railway.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Railway Deployment](#railway-deployment)
- [Environment Configuration](#environment-configuration)
- [Build Process](#build-process)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)
- [Production Checklist](#production-checklist)

---

## Prerequisites

Before deploying to production, ensure you have:

- ✅ Bot tested locally and working
- ✅ GitHub repository with all code pushed
- ✅ Railway account created (sign up at [railway.app](https://railway.app))
- ✅ Discord bot token and client ID
- ✅ Firebase project with Firestore enabled
- ✅ Firebase service account JSON file
- ✅ All test/mock commands removed from code

### Pre-Deployment Checklist

- [ ] Remove test commands (`/testgroup`, `/testgroupleaderboard`, etc.)
- [ ] Verify all environment variables are set
- [ ] Test all commands locally
- [ ] Verify Firebase security rules are configured
- [ ] Check `.gitignore` excludes sensitive files
- [ ] Update README.md with production info
- [ ] Confirm Discord bot has correct permissions in production server

---

## Railway Deployment

### Step 1: Connect GitHub Repository

1. Navigate to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub account
5. Select your repository (e.g., `study-together-bot`)
6. Railway will automatically detect it's a Node.js project

### Step 2: Configure Build Settings

Railway should auto-detect the build process from `package.json`. Verify:

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
npm start
```

If not auto-detected, configure manually:

1. Go to **Settings** tab
2. Under **Build & Deploy**, set:
   - Build Command: `npm run build`
   - Start Command: `npm start`
3. Click **Save**

### Step 3: Set Environment Variables

1. In your Railway project, click on the **Variables** tab
2. Add the following variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `DISCORD_BOT_TOKEN` | Your bot token from Discord Developer Portal | Keep secret! |
| `DISCORD_CLIENT_ID` | Your application ID from Discord Developer Portal | Public ID |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID | Found in Firebase Console |
| `FIREBASE_SERVICE_ACCOUNT` | Full service account JSON as string | See below for formatting |

**IMPORTANT: Formatting `FIREBASE_SERVICE_ACCOUNT`**

Railway expects the entire service account JSON as a single-line string. You have two options:

**Option 1: Copy-paste (easiest)**
1. Open your `firebase-service-account.json` file
2. Copy the **entire contents** (including outer braces)
3. Paste directly into Railway's `FIREBASE_SERVICE_ACCOUNT` field
4. Railway will handle the formatting automatically

**Option 2: Manual minification**
```bash
# Minify the JSON to a single line
cat firebase-service-account.json | jq -c
```

Copy the output and paste into Railway.

**Example (truncated):**
```
{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

### Step 4: Deploy

1. Click **Deploy** or wait for automatic deployment
2. Railway will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build TypeScript (`npm run build`)
   - Start the bot (`npm start`)

**Deployment typically takes 2-5 minutes.**

### Step 5: Verify Deployment

1. Go to the **Logs** tab in Railway
2. Look for:
   ```
   ✅ Loaded Firebase credentials from environment variable
   Firebase initialized successfully
   Bot is ready! Logged in as Study Together Bot#1234
   Registered 25 slash commands
   ```

3. Check Discord:
   - Bot should appear online
   - Commands should be available (type `/` in server)
   - Test with `/ping`

---

## Environment Configuration

### Required Environment Variables

| Variable | Source | Example |
|----------|--------|---------|
| `DISCORD_BOT_TOKEN` | Discord Developer Portal → Bot → Token | `MTIzNDU2Nzg5MDEyMzQ1Njc4OTAuGh7Kj8...` |
| `DISCORD_CLIENT_ID` | Discord Developer Portal → General Information → Application ID | `1234567890123456789` |
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → Project ID | `study-together-prod` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Service Accounts → Generate Key | `{"type":"service_account",...}` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode (Railway sets this automatically) |
| `PORT` | `3000` | Port for health checks (not used by Discord bot) |

---

## Build Process

### What Happens During Build

1. **Install dependencies**
   ```bash
   npm install
   ```
   Installs all packages from `package.json`:
   - `discord.js`
   - `firebase-admin`
   - `puppeteer`
   - `react`, `react-dom`
   - `typescript`
   - etc.

2. **Compile TypeScript**
   ```bash
   npm run build
   ```
   Compiles `/src/**/*.ts` to `/dist/**/*.js`

3. **Download Chromium (for Puppeteer)**
   - Puppeteer downloads Chromium browser (~170MB)
   - Used for image generation
   - Railway has enough disk space for this

### Build Configuration

**tsconfig.json** should include:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

**package.json scripts:**
```json
{
  "scripts": {
    "dev": "ts-node src/bot.ts",
    "build": "tsc",
    "start": "node dist/bot.js"
  }
}
```

---

## Monitoring & Logs

### Viewing Logs

**Railway Dashboard:**
1. Go to your project
2. Click **Logs** tab
3. Real-time logs appear here

**Log Levels:**
- `[INFO]` - General information
- `[ERROR]` - Errors and exceptions
- `[XP]` - XP awarding events
- `[ACHIEVEMENT]` - Achievement unlocks

**Example logs:**
```
[INFO] Bot is ready! Logged in as Study Together Bot#1234
[INFO] Registered 25 slash commands
[XP] Awarded 100 XP to user123 for "Session completed". New XP: 1250, Level: 5
[ACHIEVEMENT] Unlocked 'Centurion' for user123 (+200 XP bonus)
[ERROR] Failed to fetch user stats: FirebaseError: Permission denied
```

### Health Monitoring

**Bot Status:**
- Check if bot appears online in Discord
- Test with `/ping` command

**Railway Metrics:**
- CPU usage
- Memory usage
- Network traffic

**Firebase Metrics:**
- Go to Firebase Console → Usage
- Check reads/writes quota
- Monitor Firestore database size

### Error Tracking

Add error logging to catch issues:

```typescript
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
```

### Setting Up Alerts (Optional)

**Railway Notifications:**
1. Go to Project Settings → Notifications
2. Enable deployment notifications
3. Add webhook or email

**Discord Webhook (for error alerts):**
```typescript
// Send critical errors to Discord channel
async function sendErrorAlert(error: Error) {
  const webhook = new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL });
  await webhook.send({
    content: `🚨 **Bot Error**\n\`\`\`${error.message}\`\`\``,
  });
}
```

---

## Troubleshooting

### Bot Not Coming Online

**Possible causes:**
- Invalid `DISCORD_BOT_TOKEN`
- Build failed
- Process crashed on startup

**Solutions:**
1. Check Railway logs for errors
2. Verify environment variables are set correctly
3. Ensure bot token is valid (regenerate if needed)
4. Check Discord Developer Portal → Bot → Token

---

### Build Failures

**Error: TypeScript compilation failed**

**Solution:**
```bash
# Fix TypeScript errors locally first
npm run build

# Check for type errors
tsc --noEmit
```

**Error: Module not found**

**Solution:**
```bash
# Ensure all dependencies are in package.json
npm install <missing-module> --save
```

---

### Puppeteer Issues

**Error: Failed to launch browser**

**Cause:** Missing system dependencies for Chromium

**Solution:**
Railway should handle this automatically, but if issues persist:

```dockerfile
# Add to Dockerfile (if using Docker deployment)
RUN apt-get update && apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  libasound2
```

For Railway (Nixpacks):
- Railway automatically installs required dependencies
- No action needed

---

### Firebase Connection Errors

**Error: Firebase permission denied**

**Cause:** Invalid service account or security rules

**Solution:**
1. Verify `FIREBASE_SERVICE_ACCOUNT` is correctly formatted
2. Check Firebase security rules allow service account access
3. Regenerate service account key if needed

**Error: Project not found**

**Cause:** Incorrect `FIREBASE_PROJECT_ID`

**Solution:**
- Verify project ID in Firebase Console
- Update Railway environment variable

---

### Commands Not Appearing

**Cause:** Commands not registered

**Solution:**
1. Check logs for "Registered X slash commands"
2. Wait 5-10 minutes for Discord to update
3. Kick and re-invite bot to refresh permissions
4. Verify `DISCORD_CLIENT_ID` is correct

---

### Out of Memory Errors

**Cause:** Puppeteer using too much RAM

**Solution:**
1. Upgrade Railway plan for more RAM
2. Optimize image generation:
   ```typescript
   // Reduce browser instances
   let browserInstance: Browser | null = null;

   async function getBrowser() {
     if (!browserInstance) {
       browserInstance = await puppeteer.launch({
         args: ['--no-sandbox', '--disable-dev-shm-usage']
       });
     }
     return browserInstance;
   }
   ```

---

## Rollback Procedures

### Rolling Back to Previous Version

**Method 1: Railway Dashboard**
1. Go to **Deployments** tab
2. Find previous successful deployment
3. Click **Redeploy**

**Method 2: Git Revert**
```bash
# Find the commit to revert to
git log --oneline

# Revert to specific commit
git revert <commit-hash>

# Or reset to previous commit (careful!)
git reset --hard <commit-hash>

# Force push to trigger redeploy
git push origin main --force
```

### Emergency Shutdown

If the bot is causing issues:

**Option 1: Pause Railway Service**
1. Go to Railway project
2. Click **Settings**
3. Click **Pause Service**

**Option 2: Disable Bot Token**
1. Go to Discord Developer Portal
2. Bot → Regenerate Token
3. This will disconnect the bot immediately
4. Update Railway with new token when ready

---

## Production Checklist

### Before First Deployment

- [ ] Remove all test/mock commands from code
- [ ] Verify `.gitignore` excludes:
  - `.env`
  - `firebase-service-account.json`
  - `node_modules/`
  - `dist/`
- [ ] Set all environment variables in Railway
- [ ] Test all commands locally
- [ ] Review Firebase security rules
- [ ] Set up feed channel in production Discord server
- [ ] Verify bot has correct permissions in production server

### After Deployment

- [ ] Verify bot appears online
- [ ] Test `/ping` command
- [ ] Test session workflow: `/start` → `/time` → `/stop`
- [ ] Verify feed posts work
- [ ] Test XP and level ups
- [ ] Test group creation and joining
- [ ] Check achievements unlock correctly
- [ ] Verify leaderboards populate
- [ ] Monitor Railway logs for errors
- [ ] Check Firebase quota usage

### Ongoing Maintenance

- [ ] Monitor Railway logs daily (first week)
- [ ] Check Firebase quota weekly
- [ ] Review error logs
- [ ] Update dependencies monthly:
  ```bash
  npm outdated
  npm update
  ```
- [ ] Back up Firestore data regularly
- [ ] Monitor Discord API rate limits

---

## Continuous Deployment

### Automatic Deployments

Railway can automatically deploy on every push to `main`:

1. Go to **Settings** → **Deploy**
2. Enable **Auto Deploy**
3. Select branch: `main`
4. Save

**Now every push to `main` triggers a new deployment.**

### Deployment Workflow

```bash
# Local development
git checkout -b feature/new-command
# Make changes
git add .
git commit -m "Add new command"
git push origin feature/new-command

# Create pull request on GitHub
# Review and merge to main

# Railway automatically deploys within 2-5 minutes
```

---

## Scaling Considerations

### Current Setup (Free Tier)

Railway free tier includes:
- 500 hours/month runtime
- 512 MB RAM
- 1 GB disk space
- Shared CPU

**This is sufficient for:**
- Small to medium Discord servers (< 1,000 members)
- Moderate usage (< 100 sessions/day)

### When to Scale Up

**Indicators:**
- Memory errors in logs
- Slow image generation
- Firebase quota exceeded
- More than 1,000 active users

**Upgrade Options:**
1. **Railway Pro Plan** ($5-20/month)
   - More RAM and CPU
   - Higher uptime guarantee
   - Priority support

2. **Firebase Blaze Plan** (pay-as-you-go)
   - Higher quotas
   - Automatic scaling
   - Only pay for usage above free tier

### Performance Optimization

**Firestore Optimization:**
- Add indexes for frequently queried fields
- Batch reads with `Promise.all()`
- Cache user stats during session operations

**Image Generation Optimization:**
- Reuse Puppeteer browser instance
- Reduce image resolution if needed
- Consider caching common images

---

## Security Best Practices

### Environment Variables

- ✅ Never commit `.env` to Git
- ✅ Use Railway's encrypted variable storage
- ✅ Rotate bot token if exposed
- ✅ Regenerate Firebase service account if leaked

### Firebase Security

**Recommended Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only allow service account to write
    match /discord-data/{document=**} {
      allow read: if request.auth != null;
      allow write: if false;  // Only service account can write
    }
  }
}
```

### Discord Permissions

**Minimum required permissions:**
- Send Messages
- Embed Links
- Attach Files
- Use Slash Commands
- Read Message History
- Add Reactions
- Create Public Threads

**Do NOT grant:**
- Administrator
- Manage Server
- Manage Channels
- Manage Messages (unless needed for moderation features)

---

## Backup & Recovery

### Firestore Backups

**Manual Export:**
1. Go to Firebase Console
2. Firestore Database → Import/Export
3. Click **Export**
4. Select collections
5. Export to Google Cloud Storage bucket

**Automated Backups (recommended):**
- Set up Cloud Scheduler to run daily exports
- See [Firebase Backup Guide](https://firebase.google.com/docs/firestore/manage-data/export-import)

### Recovery Procedures

**If database is corrupted:**
1. Stop the bot (pause Railway service)
2. Import last known good backup
3. Verify data integrity
4. Resume bot

**If bot code is broken:**
1. Rollback to previous deployment (see Rollback Procedures)
2. Or fix and redeploy quickly

---

## Cost Estimation

### Railway

**Free Tier:**
- $0/month
- 500 hours runtime
- Sufficient for small servers

**Starter Plan:**
- $5/month
- 500 hours + $0.01/hour after
- 1 GB RAM, 1 vCPU

### Firebase

**Free Tier (Spark):**
- 50,000 reads/day
- 20,000 writes/day
- 1 GB storage
- **Estimated capacity:** ~100 active users

**Blaze Plan (Pay-as-you-go):**
- $0.06 per 100,000 reads
- $0.18 per 100,000 writes
- $0.18 per GB storage
- **Estimated cost:** $5-20/month for 500-1000 active users

### Total Estimated Cost

| Server Size | Railway | Firebase | Total |
|-------------|---------|----------|-------|
| Small (< 100 users) | $0 | $0 | **$0/month** |
| Medium (100-500 users) | $5 | $0-5 | **$5-10/month** |
| Large (500-1000 users) | $10 | $10-20 | **$20-30/month** |

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [Discord.js Guide](https://discordjs.guide/)
- [Puppeteer Documentation](https://pptr.dev/)

---

## Support

If you encounter deployment issues:

1. Check Railway logs first
2. Review this guide's troubleshooting section
3. Check [GitHub Issues](your-repo/issues)
4. Contact Railway support (for platform issues)
5. Review Discord.js or Firebase docs (for library issues)

---

**Next Steps:**
- Return to [Setup Guide](./SETUP.md) for local development
- Review [Architecture](./ARCHITECTURE.md) for system design
- Check [Commands Reference](./COMMANDS.md) for available features
