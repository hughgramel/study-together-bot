# Analytics Dashboard - Quick Setup

## ✅ What's Already Done

- Firebase config is in `firebase-config.js` (gitignored)
- Firestore rules deployed (dashboard has read access)
- Dashboard HTML is ready to use

## 🚀 How to Use

### Option 1: Open Locally (Simplest)

1. Open `analytics-dashboard.html` in your browser
2. That's it! The dashboard will load your bot's data

### Option 2: Set Up for Team Members

If you want others to access the dashboard:

1. **Share these files:**
   - `analytics-dashboard.html`
   - `firebase-config.example.js`

2. **They need to:**
   ```bash
   # Copy the example config
   cp firebase-config.example.js firebase-config.js

   # Edit firebase-config.js and add the Firebase credentials
   # (Get from Firebase Console > Project Settings > Web App)

   # Open analytics-dashboard.html in browser
   ```

## 🔒 Security Note

- `firebase-config.js` is gitignored (contains API keys)
- Only add `firebase-config.example.js` to git (template)
- Firestore rules allow public read (dashboard access)
- Bot writes via service account (not affected by rules)

## 📊 What You'll See

- **Quick Stats:** Total users, active today, sessions, study hours
- **Charts:** DAU trends, level distribution, session analytics
- **Tables:** Top users, recent sessions, server activity
- **Controls:** Time range, filters, auto-refresh, export

## 🛠️ If Rules Need Updating

Current rules allow:
- ✅ Dashboard can READ all data in `discord-data/`
- ❌ Dashboard CANNOT write (bot-only)

To change:
```bash
# Edit firestore.rules
# Then deploy:
firebase deploy --only firestore:rules
```

## 📝 Files

```
analytics-dashboard.html          # Main dashboard (open in browser)
firebase-config.js                # Your credentials (gitignored)
firebase-config.example.js        # Template for others (committed)
firestore.rules                   # Security rules (already deployed)
```

That's it! Open `analytics-dashboard.html` and enjoy your analytics! 📊
