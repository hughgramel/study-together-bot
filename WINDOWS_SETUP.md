# Windows Setup Guide

This guide helps you set up and run the Discord bot on Windows.

## Prerequisites

1. **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
2. **Git** - Download from [git-scm.com](https://git-scm.com/)
3. **Visual Studio Build Tools** (for native modules) - See below

## Installing Visual Studio Build Tools

Some npm packages (including Puppeteer) require native compilation on Windows. Install the build tools:

```bash
# Option 1: Using npm (recommended)
npm install --global windows-build-tools

# Option 2: Manual installation
# Download Visual Studio Build Tools from:
# https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"
```

## Installing Dependencies

```bash
# Install all dependencies
npm install

# Verify Puppeteer installation
npm run test:puppeteer
```

## Common Puppeteer Issues on Windows

### Issue 1: Chrome Not Found

**Error**: `Could not find Chrome (ver. XXX). This can occur if...`

**Solution 1** - Reinstall Puppeteer with Chrome:
```bash
npm uninstall puppeteer
npm install puppeteer
```

**Solution 2** - Use existing Chrome installation:
```bash
# Set environment variable to use your Chrome installation
# Add to .env file:
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

### Issue 2: Browser Launch Timeout

**Error**: `TimeoutError: Waiting for the browser to disconnect timed out`

**Solution**: The bot now handles this automatically. If browser warmup fails during startup, the browser will launch on-demand when needed. However, you can also:

1. Disable browser warmup during development:
   ```bash
   # Add to .env
   SKIP_BROWSER_WARMUP=true
   ```

2. Increase timeout in `src/services/browserPool.ts` (already set to 30s)

### Issue 3: Access Denied / Permission Errors

**Error**: `Error: spawn EACCES` or similar permission errors

**Solution**:
1. Run Command Prompt or PowerShell as Administrator
2. Check antivirus isn't blocking Node.js or Chrome
3. Ensure Windows Defender allows the application

### Issue 4: Path Issues

**Error**: Issues with file paths or backslashes

**Solution**: The bot now automatically handles Windows path differences. If you still have issues, check that:
- You're not hardcoding paths with forward slashes
- Environment variables use Windows path format

## Running the Bot

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

## Testing Puppeteer

Run this command to test if Puppeteer works on your system:

```bash
npm run test:puppeteer
```

This will:
1. Launch a browser
2. Take a screenshot
3. Save it to `test-screenshot.png`
4. Print success or error messages

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# Optional - for Windows Chrome issues
PUPPETEER_EXECUTABLE_PATH=C:\Path\To\Chrome\chrome.exe

# Optional - skip browser warmup during development
SKIP_BROWSER_WARMUP=true

# Firebase (required)
FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase vars
```

## Troubleshooting

### Bot starts but crashes on first image generation

This means Puppeteer is failing on-demand. Check:
1. Run `npm run test:puppeteer` to verify Puppeteer works
2. Check logs for specific error messages
3. Try setting `PUPPETEER_EXECUTABLE_PATH` in `.env`

### Slow startup

The bot warms up a browser during startup, which can be slow. You can:
1. Wait 30 seconds for warmup to complete
2. Set `SKIP_BROWSER_WARMUP=true` in `.env` for faster startup (browser launches when needed)

### Chrome crashes immediately

This is often due to `--single-process` flag. The bot now automatically:
- Uses `--single-process` only in production (Railway)
- Disables it on Windows development
- Uses Windows-specific Chrome flags

## Getting Help

1. Check the error message carefully
2. Run `npm run test:puppeteer` to isolate Puppeteer issues
3. Check Windows Defender / antivirus logs
4. Open an issue with:
   - Full error message
   - Output of `npm run test:puppeteer`
   - Windows version
   - Node.js version (`node --version`)
