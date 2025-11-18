# Analytics Dashboard Setup Guide

## Overview

The `analytics-dashboard.html` file is a **single, self-contained HTML file** that provides a beautiful, real-time analytics dashboard for your Study Together Bot.

## Features

✅ **Beautiful Dark Theme** - Discord-like aesthetic with purple/blue accents
✅ **Real-time Data** - Connects directly to your Firebase Firestore
✅ **Interactive Charts** - Daily active users, level distribution, session analytics
✅ **Sortable Tables** - Top users, recent sessions, server activity
✅ **Export Capabilities** - CSV export and screenshot functionality
✅ **Auto-refresh** - Optional auto-refresh every 30s, 1m, or 5m
✅ **Responsive Design** - Works on desktop and mobile
✅ **No Dependencies** - All libraries loaded from CDN

## Quick Start (2 Minutes)

### Step 1: Get Your Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → **Project Settings**
4. Scroll down to "Your apps" section
5. If you don't have a web app, click **"Add app"** → Web
6. Copy the `firebaseConfig` object

It should look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAbc123...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 2: Update the Dashboard

1. Open `analytics-dashboard.html` in a text editor
2. Find line ~560 (search for `YOUR_API_KEY_HERE`)
3. Replace the placeholder config with your actual Firebase config:

```javascript
// BEFORE (line ~560):
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// AFTER (with your actual credentials):
const firebaseConfig = {
    apiKey: "AIzaSyAbc123...",
    authDomain: "my-bot.firebaseapp.com",
    projectId: "my-bot-project",
    storageBucket: "my-bot.appspot.com",
    messagingSenderId: "987654321",
    appId: "1:987654321:web:xyz789"
};
```

4. Save the file

### Step 3: Set Firestore Security Rules

1. Go to Firebase Console → **Firestore Database** → **Rules**
2. Add read access for the dashboard:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /discord-data/{document=**} {
      allow read: if true;  // Dashboard can read all data
      allow write: if false; // Dashboard cannot write
    }
  }
}
```

3. Click **Publish**

**⚠️ Security Note:** This allows anyone with the dashboard URL to view your bot's data. For production, see the "Add Password Protection" section below.

### Step 4: Open the Dashboard

1. Double-click `analytics-dashboard.html`
2. It will open in your default browser
3. The dashboard will load your bot's data automatically!

**That's it!** You should now see:
- Total users, active today, sessions, study hours
- Daily active users chart (last 30 days)
- Level distribution chart
- Session duration histogram
- Streak distribution
- Top achievements
- Top users table
- Recent sessions table
- Server activity table

## Dashboard Sections Explained

### Quick Stats Banner
- **Total Users**: All users who have ever used the bot
- **Active Today**: Users who completed a session today
- **Total Sessions**: All completed sessions
- **Total Study Hours**: Sum of all session durations

### Charts
1. **Daily Active Users** - Shows engagement trends over 30 days
2. **User Level Distribution** - How many users at each level range (1-10, 11-20, etc.)
3. **Session Duration Distribution** - How long are typical sessions?
4. **User Streak Distribution** - How many users have 0, 1-3, 4-7 day streaks, etc.
5. **Top 10 Achievements** - Most unlocked achievements

### Tables
1. **Top Users** - Top 50 users sorted by XP (click column headers to sort)
2. **Recent Sessions** - Last 50 completed sessions
3. **Server Activity** - Stats per Discord server

## Controls

### Time Range Selector
Change how far back to look for data:
- **Last 7 Days** - Recent activity only
- **Last 30 Days** - Default, good balance
- **Last 90 Days** - Quarter view
- **All Time** - Everything (may be slow with lots of data)

### Server Filter
Filter data to show only one Discord server (dropdown populated automatically)

### User Search
Type a user ID to filter the users table

### Auto Refresh
Enable automatic data refresh:
- **Off** - Manual refresh only (click 🔄 Refresh button)
- **Every 30 seconds** - Very frequent (use for live monitoring)
- **Every 1 minute** - Balanced
- **Every 5 minutes** - Light refresh

### Export Options
- **📥 Export CSV** - Download users table as CSV
- **📸 Screenshot** - Capture dashboard as PNG image

### Theme Toggle
Switch between dark mode (default) and light mode

## Optional Features

### Add Password Protection

To prevent unauthorized access, uncomment lines ~550-556 in the HTML file:

```javascript
// Find this section (around line 550):
// Optional: Password protection
// Uncomment to enable simple password prompt

const PASSWORD = "your-secure-password";
const enteredPassword = prompt("Enter dashboard password:");
if (enteredPassword !== PASSWORD) {
    document.body.innerHTML = "<h1 style='text-align: center; margin-top: 2rem;'>Access Denied</h1>";
    throw new Error("Invalid password");
}
```

**Remove the comment markers** (`//`) to enable:

```javascript
const PASSWORD = "MySecurePassword123";
const enteredPassword = prompt("Enter dashboard password:");
if (enteredPassword !== PASSWORD) {
    document.body.innerHTML = "<h1 style='text-align: center; margin-top: 2rem;'>Access Denied</h1>";
    throw new Error("Invalid password");
}
```

Now the dashboard will prompt for a password when opened.

**⚠️ Security Note:** This is basic protection. For production, use Firebase Authentication or host behind a login system.

## Troubleshooting

### Dashboard shows "Configuration Error"

**Problem:** Firebase credentials not configured or incorrect

**Solution:**
1. Check that you replaced ALL placeholders in `firebaseConfig`
2. Verify the config is copied exactly from Firebase Console
3. Make sure there are no typos in the config object

### Dashboard shows "Failed to load data"

**Problem:** Firestore security rules blocking access

**Solution:**
1. Go to Firebase Console → Firestore Database → Rules
2. Add read permission: `allow read: if true;`
3. Click Publish
4. Wait 1 minute for rules to propagate
5. Refresh the dashboard

### No data appears (blank charts/tables)

**Problem:** Your database might not have data yet

**Solution:**
1. Use your Discord bot to create some sessions
2. Check Firebase Console → Firestore Database to verify data exists
3. Refresh the dashboard

### "Firebase initialization error" in browser console

**Problem:** Invalid Firebase config

**Solution:**
1. Open browser developer tools (F12)
2. Check the Console tab for the exact error
3. Common issues:
   - Missing `projectId`
   - Incorrect `apiKey`
   - Firebase project doesn't exist

### Charts not rendering

**Problem:** CDN libraries not loading

**Solution:**
1. Check your internet connection
2. Open browser dev tools → Network tab
3. Look for failed requests to `cdn.jsdelivr.net` or `gstatic.com`
4. Try a different browser

## Performance Tips

### For Large Databases (1,000+ users)

The dashboard loads all user stats and recent sessions. For large datasets:

1. **Limit sessions query** - Edit line ~629 to reduce limit:
   ```javascript
   const snapshot = await query.limit(500).get(); // Change 500 to 100
   ```

2. **Paginate users table** - Only show top 50 by default (already implemented)

3. **Use shorter time ranges** - Select "Last 7 Days" instead of "All Time"

4. **Disable auto-refresh** - Manual refresh only for large datasets

### Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ❌ Internet Explorer (not supported)

## Advanced Customization

### Change Theme Colors

Edit the CSS variables (line ~75):

```css
:root {
    --accent-purple: #7b68ee;  /* Change primary color */
    --accent-blue: #0080ff;    /* Change secondary color */
    --accent-green: #00ff80;   /* Change success color */
}
```

### Add More Charts

The dashboard uses Chart.js. To add custom charts:

1. Add a new `<canvas>` element in the HTML
2. Create a render function (follow pattern of `renderDAUChart()`)
3. Call it from `updateDashboard()`

### Export Different Data

To export achievements or servers:

1. Create a new function like `exportAchievements()`
2. Format data as CSV (follow `exportUsers()` pattern)
3. Add a button to trigger the export

## Hosting the Dashboard

### Option 1: Local File (Current Setup)
- Just open the HTML file in a browser
- Pros: Simple, no hosting needed
- Cons: Only accessible on your computer

### Option 2: Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run: `firebase init hosting`
3. Copy `analytics-dashboard.html` to `public/index.html`
4. Run: `firebase deploy --only hosting`
5. Access at: `https://your-project.firebaseapp.com`

### Option 3: GitHub Pages
1. Create a new repo
2. Upload `analytics-dashboard.html` as `index.html`
3. Go to Settings → Pages
4. Enable GitHub Pages on `main` branch
5. Access at: `https://yourusername.github.io/repo-name`

### Option 4: Netlify/Vercel
1. Drag and drop the HTML file to Netlify/Vercel
2. Get instant URL
3. Free and fast

## Data Privacy

The dashboard displays:
- ✅ User IDs (Discord snowflake IDs)
- ✅ Session durations and dates
- ✅ XP, levels, streaks
- ✅ Achievement unlocks

The dashboard does NOT display:
- ❌ Usernames (only IDs)
- ❌ Session descriptions (what users studied)
- ❌ Message content
- ❌ Personal information

**For public dashboards:**
- Consider masking user IDs (show last 4 digits only)
- Add password protection
- Use Firebase Authentication

## Next Steps

1. ✅ Set up the dashboard (you're here!)
2. 📊 Monitor your bot's growth
3. 🎯 Identify which features are most used
4. 🚀 Use insights to improve your bot
5. 📈 Share growth metrics with your community

## Support

Having issues? Check:
1. Browser console (F12) for errors
2. Firebase Console → Firestore Database to verify data exists
3. Firestore Rules to ensure read access is enabled

For more help, see the main README or open an issue on GitHub.

---

**Enjoy your analytics dashboard!** 📊
