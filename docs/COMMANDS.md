# Commands Reference

Complete reference for all commands in Study Together bot, organized by category.

## Quick Reference

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/start` | Start a new session | All users |
| `/stop` | Complete session and post to feed | All users |
| `/pause` | Pause your active session | All users |
| `/unpause` | Resume a paused session | All users |
| `/break` | Timed pause (auto-resumes) | All users |
| `/time` | Check current session status | All users |
| `/cancel` | Discard active session | All users |
| `/pomodoro` | Start a Pomodoro timer | All users |
| `/reduce-xp` | Remove XP from yourself | All users |
| `/reduce-time` | Remove time from yourself | All users |
| `/manual` | Log a session manually | All users |
| `/stats` | View your statistics | All users |
| `/me` | View your profile overview | All users |
| `/profile` | View another user's profile | All users |
| `/achievements` | View your achievements | All users |
| `/leaderboard` | View server leaderboards | All users |
| `/live` | See who's studying now | All users |
| `/graph` | View stats as a chart | All users |
| `/history` | View XP/hours across all reset periods | All users |
| `/lightmode` | Toggle light mode for images | All users |
| `/studyping` | Ping a restricted role | All users |
| `/help` | Show command list | All users |
| `/manual` | Log a session done outside Discord | All users |
| `/creategroup` | Create a study group | All users |
| `/joingroup` | Join a group by ID | All users |
| `/joinrandom` | Join a random public group | All users |
| `/leavegroup` | Leave your current group | All users |
| `/invitegroup` | Invite someone to your group | Group member |
| `/group` | View group overview | All users |
| `/group_leaderboard` | Top groups ranked by level | All users |
| `/findgroups` | Browse public groups | All users |
| `/groupadmin` | Delete your group | Group owner |
| `/groupsettings` | Edit group settings | Group owner |
| `/groupdescription` | Set group description | Group owner |
| `/renamegroup` | Rename your group | Group owner |
| `/goal` | Add / list / complete / delete goals | All users |
| `/createevent` | Create a study event | All users |
| `/events` | View upcoming events | All users |
| `/myevents` | View your RSVP'd events | All users |
| `/cancelevent` | Cancel one of your events | Event creator |
| `/setup-feed` | Set the session feed channel | Administrator |
| `/set-welcome-channel` | Set the welcome channel | Administrator |
| `/setup-events-channel` | Set the events channel | Administrator |
| `/setup-goal-channel` | Set the goal parsing channel | Administrator |
| `/setup-timezone` | Set server timezone | Administrator |
| `/setup-level-roles` | Configure tier role thresholds | Administrator |
| `/setup-start-here` | Post onboarding guide | Administrator |
| `/setup-reaction-role` | Configure reaction-based roles | Administrator |
| `/setup-san-roles` | Configure san-level XP roles | Administrator |
| `/setup-role-restriction` | Restrict role pings to a channel | Administrator |
| `/sync-roles` | Sync level roles to all members | Administrator |
| `/analytics` | View bot analytics dashboard | Administrator |
| `/active-users` | List active users in server | Administrator |
| `/auditlog` | Search deleted message audit log | Moderator |
| `/admin-delete-xp` | Remove XP from a user | Administrator |
| `/admin-delete-time` | Remove time from a user | Administrator |
| `/admin-cancel-session` | Cancel a user's active session | Administrator |
| `/admin-reset-xp` | Reset ALL users to 0 XP/hours | Administrator |
| `/admin-revert-reset` | Restore users to a past period | Administrator |

---

## Session Management

### `/start`

Start a new productivity session.

**Syntax:**
```
/start activity: <description> [hours: X] [minutes: Y] [intensity: 1-5]
```

**Parameters:**
- `activity` (required) — What you're working on
- `hours` / `minutes` (optional) — Set a session timer that auto-stops
- `intensity` (optional, 1–5) — XP multiplier: 1=0.8×, 2=0.9×, 3=1×, 4=1.2×, 5=1.5×

**Notes:**
- Only one active session per user at a time
- Use `/cancel` to discard and start fresh

---

### `/stop`

Complete your active session and post it to the feed.

**Syntax:**
```
/stop
```

Opens a modal asking for:
- `title` (required) — Short session title
- `description` (required) — What you accomplished

**What happens:**
1. Duration calculated (minus paused time)
2. XP awarded (base + intensity + group + achievement boosts)
3. Stats updated (sessions, duration, streaks, XP)
4. Achievements checked
5. Feed post created in the configured feed channel
6. Level-up card posted if you leveled up

**Notes:**
- Minimum session: 1 minute
- Title max: 100 characters | Description max: 500 characters

---

### `/pause`

Pause your active session. Paused time is excluded from the final duration.

**Syntax:**
```
/pause
```

---

### `/unpause`

Resume a paused session.

**Syntax:**
```
/unpause
```

---

### `/break`

Pause for a set amount of time, then auto-resume.

**Syntax:**
```
/break [minutes: X] [seconds: Y]
```

**Parameters:**
- `minutes` (optional, 1–120)
- `seconds` (optional, 1–3600)
- Omit both to pause indefinitely (same as `/pause`)

**Notes:**
- Works with regular sessions, timed sessions, and Pomodoro sessions
- Auto-resumes when the timer expires

---

### `/time`

Check your current session status.

**Syntax:**
```
/time
```

Shows: activity, elapsed time (excluding paused), paused duration, current status, and estimated XP.

---

### `/cancel`

Discard your active session with no XP or feed post.

**Syntax:**
```
/cancel
```

**Notes:** Cannot be undone.

---

### `/pomodoro`

Run an automated Pomodoro timer with focus/break cycles.

**Syntax:**
```
/pomodoro focus: <seconds> break: <seconds> cycles: <number>
```

**Parameters:**
- `focus` (required, 1–3600 seconds) — Focus phase duration
- `break` (required, 1–3600 seconds) — Break phase duration
- `cycles` (required, 1–20) — Number of cycles to run

**What happens:**
- Session auto-pauses during each break phase
- DM notifications sent when each phase transitions
- After all cycles complete, session is auto-posted to the feed (with edit option)

---

### `/reduce-xp`

Remove XP from your own profile (self-correction).

**Syntax:**
```
/reduce-xp amount: <number>
```

**Notes:** Use if you accidentally logged too much. For correcting another user's XP, admins use `/admin-delete-xp`.

---

### `/reduce-time`

Remove study time from your own profile by deleting your most recent sessions.

**Syntax:**
```
/reduce-time hours: <number> [minutes: <number>]
```

**Notes:** Deletes the most recent completed sessions until the specified time is removed.

---

### `/manual`

Log a session that was completed outside Discord.

**Syntax:**
```
/manual
```

Opens a modal asking for activity, title, description, and duration (`2h 30m` or `90m` format).

**Notes:**
- Maximum duration: 12 hours
- Awards the same XP as a regular session

---

## Statistics & Profiles

### `/stats`

View your productivity statistics with a visual chart.

**Syntax:**
```
/stats [timeframe]
```

**Parameters:**
- `timeframe` (optional) — daily, weekly, monthly, yearly, all (default: weekly)

**Response:** Generated image with sessions/hours for the timeframe, XP, level progress, streak, and a bar chart. Interactive dropdown to switch timeframes.

---

### `/me`

View your profile card with all stats and achievements.

**Syntax:**
```
/me
```

**Response:** Generated profile card showing level, XP, total sessions, hours, streak, group membership, and recent achievements.

---

### `/profile`

View another user's profile.

**Syntax:**
```
/profile [user]
```

**Parameters:**
- `user` (optional) — Discord user to view (defaults to yourself)

---

### `/achievements`

View your unlocked achievements.

**Syntax:**
```
/achievements
```

Shows all leveled achievements (Duolingo-style, up to level 10 each), current progress, and XP boosts earned.

---

### `/leaderboard`

View server leaderboards with an interactive timeframe selector.

**Syntax:**
```
/leaderboard [timeframe]
```

**Parameters:**
- `timeframe` (optional) — daily, weekly, monthly, all-time (default: daily)

**Response:** Generated image with top 10 users by XP for the selected timeframe, including your rank if outside the top 10. Interactive dropdown to switch timeframes.

---

### `/live`

See who is currently studying in this server.

**Syntax:**
```
/live
```

Lists all active sessions with username, activity, and elapsed time. Sorted by duration (longest first).

---

### `/graph`

View your study history as a visual graph.

**Syntax:**
```
/graph
```

Shows line/bar charts of study hours and session frequency over time.

---

### `/history`

View your XP and hours history across every reset period.

**Syntax:**
```
/history
```

**Response:** One embed per past reset period, each showing a 5-point summary:
- XP earned in the period
- Hours studied
- Sessions completed
- Best streak (days)
- Longest single session

Followed by your current in-progress period and a final **cumulative totals** embed summing all periods.

**Notes:**
- Data is populated automatically whenever an admin runs `/admin-reset-xp`
- History is never deleted, even when new resets happen

---

## Utility

### `/lightmode`

Toggle light mode for generated images (`/stats`, `/me`, `/group`).

**Syntax:**
```
/lightmode enabled: on
/lightmode enabled: off
```

---

### `/studyping`

Send a role ping into its configured restricted channel via the bot.

**Syntax:**
```
/studyping role: @Role [message: text]
```

**Parameters:**
- `role` (required) — Role to ping
- `message` (optional, max 200 chars) — Message to send alongside the ping

**Notes:**
- Only works for roles configured with `/setup-role-restriction`
- The ping is sent to the role's designated channel, not wherever the command is run

---

### `/help`

View available commands.

**Syntax:**
```
/help
```

---

## Study Groups

### `/creategroup`

Create a new study group.

**Syntax:**
```
/creategroup name: <name> [public: true/false]
```

**Parameters:**
- `name` (required, max 50 characters)
- `public` (optional) — Whether the group is public (default: true). Private groups are hidden from `/findgroups` and `/joinrandom`, and can only be joined by invitation (`/invitegroup`). The owner can switch a group between public and private at any time with `/groupsettings public:True/False`.

**Group benefits:**
- 1% XP bonus per group level (max 50% at level 50)
- Groups level up every 25 combined hours

**Notes:** You can only be in one group at a time. Leave your current group first.

---

### `/joingroup`

Join a group by its ID.

**Syntax:**
```
/joingroup group_id: GP-XXXX
```

---

### `/joinrandom`

Join a random public group with available space.

**Syntax:**
```
/joinrandom
```

---

### `/leavegroup`

Leave your current study group.

**Syntax:**
```
/leavegroup
```

**Notes:** If you're the owner and others remain, the longest-standing member becomes the new owner. If you're the last member, the group is deleted.

---

### `/invitegroup`

Send a DM invitation to another user to join your group.

**Syntax:**
```
/invitegroup user: @User
```

The invited user receives a DM with Accept / Decline buttons.

---

### `/group`

View group overview with member stats and progress.

**Syntax:**
```
/group [user]
```

**Parameters:**
- `user` (optional) — View another user's group (defaults to your own)

**Response:** Generated image showing group name, level, XP bonus, total hours, and all members with individual contributions.

---

### `/group_leaderboard`

View the top groups on this server ranked by level.

**Syntax:**
```
/group_leaderboard
```

Paginated: 10 groups per page. Shows group name, level, XP, total hours, and member count.

---

### `/findgroups`

Browse public groups with available space.

**Syntax:**
```
/findgroups
```

Shows each group's name, ID, members, level, and XP bonus. Click **Join Group** to join directly.

---

### `/groupadmin`

Group owner administration.

**Syntax:**
```
/groupadmin delete
/groupadmin kick user:@member [groupid: A1B2]
/groupadmin transfer user:@member [groupid: A1B2]
```

Subcommands:
- `delete` — Permanently delete your group (confirmation required)
- `kick` — Remove a member from a group. The current leader can't be kicked; transfer leadership first
- `transfer` — Change the group leader

**Server administrators** (Discord Administrator permission) can use `kick` and `transfer` on any group by passing `groupid`. Without `groupid`, the commands act on your own group (owner or server admin).

---

### `/groupsettings`

Update your group's settings. Requires at least one parameter.

**Syntax:**
```
/groupsettings [name: text] [public: true/false] [maxmembers: number]
```

**Parameters:**
- `name` (optional, max 50 chars)
- `public` (optional) — `True` makes the group public (listed in `/findgroups`, joinable with `/joingroup` and `/joinrandom`); `False` makes it private (invitation only). Can be changed back and forth at any time.
- `maxmembers` (optional, 1–50) — Cannot be lower than the current member count

**Permissions:** Group owner only.

---

### `/groupdescription`

Set or update your group's description.

**Syntax:**
```
/groupdescription [description: text]
```

**Parameters:**
- `description` (optional, max 100 chars) — Omit or leave blank to remove the description

**Permissions:** Group owner only.

---

### `/renamegroup`

Rename your group.

**Syntax:**
```
/renamegroup name: <new name>
```

**Permissions:** Group owner only.

---

## Goals

### `/goal add`

Add a new goal to your list.

**Syntax:**
```
/goal add difficulty: easy|medium|hard
```

Opens a modal to enter goal text. XP awarded on completion: easy +10, medium +25, hard +50.

---

### `/goal list` (aka `/goals`)

View all your active goals.

**Syntax:**
```
/goal list
```

---

### `/goal complete`

Mark a goal as done and earn XP.

**Syntax:**
```
/goal complete
```

A dropdown appears with your active goals. Select one to complete it.

---

### `/goal delete` (aka `/cancelgoal`)

Delete a goal without completing it (no XP).

**Syntax:**
```
/goal delete
```

---

## Events

### `/createevent`

Create a scheduled group study event.

**Syntax:**
```
/createevent
```

Opens a modal: title, location, date (YYYY-MM-DD), time (HH:MM), duration (minutes, optional), description (optional).

**Response:** Public post in the events channel with RSVP buttons.

---

### `/events`

View all upcoming study events.

**Syntax:**
```
/events
```

---

### `/myevents`

View events you have RSVP'd to.

**Syntax:**
```
/myevents
```

---

### `/cancelevent`

Cancel one of your created events.

**Syntax:**
```
/cancelevent event: <event title>
```

Attendees are notified. Only the event creator can cancel.

---

## Admin Commands

All admin commands require the `Administrator` Discord permission unless noted otherwise.

---

### `/setup-feed`

Set the channel where completed sessions are posted.

**Syntax:**
```
/setup-feed channel: #channel
```

---

### `/set-welcome-channel`

Set the channel for new-member welcome messages.

**Syntax:**
```
/set-welcome-channel channel: #channel
```

---

### `/setup-events-channel`

Set the channel for study event posts.

**Syntax:**
```
/setup-events-channel channel: #channel
```

---

### `/setup-goal-channel`

Set the channel where numbered task lists are automatically parsed into goals.

**Syntax:**
```
/setup-goal-channel channel: #channel
```

---

### `/setup-timezone`

Set the server timezone for event scheduling and daily resets.

**Syntax:**
```
/setup-timezone timezone: America/New_York
```

Common values: `America/New_York`, `America/Chicago`, `America/Los_Angeles`, `Europe/London`, `Asia/Tokyo`.
[Full timezone list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

---

### `/setup-level-roles`

Configure the 8 tier roles assigned automatically based on user level.

**Syntax:**
```
/setup-level-roles [void: @role] [charcoal: @role] [bronze: @role] [silver: @role]
                   [gold: @role] [amethyst: @role] [diamond: @role] [radiant: @role]
```

**Level thresholds:**

| Tier | Levels |
|------|--------|
| Void | 1–3 |
| Charcoal | 4–8 |
| Bronze | 9–15 |
| Silver | 16–25 |
| Gold | 26–40 |
| Amethyst | 41–60 |
| Diamond | 61–85 |
| Radiant | 86+ |

All parameters are optional — only provide the roles you want to configure.

---

### `/sync-roles`

Sync level-based roles to all server members.

**Syntax:**
```
/sync-roles [dry-run: true/false]
```

**Parameters:**
- `dry-run` (optional) — Preview changes without applying them

Shows members synced, errors, and a sample of role changes.

---

### `/setup-start-here`

Post a comprehensive onboarding guide into a channel.

**Syntax:**
```
/setup-start-here channel: #channel [mod-role: @role]
```

**Parameters:**
- `channel` (required) — Where to post the guide
- `mod-role` (optional) — Moderator role to mention in the guide

Posts a formatted guide covering Getting Started, Levels & XP, and Study Groups.

---

### `/setup-reaction-role`

Configure reaction-based role assignment on a message.

**Subcommands:**

```
/setup-reaction-role add message_id: <id> emoji: <emoji> role: @role [channel_id: <id>]
/setup-reaction-role list
/setup-reaction-role remove message_id: <id> emoji: <emoji>
```

When a user reacts with the configured emoji, they receive the role. Removing the reaction removes the role.

---

### `/setup-san-roles`

Configure san-level XP-based roles (granular color tiers relative to the top user).

**Subcommands:**

```
/setup-san-roles create [san: @user] [below_role: @role]
/setup-san-roles sync
/setup-san-roles info
```

- `create` — Creates 17 san-level roles with OKLCH color progression and syncs all members
- `sync` — Re-assigns san roles based on current XP standings
- `info` — Shows current configuration

---

### `/setup-role-restriction`

Restrict a role ping to a specific channel (enforced at the Discord level and by the bot).

**Subcommands:**

```
/setup-role-restriction add role: @role channel: #channel
/setup-role-restriction list
/setup-role-restriction remove role: @role
/setup-role-restriction sync
```

- `add` — Restricts the role to one channel; the role is made non-mentionable in Discord
- `list` — Shows all active restrictions
- `remove` — Removes a restriction
- `sync` — Re-applies the non-mentionable flag to all restricted roles (use after bot restarts)

Users must use `/studyping` to ping restricted roles.

---

### `/analytics`

View the bot analytics dashboard.

**Syntax:**
```
/analytics [report: overview|users|commands|retention|sessions|features|quick]
```

**Report types:**

| Report | Contents |
|--------|----------|
| `overview` | General server stats |
| `users` | User engagement metrics |
| `commands` | Command usage frequency |
| `retention` | User retention data |
| `sessions` | Session completion funnel |
| `features` | Feature adoption rates |
| `quick` | Quick-reference numbers |

Default: `overview`.

---

### `/active-users`

List all users who have studied for at least N hours.

**Syntax:**
```
/active-users [minimum_hours: N]
```

**Parameters:**
- `minimum_hours` (optional, default 1) — Minimum hours to include a user

Shows each user's total hours, session count, level, and streak.

---

### `/auditlog`

Search the permanent audit log of deleted messages.

**Syntax:**
```
/auditlog recent
/auditlog search [user: @user] [channel: #channel] [keyword: text]
```

**Permissions:** Requires **Manage Messages** (moderators and admins).

**Notes:** Audit log records cannot be deleted, even by moderators.

---

### `/admin-delete-xp`

Remove a specific amount of XP from a user (correction tool).

**Syntax:**
```
/admin-delete-xp user: @user amount: <number>
```

Shows before/after XP and level. XP cannot go below 0.

---

### `/admin-delete-time`

Remove study time from a user by deleting their most recent sessions.

**Syntax:**
```
/admin-delete-time user: @user hours: <number> [minutes: <number>]
```

Shows which sessions were deleted and the total time removed.

---

### `/admin-cancel-session`

Cancel another user's active session without saving stats or posting to the feed.

**Syntax:**
```
/admin-cancel-session user: @user
```

**Permissions:** Administrator or Moderator.

---

### `/admin-reset-xp`

**Reset ALL users' XP and hours to 0**, saving a full snapshot into each user's history first.

**Syntax:**
```
/admin-reset-xp confirm: CONFIRM RESET
```

**What is reset:** `xp`, `totalDuration`, `totalSessions`, `sessionsByDay`

**What is preserved:** achievements, streaks, group membership, preferences, and the full `resetHistory` array

After the reset, users can run `/history` to see their stats from every past period. The all-time leaderboard reflects 0 until new sessions are completed.

**Safety:** The exact phrase `CONFIRM RESET` is required to proceed.

---

### `/admin-revert-reset`

Restore ALL users' XP and hours back to the values they held at the end of a specific past period.

**Syntax:**
```
/admin-revert-reset period: <number> confirm: CONFIRM REVERT
```

**Parameters:**
- `period` (required, min 1) — The period number to restore to (matches numbers shown in `/history`)

**Example:** If two resets have occurred and you want to undo the most recent one, use `period: 2`.

**Notes:**
- The `resetHistory` audit trail is **never modified** — `/history` still shows all periods after a revert
- Users with no snapshot for the requested period (joined after that reset) are skipped
- Current period progress (earned since the last reset) is overwritten by the revert

**Safety:** The exact phrase `CONFIRM REVERT` is required to proceed.

---

## Command Permissions Summary

| Permission Level | Commands |
|-----------------|----------|
| **All users** | start, stop, pause, unpause, break, time, cancel, pomodoro, reduce-xp, reduce-time, manual, stats, me, profile, achievements, leaderboard, live, graph, history, lightmode, studyping, help, creategroup, joingroup, joinrandom, leavegroup, invitegroup, group, group_leaderboard, findgroups, goal, createevent, events, myevents |
| **Group owner** | groupadmin, groupsettings, groupdescription, renamegroup |
| **Event creator** | cancelevent |
| **Moderator** (Manage Messages) | auditlog |
| **Moderator or Admin** | admin-cancel-session |
| **Administrator** | setup-feed, set-welcome-channel, setup-events-channel, setup-goal-channel, setup-timezone, setup-level-roles, setup-start-here, setup-reaction-role, setup-san-roles, setup-role-restriction, sync-roles, analytics, active-users, admin-delete-xp, admin-delete-time, admin-reset-xp, admin-revert-reset |

---

## Tips & Best Practices

### Sessions
- Start sessions when you begin working, not after
- Use `/break` for timed breaks (auto-resumes); use `/pause` for open-ended pauses
- Use `/pomodoro` for structured focus/break cycles
- Write meaningful titles and descriptions — they appear in the community feed

### Stats & Leaderboards
- `/stats` for detailed numbers; `/graph` for visual trends
- `/history` to see cumulative progress across reset periods
- `/leaderboard` for friendly competition (daily resets each midnight PT)

### Groups
- Join groups with similar study schedules for the XP bonus
- Group XP bonus: 1% per level, up to 50% at level 50
- Use `/invitegroup` to bring in specific people; `/findgroups` to discover public groups

### Goals
- Match difficulty to actual effort: easy < 1h, medium 1–2h, hard 2h+
- Goals count toward your daily streak alongside sessions

### Admin Setup Order (new server)
1. `/setup-feed` — configure where sessions post
2. `/setup-timezone` — set server timezone
3. `/setup-level-roles` — configure tier roles
4. `/setup-start-here` — post onboarding guide
5. `/setup-welcome-channel` — configure welcome messages
6. `/sync-roles` — apply roles to existing members

---

## Common Workflows

### Daily study session
```
/start activity: Morning review
  (study)
/break minutes: 10
  (break auto-ends)
/stop → fill in title and description
/stats
```

### Pomodoro session
```
/pomodoro focus: 1500 break: 300 cycles: 4
  (25min focus / 5min break × 4, auto-posts when done)
```

### Viewing reset history
```
/history
  → Shows each past period with XP, hours, sessions, best streak, longest session
  → Cumulative totals at the bottom
```

### Joining a group
```
/findgroups         → browse with space available
  click [Join Group]
/group              → view your group's stats
```

---

## Need More Help?

- [Setup Guide](./SETUP.md) — installation and configuration
- [Architecture](./ARCHITECTURE.md) — how the bot works internally
- [Database Schema](../DATABASE_SCHEMA.md) — Firestore data model
