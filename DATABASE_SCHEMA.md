# Current Database Schema Documentation

**Generated:** 2025-01-14
**Purpose:** Document existing Firestore schema before Phase 1 implementation

---

## Firestore Collections Structure

```
discord-data/ (root document)
  ├── activeSessions/ (subcollection)
  │   └── sessions/ (subcollection)
  │       └── {userId} (document)
  │
  ├── sessions/ (subcollection)
  │   └── completed/ (subcollection)
  │       └── {sessionId} (document)
  │
  ├── userStats/ (subcollection)
  │   └── stats/ (subcollection)
  │       └── {userId} (document)
  │
  └── serverConfig/ (subcollection)
      └── configs/ (subcollection)
          └── {serverId} (document)
```

---

## Collection Details

### 1. Active Sessions
**Path:** `discord-data/activeSessions/sessions/{userId}`

**Purpose:** Track currently active study sessions (one per user max)

**Interface:** `ActiveSession`

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Discord user ID |
| `username` | string | Discord username (updated on actions) |
| `serverId` | string | Discord guild/server ID |
| `activity` | string | What the user is working on |
| `startTime` | Timestamp | Firebase server timestamp |
| `isPaused` | boolean | Current pause state |
| `pausedAt` | Timestamp (optional) | When last paused (if isPaused = true) |
| `pausedDuration` | number | Total seconds spent paused |
| `isVCSession` | boolean (optional) | Started by joining voice channel |
| `vcChannelId` | string (optional) | Voice channel ID if VC session |
| `leftVCAt` | Timestamp (optional) | When user left VC |
| `pendingCompletion` | boolean (optional) | Waiting for /end or auto-post |

---

### 2. Completed Sessions
**Path:** `discord-data/sessions/completed/{sessionId}`

**Purpose:** Historical record of all completed sessions

**Interface:** `CompletedSession`

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Discord user ID |
| `username` | string | Discord username |
| `serverId` | string | Discord guild/server ID |
| `activity` | string | What was worked on |
| `title` | string | Session title |
| `description` | string | What was accomplished |
| `duration` | number | Total duration in seconds |
| `startTime` | Timestamp | Session start time |
| `endTime` | Timestamp | Session end time |
| `createdAt` | Timestamp | Document creation (for sorting) |

---

### 3. User Statistics
**Path:** `discord-data/userStats/stats/{userId}`

**Purpose:** Aggregate statistics per user

**Interface:** `UserStats`

| Field | Type | Description |
|-------|------|-------------|
| `username` | string | Discord username (updated per session) |
| `totalSessions` | number | All-time session count |
| `totalDuration` | number | All-time duration in seconds |
| `currentStreak` | number | Current consecutive days |
| `longestStreak` | number | Best streak ever |
| `lastSessionAt` | Timestamp | Most recent session |
| `firstSessionAt` | Timestamp | First ever session |

**Notes:**
- Created on first session
- Updated after each completed session
- Used for leaderboards and /stats command

---

### 4. Server Configuration
**Path:** `discord-data/serverConfig/configs/{serverId}`

**Purpose:** Per-server settings and configuration

**Interface:** `ServerConfig`

| Field | Type | Description |
|-------|------|-------------|
| `feedChannelId` | string (optional) | Channel for feed posts |
| `focusRoomIds` | string[] (optional) | Voice channels for auto-start |
| `setupAt` | Timestamp | Last config update |
| `setupBy` | string | Admin user ID |

---

## Planned Changes for Phase 1

The following fields will be **added** to `UserStats`:

### XP & Leveling
- `xp: number` - Total XP earned
- `level: number` - Current level (1-100)

### Badge Tracking
- `badges: string[]` - Array of unlocked badge IDs
- `badgesUnlockedAt: { [badgeId: string]: Timestamp }` - Unlock timestamps

### Additional Tracking
- `sessionsByDay: { [date: string]: number }` - Sessions per day (YYYY-MM-DD)
- `activityTypes: string[]` - Unique activity types tried
- `longestSessionDuration: number` - Longest session in seconds
- `firstSessionOfDayCount: number` - Times user started first session of day
- `sessionsBeforeNoon: number` - Sessions started before 12 PM
- `sessionsAfterMidnight: number` - Sessions started after 12 AM

---

## Migration Strategy

For existing users:
1. Initialize `xp` based on existing `totalDuration` (10 XP/hour)
2. Calculate `level` from XP
3. Set `badges` as empty array `[]`
4. Set `badgesUnlockedAt` as empty object `{}`
5. Approximate `sessionsByDay` from `totalSessions`
6. Initialize all new numeric fields to `0`
7. Initialize all new array fields to `[]`

---

## Indexes

Current Firestore indexes (if any):
- None explicitly defined (using default Firestore indexes)

Potential indexes needed for Phase 1:
- Composite index on `totalDuration` and `serverId` for leaderboards
- Composite index on `xp` and `serverId` for XP leaderboards (future)

---

**End of Documentation**
