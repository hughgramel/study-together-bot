# Study Together Discord Bot - Project Description

## Overview

A Discord bot designed for collaborative productivity tracking with Strava-inspired social features. Team members track their study/work sessions in real-time, compete on leaderboards, and share accomplishments in a community feed. Built for motivation through friendly competition and social accountability.

---

## Core Concept

The bot transforms productivity tracking into a social, competitive experience. Users:
1. **Start sessions** with their activity/intention
2. **Track time** with pause/resume capability
3. **Complete sessions** with a summary of what they accomplished
4. **Share automatically** to a community feed (Strava-style embed)
5. **Compete** on daily, weekly, and monthly leaderboards
6. **Build streaks** to maintain consistency

---

## Current Features

### 1. Session Management

#### `/start {activity}`
- Creates a new productivity session
- Posts a **live notification** to the feed channel with green indicator 🟢
- Only one active session per user at a time
- Example: `/start activity: Learn React hooks and build a todo app`

#### `/time`
- Shows current session status (Active ⏸️ or Paused ▶️)
- Displays elapsed time (excluding paused periods)
- Shows activity name
- Lists available actions

#### `/pause` and `/resume`
- Pause sessions for breaks without losing progress
- Tracks total paused time separately
- Resume continues from where you left off
- Paused time is excluded from final duration

#### `/end {title} {description}`
- Completes the session and saves to database
- Posts a **beautiful Strava-style embed** to the feed channel
- Includes:
  - User avatar and name
  - Session title
  - Description of accomplishments
  - Total duration (formatted)
  - Activity type
  - ❤️ reaction for likes
  - Comment thread for discussion
- Updates user statistics and streaks

#### `/cancel`
- Discards active session without saving
- No stats updated, nothing posted to feed
- Clean slate to start fresh

---

### 2. Statistics Dashboard (`/mystats`)

Personal statistics view with four timeframes:
- **Daily** - Today's hours and rank
- **Weekly** - Last 7 days
- **Monthly** - Last 30 days
- **All-time** - Complete history

Each timeframe shows:
- Total hours worked
- Your current leaderboard rank (#1, #2, etc.)
- Monthly average hours per day
- **Current streak** (consecutive days with sessions) 🔥
- **Longest streak** (personal record) 💪

**Streak system:**
- 1-2 days: No fire
- 3-6 days: 🔥
- 7-29 days: 🔥🔥
- 30+ days: 🔥🔥🔥

---

### 3. Leaderboard System

#### `/leaderboard` - Quick Overview
- Shows **top 3** performers for each timeframe (daily/weekly/monthly)
- Displays your own position if not in top 3
- Medal emojis: 🥇 🥈 🥉
- Format: `🥇 **username** - 12.5h`

#### `/d` - Full Daily Leaderboard
- Top 10 performers today
- Always includes your position (even if outside top 10)
- Shows hours worked with 1 decimal precision
- Formatted as table: Rank | Name | Hours

#### `/w` - Full Weekly Leaderboard
- Same as `/d` but for past 7 days

#### `/m` - Full Monthly Leaderboard
- Same as `/d` but for past 30 days

**Note:** Leaderboards currently use fake data for testing (lines 702-836 in bot.ts). Real implementation will query Firebase aggregated stats.

---

### 4. Social Feed (Strava-Style)

When sessions complete or start, beautiful embeds post to the configured feed channel:

**Session Start Notification:**
- Green embed with 🟢 indicator
- "@username is live now working on **activity**!"
- Creates social pressure/motivation

**Session Completion Post:**
- Electric blue embed (#0080FF)
- User avatar and name
- Session title (bold)
- Description paragraph
- Duration and activity in inline fields
- Automatic ❤️ reaction
- Threaded comments section
- Format similar to Strava activity posts

---

### 5. Admin Configuration

#### `/setup-feed {#channel}`
- Administrator-only command
- Sets the channel where session posts appear
- Stores configuration per Discord server
- Confirmation message with channel mention

---

## Technical Architecture

### Stack
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js 18+
- **Framework:** Discord.js v14
- **Database:** Firebase Firestore
- **Deployment:** Railway (continuous deployment from GitHub)

### Project Structure
```
src/
├── bot.ts                 # Main entry point, 950 lines
│                          # - Command registration
│                          # - Interaction handlers
│                          # - Feed posting logic
│                          # - Error handling
├── services/
│   ├── sessions.ts       # Session CRUD operations
│   │                     # - Active session management
│   │                     # - Completed session storage
│   │                     # - Leaderboard aggregation
│   └── stats.ts          # User statistics service
│                         # - Streak calculation
│                         # - Ranking queries
└── utils/
    └── formatters.ts     # Duration/time formatting
                          # - "2h 34m 12s" formatting
                          # - Date comparisons
                          # - Timezone handling
```

### Database Schema (Firestore)

```
discord-data/
├── activeSessions/
│   └── sessions/
│       └── {userId}                    # Only one active session per user
│           ├── userId: string
│           ├── username: string
│           ├── serverId: string
│           ├── activity: string
│           ├── startTime: Timestamp
│           ├── isPaused: boolean
│           ├── pausedAt?: Timestamp
│           └── pausedDuration: number  # Seconds
│
├── sessions/
│   └── completed/
│       └── {sessionId}                 # Auto-generated ID
│           ├── userId: string
│           ├── username: string
│           ├── serverId: string
│           ├── activity: string
│           ├── title: string
│           ├── description: string
│           ├── duration: number        # Seconds (excludes paused time)
│           ├── startTime: Timestamp
│           ├── endTime: Timestamp
│           └── createdAt: Timestamp
│
├── userStats/
│   └── stats/
│       └── {userId}
│           ├── username: string
│           ├── totalSessions: number
│           ├── totalDuration: number   # Seconds
│           ├── currentStreak: number   # Days
│           ├── longestStreak: number   # Days
│           ├── lastSessionAt: Timestamp
│           └── firstSessionAt: Timestamp
│
└── serverConfig/
    └── configs/
        └── {serverId}
            ├── feedChannelId: string
            ├── setupAt: Timestamp
            └── setupBy: string
```

---

## User Experience Flow

### First-Time User
1. Admin runs `/setup-feed #study-feed` to configure channel
2. User runs `/start activity: Study calculus`
3. Feed shows "🟢 @user is live now working on **Study calculus**!"
4. User works for 45 minutes
5. User runs `/pause` to take break
6. User runs `/resume` after 10 minutes
7. User works for another hour
8. User runs `/end title: Calculus Session description: Completed chapter 3 and solved 15 practice problems`
9. Beautiful embed posts to feed with:
   - Total time: 1h 45m
   - Heart reaction ready for teammates to click
   - Comment thread for feedback
10. User runs `/mystats` to see their 1st session ever, 1-day streak 🔥

### Regular User Journey
1. Check `/leaderboard` to see standings
2. Start session to catch up to leader
3. Pause for lunch
4. Resume after break
5. Complete session with detailed summary
6. React ❤️ to teammates' posts
7. Comment on impressive sessions
8. Check `/d` daily leaderboard before bed
9. Build 7-day streak 🔥🔥
10. Aim for 30-day streak 🔥🔥🔥

---

## Design Philosophy

### 1. **Frictionless Tracking**
- Quick commands: `/start`, `/time`, `/end`
- No need to manually track time
- Automatic calculations and formatting

### 2. **Social Motivation**
- Public feed creates accountability
- Leaderboards spark friendly competition
- Comment threads build community
- Live status shows who's working now

### 3. **Gamification**
- Streak system encourages consistency
- Medal emojis (🥇🥈🥉) for top performers
- Fire emojis (🔥) scale with streaks
- Rankings provide clear goals

### 4. **Privacy-First**
- Most responses are ephemeral (user-only)
- Only completed sessions post publicly
- Users control what they share in descriptions
- Can `/cancel` without posting

### 5. **Mobile-Friendly**
- Short command names (`/d`, `/w`, `/m`)
- Works on Discord mobile app
- Embeds render beautifully on all devices

---

## Known Limitations & Technical Debt

### Critical
1. **Fake leaderboard data** (lines 702-836 in bot.ts)
   - Currently generates test data
   - Real implementation needs to query `getTopUsers()` from SessionService
   - Needs to aggregate across timeframes (daily/weekly/monthly)

### Minor
1. **Deprecation warning** for `ready` event
   - Discord.js v15 prefers `clientReady`
   - Low priority, still works

2. **No pagination** on leaderboards
   - Currently hard-capped at top 10
   - Could add "View More" button in future

3. **Streak calculation edge cases**
   - Assumes UTC date boundaries
   - Doesn't account for user timezones
   - Could miss streaks for late-night users

4. **No data export**
   - Users can't download their history
   - Future feature for GDPR compliance

---

## Deployment Status

### Production Environment
- **Platform:** Railway
- **Auto-deploy:** On push to `main` branch
- **Environment Variables:**
  - `DISCORD_BOT_TOKEN` - Bot authentication
  - `DISCORD_CLIENT_ID` - Application ID
  - `FIREBASE_PROJECT_ID` - Firebase project
  - `FIREBASE_SERVICE_ACCOUNT` - Full JSON credentials

### Monitoring
- Railway deployment logs
- Console logging for all commands (timestamp + user + command)
- Firebase Firestore console for data verification

---

## Ideas for Enhancement

### High Priority
1. **Real leaderboard implementation** - Replace fake data
2. **Timezone support** - Per-user timezone for streak accuracy
3. **Session categories/tags** - "Study", "Work", "Side Project", etc.
4. **Edit last session** - Fix typos in titles/descriptions
5. **Pomodoro mode** - Auto-pause after 25 minutes

### Medium Priority
6. **Team/group sessions** - Study together with friends
7. **Weekly summary DMs** - "You worked 15h this week! 📊"
8. **Goal setting** - "I want to hit 40h this month"
9. **Session templates** - Quick-start common activities
10. **Export data** - CSV/JSON download of all sessions

### Nice to Have
11. **XP/leveling system** - Earn XP for completing sessions
12. **Achievements** - "First 10h week", "30-day streak", etc.
13. **Mobile app** - Native iOS/Android with push notifications
14. **Session analytics** - Best productivity times, patterns
15. **Integration with real Strava** - Post workouts to feed too
16. **Calendar view** - Heat map of active days
17. **Anonymous mode** - Compete without showing identity
18. **Music integration** - "Studying to: Lofi Hip Hop"

---

## Discussion Points for Your Team

### 1. Real Leaderboard Implementation
- Should we implement this ASAP or keep fake data for testing?
- How should we handle ties (same hours)?
- Cache leaderboard data or compute on-demand?

### 2. Categories/Tags for Sessions
- Predefined list or free-text tags?
- Show category in feed embeds?
- Filter leaderboards by category?

### 3. Timezone Handling
- Ask users for timezone on first use?
- Auto-detect from Discord profile?
- Impact on streak calculations?

### 4. Privacy Controls
- Option to make stats private?
- Hide from leaderboards but keep tracking?
- Anonymous participation?

### 5. Pomodoro Integration
- Force 25-minute work / 5-minute break intervals?
- Optional mode or always-on?
- Notifications when break is over?

### 6. Monetization (if applicable)
- Keep 100% free?
- Premium features (advanced analytics, longer history)?
- Server-level subscriptions?

### 7. Branding & Naming
- Current name: "Study Together Bot"
- Better name ideas?
- Logo/avatar design?
- Tagline: "Productivity tracking meets social competition"

### 8. Target Audience
- Students (current focus)?
- Remote teams?
- Freelancers?
- Study communities?
- All of the above?

### 9. Session Editing
- Allow editing titles/descriptions after posting?
- Edit button on feed embeds?
- Show "edited" indicator?

### 10. Anti-Cheating Measures
- Prevent artificially long sessions (8+ hours)?
- Detect AFK/idle time?
- Minimum session duration (5 minutes)?

---

## Success Metrics

### User Engagement
- **Daily Active Users (DAU)** - Users starting ≥1 session/day
- **Average session duration** - Sweet spot: 1-3 hours
- **Completion rate** - % of `/start` that result in `/end` (not `/cancel`)
- **Streak retention** - % of users maintaining 7+ day streaks

### Social Features
- **Feed reactions** - Average ❤️ per post
- **Comment activity** - % of posts with ≥1 comment
- **Leaderboard views** - `/d`, `/w`, `/m` command usage
- **Competitive motivation** - Correlation between rank and next-day usage

### Technical Health
- **Command latency** - Time from interaction to response
- **Error rate** - Failed commands / total commands
- **Uptime** - % of time bot is online
- **Database costs** - Firestore read/write volume

---

## Getting Started (New Team Members)

1. **Read this document** - Understand the concept
2. **Check README.md** - Setup instructions
3. **Review .claude/CLAUDE.md** - Development guidelines
4. **Run locally**:
   ```bash
   npm install
   npm run dev
   ```
5. **Test all commands** in your test Discord server
6. **Check Firebase console** to see data structure
7. **Review bot.ts** - Main command handlers
8. **Ask questions** in team chat

---

## Support & Contribution

### Reporting Issues
- Use GitHub Issues for bugs
- Include command used, expected vs actual behavior
- Attach screenshots of embeds if relevant

### Code Contributions
- Follow TypeScript strict mode
- Use ephemeral replies for user-only messages
- Add error handling to all async operations
- Update this document if adding features
- Test on multiple users before PR

### Code Style
- Prefer `async/await` over `.then()`
- Use descriptive variable names
- Keep functions under 50 lines when possible
- Comment complex logic

---

## License & Credits

**License:** ISC

**Built with:**
- Discord.js - Discord API wrapper
- Firebase Admin SDK - Cloud Firestore database
- TypeScript - Type-safe JavaScript
- Railway - Deployment platform

**Inspiration:**
- Strava - Social fitness tracking
- Toggl Track - Time tracking
- Forest App - Gamified productivity

---

## Contact

For questions, suggestions, or feedback about this project, please reach out to the development team or create an issue in the repository.

**Last Updated:** 2025-01-12
**Version:** 1.0.0
**Status:** ✅ Production-ready (with fake leaderboard data)
