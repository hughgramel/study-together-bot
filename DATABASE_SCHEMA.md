# Database Schema Documentation

**Last Updated:** 2025-01-15
**Current Phase:** Phase 1 Complete, Phase 2 Planning
**Purpose:** Document Firestore schema including Phase 1 (XP & Badges) and planned Phase 2 changes

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

## ✅ Phase 1 Changes (Implemented)

The following fields have been **added** to `UserStats`:

### XP & Leveling
- `xp?: number` - Total XP earned (calculated from sessions)
- **Note:** `level` is NOT stored, it's calculated on-demand from XP using `calculateLevel()` utility

### Badge Tracking
- `badges?: string[]` - Array of unlocked badge IDs
- `badgesUnlockedAt?: { [badgeId: string]: Timestamp }` - Unlock timestamps

### Additional Tracking
- `sessionsByDay?: { [date: string]: number }` - Sessions per day (YYYY-MM-DD format)
- `activityTypes?: string[]` - Unique activity types tried
- `longestSessionDuration?: number` - Longest session in seconds
- `firstSessionOfDayCount?: number` - Times user started first session of day
- `sessionsBeforeNoon?: number` - Sessions started before 12 PM
- `sessionsAfterMidnight?: number` - Sessions started after 12 AM

All fields use optional `?` syntax for backward compatibility with existing users.

---

## 🚀 Planned Changes for Phase 2

### New Collection: Session Posts
**Path:** `discord-data/sessionPosts/posts/{messageId}`

**Purpose:** Track session feed posts for reactions and social features

**Interface:** `SessionPost`

| Field | Type | Description |
|-------|------|-------------|
| `messageId` | string | Discord message ID (document ID) |
| `userId` | string | User who completed session |
| `username` | string | Discord username |
| `guildId` | string | Discord server ID |
| `channelId` | string | Feed channel ID |
| `sessionId` | string | Reference to completed session |
| `duration` | number | Session duration in seconds |
| `xpGained` | number | XP awarded for this session |
| `levelGained` | number (optional) | New level if leveled up |
| `badgesUnlocked` | string[] (optional) | Badge IDs unlocked |
| `postedAt` | Timestamp | When posted to feed |
| `reactions` | map | `{ [emoji: string]: string[] }` - emoji to user IDs |
| `cheers` | array | Array of cheer objects (see below) |

**Cheer Object:**
```typescript
{
  userId: string;
  username: string;
  message: string;
  timestamp: Timestamp;
}
```

---

### New Collection: Weekly Challenges
**Path:** `discord-data/challenges/weekly/{weekKey}`

**Purpose:** Track weekly XP challenges and leaderboards

**Interface:** `WeeklyChallenge`

| Field | Type | Description |
|-------|------|-------------|
| `weekKey` | string | ISO week format (e.g., "2025-W03") |
| `startDate` | Timestamp | Week start (Monday 00:00) |
| `endDate` | Timestamp | Week end (Sunday 23:59) |
| `targetXp` | number | XP goal for the week |
| `bonusXp` | number | Bonus XP for completing |
| `bonusBadge` | string (optional) | Badge ID for completion |
| `participants` | string[] | User IDs who participated |
| `completedBy` | string[] | User IDs who completed |
| `topEarners` | array | Top 10 leaderboard (see below) |

**Top Earner Object:**
```typescript
{
  userId: string;
  username: string;
  xpEarned: number;
  level: number;
}
```

---

### Extended User Stats (Phase 2)

The following fields will be **added** to `UserStats`:

#### Social Engagement
- `reactionsReceived?: number` - Total reactions on user's posts
- `reactionsGiven?: number` - Total reactions given to others
- `cheersReceived?: number` - Total cheers received
- `cheersGiven?: number` - Total cheers given

#### Weekly Challenge Tracking
- `weeklyXpEarned?: { [weekKey: string]: number }` - XP earned per week
- `weeklyStreakCount?: number` - Consecutive weeks hitting challenge target

#### Additional Profile Stats
- `favoriteActivity?: string` - Most common activity type
- `peakLevel?: number` - Highest level ever reached
- `firstBadgeUnlockedAt?: Timestamp` - When first badge was unlocked

---

## Migration Strategy

### Phase 1 (Completed)
For existing users:
1. ✅ Initialize `xp` based on existing `totalDuration` (10 XP/hour) OR set to 0 for new fields
2. ✅ Level calculated on-demand, not stored
3. ✅ Set `badges` as empty array `[]`
4. ✅ Set `badgesUnlockedAt` as empty object `{}`
5. ✅ `sessionsByDay` populated going forward (not retrospectively)
6. ✅ All new numeric fields default to `0`
7. ✅ All new array fields default to `[]`

**Result:** Backward compatible - all Phase 1 fields are optional

### Phase 2 (Planned)
For existing users when Phase 2 deploys:
1. Initialize social engagement fields (`reactionsReceived`, etc.) to `0`
2. Initialize `weeklyXpEarned` as empty object `{}`
3. Initialize `weeklyStreakCount` to `0`
4. Calculate `favoriteActivity` from existing `activityTypes` (most common)
5. Set `peakLevel` to current calculated level
6. New collections (`sessionPosts`, `challenges`) start empty and populate going forward

**Note:** Session posts tracking will only capture NEW sessions after Phase 2 deployment. Historical sessions will not have reaction/cheer data.

---

## Indexes

### Current Indexes (Phase 1)
- Default Firestore indexes on single fields
- Composite index on `totalDuration` (DESC) for time-based leaderboards
- Composite index on `xp` (DESC) for XP-based leaderboards (if needed)

### Planned Indexes for Phase 2
- Composite index on `sessionPosts`: `guildId` + `postedAt` (DESC) for feed queries
- Composite index on `weeklyXpEarned.{weekKey}` for weekly leaderboards (denormalized approach)
- Single field index on `sessionPosts.reactions.{emoji}` for reaction queries (if using subcollections)

**Recommendation:** Monitor query performance and add indexes as needed based on actual usage patterns.

---

## Data Flow Diagram (Phase 2)

```
User completes session
    ↓
Stats updated (XP, badges, etc.)
    ↓
Post to feed channel
    ↓
Save SessionPost to Firestore (with messageId)
    ↓
Users react to message
    ↓
React event → Update SessionPost.reactions
    ↓
Update UserStats (reactionsReceived/Given)
```

---

**End of Documentation**

**Next Steps:**
- Phase 2 implementation will add 2 new collections and extend UserStats
- All changes are backward compatible with optional fields
- Indexes will be added based on query performance monitoring
