# Commands Reference

Complete reference of all available commands in Study Together bot, organized by category.

## Quick Reference

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/start` | Start a new productivity session | All users |
| `/stop` | Complete your session and post to feed | All users |
| `/time` | Check current session status | All users |
| `/stats` | View your statistics | All users |
| `/me` | View your profile overview | All users |
| `/leaderboard` | View server leaderboards | All users |
| `/group` | View group overview | All users |
| `/creategroup` | Create a new study group | All users |
| `/setup-feed` | Configure feed channel | Administrator |

---

## Session Management

### `/start`

Start a new productivity session with a description of what you're working on.

**Syntax:**
```
/start activity: <description>
```

**Parameters:**
- `activity` (required) - What you're working on (e.g., "Study React hooks", "Math homework")

**Examples:**
```
/start activity: Learning Discord.js and building a bot
/start activity: Chemistry lab report
/start activity: Practicing piano
```

**Response:**
- Ephemeral (only you see it)
- Confirmation message with session start time
- Session start card image showing activity and time

**Notes:**
- Only one active session per user
- If you already have an active session, you'll receive an error
- Use `/cancel` to discard and start a new one
- Session timer includes paused time tracking

**Intensity (Optional):**
In future updates, you may be able to set session intensity (1-5) for XP bonuses.

---

### `/stop`

Complete your active session, add a title and description, then post it to the feed.

**Syntax:**
```
/stop
```

**Parameters:**
- Opens a modal with:
  - `title` (required) - Short title for your session
  - `description` (required) - What you accomplished

**Examples:**
```
(After running /stop, modal appears)
Title: Built Discord Bot
Description: Successfully implemented session tracking and Firebase integration. Added leaderboard commands and tested deployment.
```

**Response:**
- Ephemeral confirmation: "Session completed! Posted to feed."
- Public post in configured feed channel with:
  - Session duration
  - XP gained
  - Level progress
  - Achievement unlocks (if any)
  - React button for kudos
  - Comment thread for discussion

**What happens:**
1. Session duration calculated (minus paused time)
2. XP calculated based on duration, intensity, and group bonus
3. User stats updated (total sessions, duration, streaks, XP)
4. Achievements checked and unlocked if eligible
5. Group stats updated if in a group
6. Post created in feed channel
7. Level up card posted if you leveled up

**Notes:**
- Must have an active session to use this command
- Minimum session duration: 1 minute
- Maximum title length: 100 characters
- Maximum description length: 500 characters

---

### `/pause`

Pause your active session to take a break without ending it.

**Syntax:**
```
/pause
```

**Parameters:** None

**Examples:**
```
/pause
```

**Response:**
- Ephemeral: "Session paused at [time]. Use /unpause to continue."

**Notes:**
- Paused time is NOT counted toward session duration
- Session must be active and not already paused
- You can `/unpause` to resume or `/stop` to end while paused
- Paused time is tracked and displayed in `/time`

---

### `/unpause`

Resume a paused session.

**Syntax:**
```
/unpause
```

**Parameters:** None

**Examples:**
```
/unpause
```

**Response:**
- Ephemeral: "Session resumed! Keep it up."

**Notes:**
- Session must be paused to use this command
- Timer resumes from where it was paused
- All paused time is excluded from final duration

---

### `/time`

Check your current session status and elapsed time.

**Syntax:**
```
/time
```

**Parameters:** None

**Examples:**
```
/time
```

**Response:**
- Ephemeral message showing:
  - Session activity
  - Elapsed time (excluding paused duration)
  - Paused duration (if applicable)
  - Current status (active/paused)
  - Estimated XP if completed now

**Example output:**
```
📊 Current Session Status

Activity: Learning TypeScript
Status: Active
Started: 2:30 PM (45 minutes ago)
Elapsed: 45m 12s
Paused: 5m 0s

Estimated XP: ~7.5 XP
```

**Notes:**
- Must have an active session
- Updates in real-time
- Shows projected XP based on current duration

---

### `/cancel`

Discard your active session without saving it.

**Syntax:**
```
/cancel
```

**Parameters:** None

**Examples:**
```
/cancel
```

**Response:**
- Ephemeral: "Session cancelled."

**Notes:**
- Permanently deletes the session
- No XP, stats, or feed post
- Cannot be undone
- Use if you started a session by mistake or want to restart

---

### `/manual`

Log a manual session with custom duration (for sessions completed outside Discord).

**Syntax:**
```
/manual
```

**Parameters:**
- Opens a modal with:
  - `activity` - What you worked on
  - `title` - Session title
  - `description` - What you accomplished
  - `duration` - Duration in format: "2h 30m" or "90m"

**Examples:**
```
(After running /manual, modal appears)
Activity: Studied at library
Title: Deep Work Session
Description: Completed 3 chapters of calculus textbook
Duration: 2h 15m
```

**Response:**
- Same as `/stop` - creates feed post, awards XP, updates stats

**Notes:**
- Use for sessions tracked outside Discord
- Maximum duration: 12 hours (to prevent abuse)
- Awards same XP as regular sessions
- Does not check for active sessions

---

## Statistics & Profiles

### `/stats`

View your detailed productivity statistics with visual charts.

**Syntax:**
```
/stats [timeframe]
```

**Parameters:**
- `timeframe` (optional) - daily, weekly, monthly, yearly, all
  - Default: weekly

**Examples:**
```
/stats
/stats timeframe: monthly
/stats timeframe: all
```

**Response:**
- Public message (visible to all) with generated image showing:
  - Total sessions and hours for selected timeframe
  - XP earned in timeframe
  - Level and progress to next level
  - Current streak
  - Chart showing daily breakdown
  - Interactive dropdown to change timeframe

**What you'll see:**
- Bar chart of sessions per day/week/month
- Total hours studied
- XP gained
- Streak information
- Level progress bar

**Notes:**
- First generation may take 3-5 seconds (image rendering)
- Subsequent calls are faster (~500ms)
- Use dropdown to switch timeframes without re-running command
- Images are generated dynamically (not cached)

---

### `/me`

View your profile overview with all stats and achievements.

**Syntax:**
```
/me
```

**Parameters:** None

**Examples:**
```
/me
```

**Response:**
- Public message with generated profile card showing:
  - Username and avatar
  - Level and XP progress
  - Total sessions and hours
  - Current streak and longest streak
  - Recent achievements unlocked
  - Group membership (if in a group)
  - Top activities

**Example profile card:**
```
╔════════════════════════════════════╗
║  @YourUsername                     ║
║  Level 12  (1,245 / 1,500 XP)     ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░  83%           ║
║                                    ║
║  📊 42 sessions • 87.5h total     ║
║  🔥 12 day streak (best: 15)      ║
║  👥 Member of Study Warriors       ║
║                                    ║
║  🏆 Recent Achievements:           ║
║  • Centurion (100 hours)          ║
║  • Weekend Warrior                ║
╚════════════════════════════════════╝
```

**Notes:**
- Shows comprehensive profile at a glance
- Use `/profile @user` to view another user's profile
- Automatically updates with latest data

---

### `/profile`

View another user's profile.

**Syntax:**
```
/profile [user]
```

**Parameters:**
- `user` (optional) - Discord user to view
  - Default: yourself (same as `/me`)

**Examples:**
```
/profile user: @friend
/profile
```

**Response:**
- Same format as `/me` but for the specified user
- Shows all public stats and achievements

**Notes:**
- Anyone can view anyone's profile
- Good for comparing stats or checking on study buddies

---

### `/achievements`

View all your unlocked achievements.

**Syntax:**
```
/achievements
```

**Parameters:** None

**Examples:**
```
/achievements
```

**Response:**
- Public message listing all unlocked achievements:
  - Achievement name and emoji
  - Description
  - Unlock date
  - XP reward earned
  - Rarity tier (Common, Rare, Epic, Legendary)

**Example output:**
```
🏆 Your Achievements (12/50)

✅ First Steps (Common)
   Complete your first session
   +50 XP • Unlocked Jan 15

✅ Getting Started (Common)
   Study for 10 hours total
   +50 XP • Unlocked Jan 20

✅ Centurion (Rare)
   Study for 100 hours total
   +200 XP • Unlocked Feb 10

... (shows all unlocked)

🔒 Locked Achievements: 38
Use /help achievements for full list
```

**Notes:**
- Shows both unlocked and locked achievements
- Sorted by unlock date (most recent first)
- Click on achievement for details

---

### `/leaderboard`

View server leaderboards with interactive timeframe selector.

**Syntax:**
```
/leaderboard [timeframe]
```

**Parameters:**
- `timeframe` (optional) - daily, weekly, monthly, all
  - Default: daily

**Examples:**
```
/leaderboard
/leaderboard timeframe: weekly
/leaderboard timeframe: all
```

**Response:**
- Public message with generated leaderboard image showing:
  - Top 10 users by XP for selected timeframe
  - Rank, username, XP, level, hours studied
  - Your rank highlighted (if in top 10)
  - Interactive dropdown to change timeframe

**Example leaderboard:**
```
🏆 Daily Leaderboard

 #1  @TopUser       250 XP  Lv 15  8.5h
 #2  @StudyKing     180 XP  Lv 12  6.0h
 #3  @Learner       150 XP  Lv 10  5.0h
 #4  @You ⭐        120 XP  Lv 8   4.0h
 ...
#10  @Student        50 XP  Lv 5   1.5h

Your Rank: #4
```

**Notes:**
- Only shows users from current Discord server
- Leaderboard updates in real-time
- Use dropdown to switch timeframes
- "All-time" shows total XP earned ever

---

### `/live`

See who is currently studying in this server.

**Syntax:**
```
/live
```

**Parameters:** None

**Examples:**
```
/live
```

**Response:**
- Public message listing all users with active sessions:
  - Username
  - Current activity
  - Session duration so far
  - Paused status (if paused)

**Example output:**
```
📚 Currently Studying (5 users)

@Alice - 2h 15m
  Learning React hooks

@Bob - 45m (paused)
  Math homework

@Charlie - 1h 30m
  Reading research papers

@David - 20m
  Python tutorial

@Eve - 3h 5m
  Writing essay

Total: 7h 55m of active study time right now!
```

**Notes:**
- Sorted by duration (longest first)
- Shows paused sessions separately
- Updates in real-time
- Great for finding study buddies

---

### `/graph`

View your stats as a visual graph (alternative to `/stats`).

**Syntax:**
```
/graph
```

**Parameters:** None

**Examples:**
```
/graph
```

**Response:**
- Public message with chart visualization:
  - Line graph of study hours over time
  - Bar chart of sessions per day
  - XP progression curve

**Notes:**
- More visual than `/stats`
- Good for seeing trends over time
- Use `/stats` for detailed numbers

---

## Study Groups

### `/creategroup`

Create a new study group with up to 5 members.

**Syntax:**
```
/creategroup name: <group_name> [public]
```

**Parameters:**
- `name` (required) - Group name (max 50 characters)
- `public` (optional) - Whether group appears in `/findgroups`
  - Default: false (private)

**Examples:**
```
/creategroup name: Study Warriors
/creategroup name: CS Study Group public: true
/creategroup name: Private Study Squad public: false
```

**Response:**
- Ephemeral message:
```
✅ Group Created!

Name: Study Warriors
Group ID: GP-A1B2
Members: 1/5
Public: Yes

Share this command for others to join:
/joingroup group_id: GP-A1B2
```

**What happens:**
1. Group created in Firebase
2. You become the owner
3. Group ID generated (e.g., "GP-A1B2")
4. Group starts at Level 1 with 0 XP

**Notes:**
- You can only be in ONE group at a time
- Leave current group before creating a new one
- Group owner has special permissions (delete group, etc.)
- Public groups appear in `/findgroups`
- Private groups require group ID to join

**Group Benefits:**
- 1% XP bonus per group level (max 50%)
- Collaborative leaderboards
- Shared progress tracking
- Social motivation

---

### `/joingroup`

Join a public or private group using its group ID.

**Syntax:**
```
/joingroup group_id: <group_id>
```

**Parameters:**
- `group_id` (required) - Group ID (e.g., "GP-A1B2")

**Examples:**
```
/joingroup group_id: GP-A1B2
/joingroup group_id: GP-XYZ9
```

**Response:**
- Ephemeral: "✅ Joined Study Warriors! You'll now earn +5% XP bonus (Group Lv 5)"

**Error cases:**
- Group full (5/5 members)
- Group doesn't exist
- Already in a group
- Invalid group ID format

**Notes:**
- Must leave current group first
- Public groups appear in `/findgroups`
- Private groups require sharing the ID
- Join bonus applies immediately to next session

---

### `/leavegroup`

Leave your current study group.

**Syntax:**
```
/leavegroup
```

**Parameters:** None

**Examples:**
```
/leavegroup
```

**Response:**
- Ephemeral: "✅ Left Study Warriors. You can join another group anytime."

**What happens:**
1. Your membership is removed
2. Group XP and stats remain (not lost)
3. You lose the group XP bonus
4. If you were the owner and last member, group is deleted
5. If you were the owner but others remain, oldest member becomes new owner

**Notes:**
- Cannot be undone
- Past sessions still show group membership at the time
- Can join another group immediately after leaving

---

### `/group`

View group overview with member stats and progress.

**Syntax:**
```
/group [user]
```

**Parameters:**
- `user` (optional) - View another user's group
  - Default: your own group

**Examples:**
```
/group
/group user: @friend
```

**Response:**
- Public message with generated group overview image:
  - Group name and level
  - Total XP and hours
  - XP bonus percentage
  - Member list with individual stats
  - Recent group activity
  - Progress to next level

**Example output:**
```
╔════════════════════════════════════╗
║  🎯 Study Warriors                 ║
║  Level 10 • +10% XP Bonus          ║
║  ████████████░░░ 75% to Lv 11     ║
║                                    ║
║  📊 Group Stats                    ║
║  • 2,450 Total XP                  ║
║  • 245 Total Hours                 ║
║  • 5/5 Members                     ║
║                                    ║
║  👥 Members                        ║
║  1️⃣ @Alice    Lv 15  120h  👑     ║
║  2️⃣ @Bob      Lv 12   80h         ║
║  3️⃣ @Charlie  Lv 10   45h         ║
║  4️⃣ @David    Lv 8    30h         ║
║  5️⃣ @Eve      Lv 6    20h         ║
╚════════════════════════════════════╝
```

**Notes:**
- Shows all-time group stats
- Members sorted by hours contributed
- Owner marked with crown emoji
- Shows individual contribution to group

---

### `/group_leaderboard`

View the top groups ranked by level.

**Syntax:**
```
/group_leaderboard
```

**Parameters:** None

**Examples:**
```
/group_leaderboard
```

**Response:**
- Public message with paginated group leaderboard:
  - Top 10 groups by level
  - Group name, level, XP, total hours, member count
  - Navigation buttons (Previous/Next)

**Example output:**
```
🏆 Group Leaderboard

 #1  Elite Scholars      Lv 25  12,500 XP  500h  5/5
 #2  Study Warriors      Lv 20   8,000 XP  400h  5/5
 #3  Knowledge Seekers   Lv 18   6,500 XP  350h  4/5
 #4  Brain Trust         Lv 15   4,500 XP  300h  5/5
 ...
#10  Study Buddies       Lv 10   2,000 XP  150h  3/5

Your Group: Study Warriors (#2)

[Previous] [Next]
```

**Notes:**
- Shows all groups across the server
- Pagination: 10 groups per page
- Use Previous/Next buttons to navigate
- Highlights your group if you're in one

---

### `/findgroups`

Browse public groups with available space.

**Syntax:**
```
/findgroups
```

**Parameters:** None

**Examples:**
```
/findgroups
```

**Response:**
- Public message with list of public groups that have space:
  - Group name and ID
  - Current members / max members
  - Group level and XP bonus
  - Join button

**Example output:**
```
📚 Public Groups (3 available)

╔════════════════════════════════════╗
║  Study Warriors (GP-A1B2)          ║
║  4/5 members • Level 10 (+10% XP)  ║
║  [Join Group]                      ║
╚════════════════════════════════════╝

╔════════════════════════════════════╗
║  CS Study Group (GP-XYZ9)          ║
║  2/5 members • Level 5 (+5% XP)    ║
║  [Join Group]                      ║
╚════════════════════════════════════╝

╔════════════════════════════════════╗
║  Math Tutoring (GP-M4TH)           ║
║  3/5 members • Level 8 (+8% XP)    ║
║  [Join Group]                      ║
╚════════════════════════════════════╝
```

**Notes:**
- Only shows public groups (not private)
- Only shows groups with available space
- Click "Join Group" button to join directly
- If already in a group, you'll see a warning

---

### `/groupadmin`

Group owner administration commands.

**Syntax:**
```
/groupadmin delete
```

**Subcommands:**
- `delete` - Delete your group permanently

**Examples:**
```
/groupadmin delete
```

**Response:**
- Confirmation prompt: "⚠️ Delete Study Warriors? This cannot be undone."
- Buttons: [Confirm Delete] [Cancel]

**What happens when deleted:**
1. All members are removed from group
2. Group data is deleted from Firebase
3. Past sessions still show group name (historical data preserved)
4. All members can join new groups

**Notes:**
- Only group owner can delete
- Cannot be undone
- Members are notified via DM (if possible)

---

## Goals & Challenges

### `/goal add`

Add a new goal to your daily goal list.

**Syntax:**
```
/goal add difficulty: <easy|medium|hard>
```

**Parameters:**
- `difficulty` (required) - Goal difficulty level
  - easy: +10 XP when completed
  - medium: +25 XP when completed
  - hard: +50 XP when completed

After running the command, a modal appears to enter the goal text.

**Examples:**
```
/goal add difficulty: medium
(Modal appears)
Goal: Complete 3 React exercises
```

**Response:**
- Ephemeral: "✅ Goal added! Complete it with `/goal complete`"

**Notes:**
- Goals are personal (not shared)
- Can have multiple active goals
- Goals reset at midnight (server timezone)

---

### `/goal list`

View all your active goals.

**Syntax:**
```
/goal list
```

**Parameters:** None

**Examples:**
```
/goal list
```

**Response:**
- Ephemeral list of all active goals:
```
📋 Your Goals (3)

1. Complete 3 React exercises (Medium) +25 XP
2. Study for 2 hours (Easy) +10 XP
3. Finish math homework (Hard) +50 XP

Use /goal complete to mark as done!
```

**Notes:**
- Shows difficulty and XP reward
- Numbered for easy reference

---

### `/goal complete`

Mark a goal as completed and earn XP.

**Syntax:**
```
/goal complete
```

**Parameters:**
- Select goal from dropdown menu

**Examples:**
```
/goal complete
(Dropdown appears with your goals)
Select: "Complete 3 React exercises"
```

**Response:**
- Ephemeral: "✅ Goal completed! +25 XP earned."

**What happens:**
1. Goal marked as completed
2. XP awarded based on difficulty
3. Goal removed from active list
4. Stats updated

**Notes:**
- Can complete goals in any order
- XP is added to your total immediately
- Completed goals are tracked in your stats

---

### `/goal delete`

Delete a goal without completing it.

**Syntax:**
```
/goal delete
```

**Parameters:**
- Select goal from dropdown menu

**Examples:**
```
/goal delete
(Dropdown appears with your goals)
Select: "Finish math homework"
```

**Response:**
- Ephemeral: "Goal deleted."

**Notes:**
- No XP awarded
- Use if goal is no longer relevant

---

## Events

### `/createevent`

Create a new study event (scheduled group study session).

**Syntax:**
```
/createevent
```

**Parameters:**
- Opens a modal with:
  - `title` (required) - Event name
  - `location` (required) - Where to meet
  - `date` (required) - Date (YYYY-MM-DD)
  - `time` (required) - Time (HH:MM in 24h format)
  - `duration` (optional) - Duration in minutes
  - `description` (optional) - Additional details

**Examples:**
```
/createevent
(Modal appears)
Title: Library Study Session
Location: Main Library, 3rd floor, table near windows
Date: 2025-02-15
Time: 14:00
Duration: 120
Description: Bring your laptops for collaborative coding
```

**Response:**
- Public post in events channel:
```
📅 Upcoming Event

Library Study Session
📍 Main Library, 3rd floor
🕐 Feb 15, 2025 at 2:00 PM
⏱️ Duration: 2 hours
👤 Host: @YourUsername

Bring your laptops for collaborative coding

[RSVP: Going] [RSVP: Maybe] [RSVP: Can't Go]

Attendees (0/∞)
```

**Notes:**
- Anyone in server can RSVP
- Event creator can cancel
- Reminders sent 1 hour before (future feature)
- Use server timezone from `/setup-timezone`

---

### `/events`

View all upcoming study events.

**Syntax:**
```
/events
```

**Parameters:** None

**Examples:**
```
/events
```

**Response:**
- Public list of upcoming events:
```
📅 Upcoming Events (3)

1. Library Study Session
   Feb 15 at 2:00 PM • @Alice
   5 attendees

2. Math Tutoring
   Feb 16 at 4:00 PM • @Bob
   3 attendees

3. Group Project Meeting
   Feb 18 at 10:00 AM • @Charlie
   8 attendees

Use /createevent to create your own!
```

**Notes:**
- Shows only future events
- Sorted by date (soonest first)
- Click event for details and RSVP

---

### `/myevents`

View events you have RSVP'd to.

**Syntax:**
```
/myevents
```

**Parameters:** None

**Examples:**
```
/myevents
```

**Response:**
- Ephemeral list of your RSVP'd events:
```
📅 Your Events (2)

✅ Library Study Session
   Feb 15 at 2:00 PM
   Status: Going

✅ Math Tutoring
   Feb 16 at 4:00 PM
   Status: Going
```

**Notes:**
- Only shows events you've RSVP'd to
- Use events channel to change RSVP

---

### `/cancelevent`

Cancel one of your created events.

**Syntax:**
```
/cancelevent event: <event_title>
```

**Parameters:**
- `event` (required) - Select from your created events

**Examples:**
```
/cancelevent event: Library Study Session
```

**Response:**
- Confirmation prompt: "⚠️ Cancel 'Library Study Session'? Attendees will be notified."
- Buttons: [Confirm] [Cancel]

**What happens:**
1. Event marked as cancelled
2. Attendees notified via DM
3. Event removed from upcoming list

**Notes:**
- Only event creator can cancel
- Cannot cancel events that already started

---

## Admin Commands

### `/setup-feed`

Configure the feed channel where completed sessions are posted.

**Syntax:**
```
/setup-feed channel: <#channel>
```

**Parameters:**
- `channel` (required) - Discord channel to use as feed

**Examples:**
```
/setup-feed channel: #study-feed
/setup-feed channel: #sessions
```

**Response:**
- Ephemeral: "✅ Feed channel set to #study-feed"

**Requirements:**
- User must have `ADMINISTRATOR` permission
- Bot must have Send Messages permission in selected channel

**Notes:**
- Only one feed channel per server
- All completed sessions post here
- Change channel by running command again

---

### `/set-welcome-channel`

Configure the welcome channel for new member messages.

**Syntax:**
```
/set-welcome-channel channel: <#channel>
```

**Parameters:**
- `channel` (required) - Discord channel for welcome messages

**Examples:**
```
/set-welcome-channel channel: #welcome
```

**Response:**
- Ephemeral: "✅ Welcome channel set to #welcome"

**Requirements:**
- User must have `ADMINISTRATOR` permission
- Bot must have Send Messages permission in selected channel

**Notes:**
- New members receive introduction message
- Explains how to use the bot

---

### `/setup-events-channel`

Configure the events channel for study event posts.

**Syntax:**
```
/setup-events-channel channel: <#channel>
```

**Parameters:**
- `channel` (required) - Discord channel for event posts

**Examples:**
```
/setup-events-channel channel: #events
```

**Response:**
- Ephemeral: "✅ Events channel set to #events"

**Requirements:**
- User must have `ADMINISTRATOR` permission
- Bot must have Send Messages permission in selected channel

**Notes:**
- All events created with `/createevent` post here

---

### `/setup-timezone`

Configure the server timezone for event scheduling.

**Syntax:**
```
/setup-timezone timezone: <IANA_timezone>
```

**Parameters:**
- `timezone` (required) - IANA timezone (e.g., "America/New_York")

**Examples:**
```
/setup-timezone timezone: America/New_York
/setup-timezone timezone: Europe/London
/setup-timezone timezone: America/Los_Angeles
```

**Response:**
- Ephemeral: "✅ Server timezone set to America/New_York (EST)"

**Requirements:**
- User must have `ADMINISTRATOR` permission

**Common Timezones:**
- `America/New_York` - Eastern Time (US)
- `America/Chicago` - Central Time (US)
- `America/Denver` - Mountain Time (US)
- `America/Los_Angeles` - Pacific Time (US)
- `Europe/London` - UK
- `Europe/Paris` - Central European Time
- `Asia/Tokyo` - Japan Standard Time

**Notes:**
- Used for event scheduling and daily resets
- Default: UTC if not set
- [Full list of timezones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

---

## Utility Commands

### `/help`

View all available commands and how to use them.

**Syntax:**
```
/help
```

**Parameters:** None

**Examples:**
```
/help
```

**Response:**
- Ephemeral message with command categories and links to documentation

**Notes:**
- Links to full documentation
- Shows available commands based on permissions

---

### `/ping`

Test bot responsiveness and latency.

**Syntax:**
```
/ping
```

**Parameters:** None

**Examples:**
```
/ping
```

**Response:**
- Ephemeral: "Pong! Bot is responsive. Latency: 45ms"

**Notes:**
- Useful for checking if bot is online
- Shows round-trip latency

---

## Testing Commands (Development Only)

These commands are for UI testing and mock-ups:

- `/testgroup` - View group overview with sample data
- `/testgroup5` - View group with 5 members
- `/testgroupleaderboard` - View group leaderboard mockup
- `/testfindgroups` - View findgroups UI mockup
- `/post` - Test feed post preview

**Note:** These should be removed before production deployment.

---

## Command Permissions Summary

| Permission Level | Commands |
|-----------------|----------|
| **All Users** | start, stop, pause, unpause, time, cancel, stats, me, profile, achievements, leaderboard, live, graph, group, creategroup, joingroup, leavegroup, group_leaderboard, findgroups, goal, createevent, events, myevents, help, ping, manual, post |
| **Administrator** | setup-feed, set-welcome-channel, setup-events-channel, setup-timezone |
| **Group Owner** | groupadmin delete |
| **Event Creator** | cancelevent |

---

## Tips & Best Practices

### Session Management
- Start sessions when you begin working, not after
- Use `/pause` for short breaks (< 30 min)
- Use `/stop` for actual completion with accomplishments
- Write meaningful titles and descriptions for feed posts

### Stats & Leaderboards
- Check `/stats` regularly to track progress
- Use `/leaderboard` for friendly competition
- View `/graph` to identify study patterns

### Groups
- Join groups with similar study schedules
- Stay in one group long-term for maximum XP bonus
- Public groups are great for finding new study partners

### Goals
- Set realistic daily goals
- Use difficulty levels appropriately:
  - Easy: Simple tasks (< 1 hour)
  - Medium: Moderate tasks (1-2 hours)
  - Hard: Challenging tasks (2+ hours)

### Events
- Create events in advance (at least 24 hours)
- Provide specific location details
- RSVP to events to show commitment

---

## Common Workflows

### Daily Study Session
```
1. /start activity: Morning study session
2. (Study for 2 hours)
3. /pause (15 min break)
4. /unpause
5. (Study for 1 more hour)
6. /stop
   Title: Productive morning
   Description: Completed 3 chapters of textbook
7. /stats (check progress)
```

### Joining a Study Group
```
1. /findgroups (browse available groups)
2. Click [Join Group] or /joingroup group_id: GP-A1B2
3. /group (view group stats)
4. Start earning group XP bonuses!
```

### Creating a Study Event
```
1. /createevent
   Title: Library Study Session
   Location: Main Library
   Date: Tomorrow
   Time: 2:00 PM
2. Share in server chat
3. /myevents (check your upcoming events)
```

---

## Need More Help?

- Check the [Setup Guide](./SETUP.md) for installation
- Read [Architecture](./ARCHITECTURE.md) to understand how it works
- View [API Documentation](./API.md) for technical details
- Join our support server (link in main README)
