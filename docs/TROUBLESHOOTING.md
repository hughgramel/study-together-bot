# Troubleshooting Guide

Common issues and solutions for the Study Together Discord bot.

## Table of Contents

- [Puppeteer Issues](#puppeteer-issues)
- [Windows-Specific Issues](#windows-specific-issues)
- [Firebase Issues](#firebase-issues)
- [Discord Bot Issues](#discord-bot-issues)
- [Performance Issues](#performance-issues)

## Puppeteer Issues

### Chrome Not Found Error

**Error**: `Could not find Chrome (ver. XXX). This can occur if...`

**Solutions**:

1. **Reinstall Puppeteer with Chrome**:
   ```bash
   npm uninstall puppeteer
   npm install puppeteer
   ```

2. **Use existing Chrome installation** (Windows):
   ```bash
   # Add to .env file
   PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
   ```

3. **Verify installation**:
   ```bash
   npm run test:puppeteer
   ```

### Browser Launch Timeout

**Error**: `TimeoutError: Waiting for the browser to disconnect timed out`

**Solutions**:

1. **Skip warmup during development**:
   ```bash
   # Add to .env
   SKIP_BROWSER_WARMUP=true
   ```
   The browser will launch on-demand when needed instead of during startup.

2. **Check system resources**:
   - Close other Chrome/Chromium instances
   - Free up RAM (Puppeteer needs ~200-500MB per browser)
   - Check CPU usage

3. **Increase timeout** (if needed):
   Edit `src/services/browserPool.ts` and increase timeout from 30000 to 60000

### Browser Crashes Immediately

**Error**: Browser launches but crashes right away

**Common causes**:
- `--single-process` flag (Windows incompatibility)
- Insufficient RAM
- Antivirus blocking

**Solutions**:

1. **Verify platform detection**:
   The bot should automatically detect Windows and adjust flags. Check logs for:
   ```
   [BrowserPool] Launching browser on win32 (development)
   ```

2. **Check antivirus**:
   - Add Node.js to antivirus exceptions
   - Add Chrome executable to exceptions
   - Temporarily disable to test

3. **Free up resources**:
   - Close other applications
   - Ensure 2GB+ free RAM

## Windows-Specific Issues

### Permission Denied Errors

**Error**: `Error: spawn EACCES` or similar

**Solutions**:

1. **Run as Administrator**:
   - Right-click Command Prompt or PowerShell
   - Select "Run as administrator"
   - Navigate to project directory
   - Run `npm run dev`

2. **Check Windows Defender**:
   - Open Windows Security
   - Virus & threat protection → Manage settings
   - Add exclusions for:
     - Project directory
     - `node_modules/puppeteer`
     - Chrome executable

3. **Verify file permissions**:
   ```powershell
   # Check if you have write access
   New-Item -Path . -Name "test.txt" -ItemType "file"
   Remove-Item "test.txt"
   ```

### Path Issues

**Error**: Cannot find modules or files

**Solutions**:

1. **Use forward slashes** in `.env`:
   ```bash
   # Good
   PUPPETEER_EXECUTABLE_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe

   # Also works with escaped backslashes
   PUPPETEER_EXECUTABLE_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
   ```

2. **Check PATH environment variable**:
   ```powershell
   $env:PATH -split ';'
   ```
   Ensure Node.js is in PATH

### Build Tools Required

**Error**: `node-gyp` errors or "Python not found"

**Solutions**:

1. **Install Windows Build Tools**:
   ```bash
   npm install --global windows-build-tools
   ```

2. **Or install Visual Studio Build Tools**:
   - Download from https://visualstudio.microsoft.com/downloads/
   - Select "Desktop development with C++"
   - Reboot after installation

## Firebase Issues

### Authentication Failed

**Error**: `Error: Could not load the default credentials`

**Solutions**:

1. **Check service account file**:
   ```bash
   # Verify file exists
   ls firebase-service-account.json
   ```

2. **Validate JSON format**:
   ```bash
   node -e "console.log(JSON.parse(require('fs').readFileSync('firebase-service-account.json', 'utf8')))"
   ```

3. **Check environment variables**:
   ```bash
   # For production (Railway), verify FIREBASE_SERVICE_ACCOUNT is set
   # Should be entire JSON as a string
   ```

### Permission Denied

**Error**: `Missing or insufficient permissions`

**Solutions**:

1. **Update Firestore rules**:
   - Go to Firebase Console
   - Firestore Database → Rules
   - Ensure service account has admin access

2. **Check service account role**:
   - Firebase Console → Project Settings → Service Accounts
   - Role should be "Firebase Admin SDK Administrator Service Agent"

## Discord Bot Issues

### Bot Not Responding

**Checklist**:

1. **Bot is online**:
   - Check Discord server
   - Bot should have green status

2. **Commands registered**:
   ```bash
   # Commands auto-register on startup
   # Or manually register:
   npm run register-commands
   ```

3. **Bot has permissions**:
   - Applications Commands scope
   - Send Messages
   - Embed Links
   - Attach Files

4. **Check logs**:
   ```bash
   npm run dev
   # Look for errors in console
   ```

### Commands Not Showing

**Problem**: Slash commands don't appear in Discord

**Solutions**:

1. **Wait for propagation** (up to 1 hour for global commands)

2. **Use guild-specific registration** for development:
   ```bash
   # Add to .env
   GUILD_ID=your_server_id_here
   ```

3. **Restart Discord client**:
   - Close Discord completely
   - Clear Discord cache (Ctrl+Shift+R)
   - Reopen Discord

### Images Not Generating

**Problem**: Commands work but images don't appear

**Solutions**:

1. **Test Puppeteer**:
   ```bash
   npm run test:puppeteer
   ```

2. **Check browser pool logs**:
   Look for errors like:
   ```
   [BrowserPool] Browser warmup failed: ...
   ```

3. **Skip warmup and try on-demand**:
   ```bash
   # Add to .env
   SKIP_BROWSER_WARMUP=true
   ```

4. **Check file permissions**:
   Bot needs write access to temp directory

## Performance Issues

### Slow Startup

**Problem**: Bot takes 30+ seconds to start

**Causes**:
- Browser warmup
- Slow internet (downloading Chrome)
- Low RAM

**Solutions**:

1. **Skip browser warmup**:
   ```bash
   # Add to .env
   SKIP_BROWSER_WARMUP=true
   ```

2. **Pre-download Chrome**:
   ```bash
   # Puppeteer downloads Chrome on first install
   npm install puppeteer
   ```

3. **Use local Chrome** (Windows):
   ```bash
   # Add to .env
   PUPPETEER_EXECUTABLE_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
   ```

### High Memory Usage

**Problem**: Bot uses 500MB+ RAM

**Causes**:
- Browser instance (~200-400MB)
- Discord client
- Multiple sessions

**Solutions**:

1. **Normal behavior**: 300-600MB is typical
   - Puppeteer browser: ~200-400MB
   - Node.js: ~100-200MB

2. **If excessive (1GB+)**:
   - Restart bot
   - Check for browser memory leaks
   - Monitor with: `node --inspect src/bot.ts`

3. **For low-RAM systems**:
   - Use `SKIP_BROWSER_WARMUP=true`
   - Close unused applications
   - Increase system swap/pagefile

### Slow Image Generation

**Problem**: Images take 5+ seconds to generate

**Solutions**:

1. **Normal on first use**: Browser needs to warm up

2. **Persistent slowness**:
   - Check CPU usage
   - Close other browsers
   - Ensure SSD (not HDD) for faster rendering

3. **Windows specific**:
   - Disable real-time antivirus scanning for project folder
   - Check Windows Defender isn't scanning every file access

## Getting More Help

If your issue isn't listed here:

1. **Run diagnostics**:
   ```bash
   npm run test:puppeteer
   node --version
   npm --version
   ```

2. **Check logs carefully**:
   - Error messages
   - Stack traces
   - Warning messages

3. **Search existing issues**:
   - Check project issues on GitHub
   - Search Discord.js documentation

4. **Create a detailed issue report**:
   - Operating system and version
   - Node.js version
   - Full error message
   - Steps to reproduce
   - What you've already tried

## Platform-Specific Guides

- **Windows**: See [WINDOWS_SETUP.md](../WINDOWS_SETUP.md)
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Database**: See [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)
