# API Documentation

Service layer documentation for Study Together bot. This guide covers all business logic services that interact with Firebase Firestore and provide functionality to the Discord bot.

## Table of Contents

- [Core Services](#core-services)
  - [SessionService](#sessionservice)
  - [StatsService](#statsservice)
  - [XPService](#xpservice)
  - [AchievementService](#achievementservice)
- [Social Services](#social-services)
  - [GroupService](#groupservice)
  - [PostService](#postservice)
  - [EventService](#eventservice)
  - [DailyGoalService](#dailygoalservice)
- [Image Generation Services](#image-generation-services)
  - [ProfileImageService](#profileimageservice)
  - [StatsImageService](#statsimageservice)
  - [PostImageService](#postimageservice)
  - [GroupOverviewImageService](#groupoverviewimageservice)
- [Utility Services](#utility-services)
  - [BadgeService](#badgeservice)
  - [WeeklyChallengeService](#weeklychallengeservice)

---

## Core Services

### SessionService

Manages session lifecycle (create, pause, resume, complete, cancel).

#### Constructor

```typescript
constructor(db: Firestore)
```

**Parameters:**
- `db` - Firebase Firestore instance

#### Methods

##### `getActiveSession(userId: string): Promise<ActiveSession | null>`

Get a user's active session.

**Parameters:**
- `userId` - Discord user ID

**Returns:**
- `ActiveSession` object if session exists
- `null` if no active session

**Example:**
```typescript
const session = await sessionService.getActiveSession(userId);
if (session) {
  console.log(`Session started at ${session.startTime}`);
}
```

---

##### `getAllActiveSessions(): Promise<ActiveSession[]>`

Get all active sessions across all servers.

**Returns:**
- Array of `ActiveSession` objects
- Empty array if no active sessions

**Example:**
```typescript
const allSessions = await sessionService.getAllActiveSessions();
console.log(`${allSessions.length} users currently studying`);
```

---

##### `getActiveSessionsByServer(serverId: string): Promise<ActiveSession[]>`

Get all active sessions for a specific server.

**Parameters:**
- `serverId` - Discord guild/server ID

**Returns:**
- Array of `ActiveSession` objects for that server
- Empty array if no active sessions

**Example:**
```typescript
const serverSessions = await sessionService.getActiveSessionsByServer(guildId);
// Display "who's studying" list
```

---

##### `createActiveSession(userId: string, username: string, serverId: string, activity: string): Promise<void>`

Create a new active session for a user.

**Parameters:**
- `userId` - Discord user ID
- `username` - Discord username
- `serverId` - Discord server ID
- `activity` - What the user is working on

**Throws:**
- Error if user already has an active session

**Example:**
```typescript
await sessionService.createActiveSession(
  userId,
  username,
  guildId,
  'Learning React hooks'
);
```

**Firestore write:**
```
discord-data/activeSessions/sessions/{userId}
{
  userId: string,
  username: string,
  serverId: string,
  activity: string,
  startTime: Timestamp,
  isPaused: false,
  pausedDuration: 0
}
```

---

##### `updateActiveSession(userId: string, updates: Partial<ActiveSession>): Promise<void>`

Update fields of an active session.

**Parameters:**
- `userId` - Discord user ID
- `updates` - Partial object with fields to update

**Example:**
```typescript
// Pause a session
await sessionService.updateActiveSession(userId, {
  isPaused: true,
  pausedAt: Timestamp.now()
});
```

---

##### `pauseSession(userId: string): Promise<void>`

Pause a user's active session.

**Parameters:**
- `userId` - Discord user ID

**Throws:**
- Error if no active session
- Error if session already paused

**Example:**
```typescript
await sessionService.pauseSession(userId);
```

**Updates:**
- `isPaused: true`
- `pausedAt: Timestamp.now()`

---

##### `unpauseSession(userId: string): Promise<void>`

Resume a paused session.

**Parameters:**
- `userId` - Discord user ID

**Throws:**
- Error if no active session
- Error if session not paused

**Example:**
```typescript
await sessionService.unpauseSession(userId);
```

**Updates:**
- Calculates paused duration
- Adds to `pausedDuration` total
- Sets `isPaused: false`
- Removes `pausedAt` field

---

##### `completeSession(userId: string, title: string, description: string): Promise<CompletedSession>`

Complete an active session and save it.

**Parameters:**
- `userId` - Discord user ID
- `title` - Session title
- `description` - What was accomplished

**Returns:**
- `CompletedSession` object with calculated duration and XP

**Throws:**
- Error if no active session

**Example:**
```typescript
const completed = await sessionService.completeSession(
  userId,
  'Built Discord Bot',
  'Implemented session tracking and Firebase integration'
);

console.log(`Duration: ${completed.duration}s`);
console.log(`XP: ${completed.xpGained}`);
```

**What happens:**
1. Fetches active session
2. Calculates total duration (minus paused time)
3. Calculates XP (via `XPService.calculateSessionXP()`)
4. Creates `CompletedSession` document
5. Deletes active session
6. Returns completed session data

**Firestore writes:**
- Creates: `discord-data/sessions/completed/{sessionId}`
- Deletes: `discord-data/activeSessions/sessions/{userId}`

---

##### `cancelSession(userId: string): Promise<void>`

Cancel an active session without saving.

**Parameters:**
- `userId` - Discord user ID

**Throws:**
- Error if no active session

**Example:**
```typescript
await sessionService.cancelSession(userId);
```

**Firestore write:**
- Deletes: `discord-data/activeSessions/sessions/{userId}`

---

##### `getCompletedSessionsByUser(userId: string, limit?: number): Promise<CompletedSession[]>`

Get a user's completed sessions.

**Parameters:**
- `userId` - Discord user ID
- `limit` (optional) - Maximum number to return (default: 10)

**Returns:**
- Array of `CompletedSession` objects, sorted by `createdAt` descending

**Example:**
```typescript
const recentSessions = await sessionService.getCompletedSessionsByUser(userId, 5);
// Display last 5 sessions
```

---

### StatsService

Manages user statistics, streaks, and leaderboards.

#### Constructor

```typescript
constructor(db: Firestore)
```

#### Methods

##### `getUserStats(userId: string): Promise<UserStats | null>`

Get user statistics.

**Parameters:**
- `userId` - Discord user ID

**Returns:**
- `UserStats` object if user has stats
- `null` if user has never completed a session

**Example:**
```typescript
const stats = await statsService.getUserStats(userId);
if (stats) {
  console.log(`Total hours: ${stats.totalDuration / 3600}`);
  console.log(`Streak: ${stats.currentStreak} days`);
}
```

---

##### `getOrCreateUserStats(userId: string, username: string): Promise<UserStats>`

Get user stats or create if they don't exist.

**Parameters:**
- `userId` - Discord user ID
- `username` - Discord username

**Returns:**
- `UserStats` object (existing or newly created)

**Example:**
```typescript
const stats = await statsService.getOrCreateUserStats(userId, username);
// Always returns a stats object
```

**Firestore write (if creating):**
```
discord-data/userStats/stats/{userId}
{
  username: string,
  totalSessions: 0,
  totalDuration: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastSessionAt: Timestamp.now(),
  firstSessionAt: Timestamp.now(),
  xp: 0,
  achievements: []
}
```

---

##### `updateUserStats(userId: string, sessionData: CompletedSession): Promise<void>`

Update user stats after completing a session.

**Parameters:**
- `userId` - Discord user ID
- `sessionData` - Completed session object

**Example:**
```typescript
await statsService.updateUserStats(userId, completedSession);
```

**What updates:**
- Increments `totalSessions`
- Adds to `totalDuration`
- Adds to `xp`
- Updates `lastSessionAt`
- Recalculates `currentStreak` and `longestStreak`
- Updates `sessionsByDay` map
- Updates time-of-day tracking fields

**Streak calculation:**
- If session is today: Keep current streak
- If session is yesterday: Increment streak
- If session is older: Reset streak to 1

---

##### `getLeaderboard(serverId: string, timeframe: 'daily' | 'weekly' | 'monthly' | 'all'): Promise<LeaderboardEntry[]>`

Get server leaderboard for a timeframe.

**Parameters:**
- `serverId` - Discord server ID
- `timeframe` - Time period to rank by

**Returns:**
- Array of `LeaderboardEntry` objects with:
  - `userId`
  - `username`
  - `xp` (for timeframe)
  - `level`
  - `totalHours` (for timeframe)
  - `rank`

**Example:**
```typescript
const leaderboard = await statsService.getLeaderboard(guildId, 'weekly');
leaderboard.forEach((entry, index) => {
  console.log(`#${index + 1} ${entry.username}: ${entry.xp} XP`);
});
```

**Calculation:**
- `daily`: Sessions from today (00:00 - 23:59)
- `weekly`: Sessions from current week (Monday - Sunday)
- `monthly`: Sessions from current month
- `all`: All-time totals

---

##### `getCurrentStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number }>`

Calculate user's current streak considering sessions AND goals.

**Parameters:**
- `userId` - Discord user ID

**Returns:**
- Object with `currentStreak` and `longestStreak`

**Example:**
```typescript
const { currentStreak, longestStreak } = await statsService.getCurrentStreak(userId);
console.log(`Current: ${currentStreak}, Best: ${longestStreak}`);
```

**Note:** This method checks both completed sessions and daily goals to determine streaks.

---

### XPService

Manages XP calculations, awarding, and level progression.

#### Constructor

```typescript
constructor(db: Firestore)
```

#### Methods

##### `awardXP(userId: string, amount: number, reason: string): Promise<{ newXp: number; newLevel: number; leveledUp: boolean; levelsGained: number }>`

Award XP to a user and check for level ups.

**Parameters:**
- `userId` - Discord user ID
- `amount` - XP to award
- `reason` - Reason for logging

**Returns:**
- Object with:
  - `newXp` - User's total XP after award
  - `newLevel` - User's current level
  - `leveledUp` - Whether user leveled up
  - `levelsGained` - Number of levels gained (can be > 1)

**Throws:**
- Error if user stats not found

**Example:**
```typescript
const result = await xpService.awardXP(userId, 150, 'Session completed');
if (result.leveledUp) {
  console.log(`Level up! Now level ${result.newLevel}`);
  // Show level up card
}
```

---

##### `calculateSessionXP(durationSeconds: number): number`

Calculate base XP from session duration.

**Formula:** `100 XP per hour` (rounded up)

**Parameters:**
- `durationSeconds` - Session duration in seconds

**Returns:**
- XP earned (integer)

**Examples:**
```typescript
xpService.calculateSessionXP(3600);  // 1 hour = 100 XP
xpService.calculateSessionXP(1800);  // 30 min = 50 XP
xpService.calculateSessionXP(7200);  // 2 hours = 200 XP
xpService.calculateSessionXP(60);    // 1 min = 2 XP
```

---

##### `getSessionXPBreakdown(durationSeconds: number, isStreakMilestone: boolean, streakDays: number): { total: number; base: number; bonuses: { name: string; amount: number }[] }`

Get detailed XP breakdown with bonuses.

**Parameters:**
- `durationSeconds` - Session duration in seconds
- `isStreakMilestone` - Whether this session hits a streak milestone
- `streakDays` - Current streak length

**Returns:**
- Object with:
  - `total` - Total XP (base + bonuses)
  - `base` - Base XP from time
  - `bonuses` - Array of bonus objects with name and amount

**Example:**
```typescript
const breakdown = xpService.getSessionXPBreakdown(7200, true, 7);
// {
//   total: 250,
//   base: 200,
//   bonuses: [
//     { name: '7-day streak bonus', amount: 50 }
//   ]
// }
```

**Bonuses:**
- 7-day streak: +50 XP
- 30-day streak: +100 XP
- 100-day streak: +250 XP
- First session of day: +20 XP

---

### AchievementService

Manages achievement unlocking and tracking.

#### Constructor

```typescript
constructor(db: Firestore)
```

#### Methods

##### `checkAndUnlockAchievements(userId: string, stats: UserStats): Promise<string[]>`

Check all achievements and unlock eligible ones.

**Parameters:**
- `userId` - Discord user ID
- `stats` - User's current stats

**Returns:**
- Array of newly unlocked achievement IDs

**Example:**
```typescript
const unlocked = await achievementService.checkAndUnlockAchievements(userId, stats);
if (unlocked.length > 0) {
  console.log(`Unlocked: ${unlocked.join(', ')}`);
  // Show achievement unlock cards
}
```

**What happens:**
1. Gets all achievement definitions
2. Gets user's current unlocked achievements
3. Checks conditions for each locked achievement
4. Unlocks eligible achievements
5. Awards bonus XP for each unlock
6. Returns array of newly unlocked IDs

---

##### `unlockAchievement(userId: string, achievementId: string): Promise<void>`

Manually unlock a specific achievement.

**Parameters:**
- `userId` - Discord user ID
- `achievementId` - Achievement ID to unlock

**Example:**
```typescript
await achievementService.unlockAchievement(userId, 'first_steps');
```

**Firestore write:**
- Adds achievement ID to `achievements` array
- Adds unlock timestamp to `achievementsUnlockedAt` map
- Awards bonus XP (via `XPService`)

---

##### `getUserAchievements(userId: string): Promise<string[]>`

Get all unlocked achievements for a user.

**Parameters:**
- `userId` - Discord user ID

**Returns:**
- Array of unlocked achievement IDs
- Empty array if user has no unlocked achievements

**Example:**
```typescript
const achievements = await achievementService.getUserAchievements(userId);
console.log(`${achievements.length} achievements unlocked`);
```

---

##### `getProgress(userId: string, achievementId: string): Promise<{ current: number; required: number; percentage: number }>`

Get progress toward an achievement.

**Parameters:**
- `userId` - Discord user ID
- `achievementId` - Achievement ID

**Returns:**
- Object with:
  - `current` - Current progress value
  - `required` - Required value to unlock
  - `percentage` - Progress percentage (0-100)

**Example:**
```typescript
const progress = await achievementService.getProgress(userId, 'centurion');
console.log(`${progress.current}/${progress.required} hours (${progress.percentage}%)`);
```

---

## Social Services

### GroupService

Manages study groups, memberships, and group stats.

#### Constructor

```typescript
constructor(db: Firestore)
```

#### Methods

##### `createGroup(ownerId: string, ownerUsername: string, serverId: string, groupName: string, isPublic: boolean): Promise<string>`

Create a new study group.

**Parameters:**
- `ownerId` - Discord user ID of creator
- `ownerUsername` - Creator's username
- `serverId` - Discord server ID
- `groupName` - Group name (max 50 chars)
- `isPublic` - Whether group appears in `/findgroups`

**Returns:**
- Group ID (e.g., "GP-A1B2")

**Throws:**
- Error if user already in a group
- Error if group name already exists

**Example:**
```typescript
const groupId = await groupService.createGroup(
  userId,
  username,
  guildId,
  'Study Warriors',
  true
);
console.log(`Group created: ${groupId}`);
```

**Firestore writes:**
- Creates: `discord-data/groups/active/{groupId}`
- Creates: `discord-data/groupMembers/memberships/{ownerId}`

---

##### `joinGroup(userId: string, username: string, groupId: string): Promise<void>`

Join an existing group.

**Parameters:**
- `userId` - Discord user ID
- `username` - User's username
- `groupId` - Group ID to join

**Throws:**
- Error if user already in a group
- Error if group full (5/5 members)
- Error if group doesn't exist

**Example:**
```typescript
await groupService.joinGroup(userId, username, 'GP-A1B2');
```

---

##### `leaveGroup(userId: string): Promise<void>`

Leave current group.

**Parameters:**
- `userId` - Discord user ID

**Throws:**
- Error if user not in a group

**Example:**
```typescript
await groupService.leaveGroup(userId);
```

**What happens:**
1. Removes user from group's `members` array
2. Deletes user's `groupMembers` document
3. If user was owner and last member: Deletes group
4. If user was owner but others remain: Transfers ownership to oldest member

---

##### `getGroupOverview(groupId: string): Promise<GroupOverview>`

Get detailed group information.

**Parameters:**
- `groupId` - Group ID

**Returns:**
- `GroupOverview` object with:
  - Group details (name, level, XP, etc.)
  - Member list with stats
  - Recent activity

**Example:**
```typescript
const overview = await groupService.getGroupOverview('GP-A1B2');
console.log(`${overview.groupName} - Level ${overview.groupLevel}`);
```

---

##### `updateGroupStats(groupId: string, duration: number, xp: number): Promise<void>`

Update group stats after a member completes a session.

**Parameters:**
- `groupId` - Group ID
- `duration` - Session duration in seconds
- `xp` - XP earned from session

**Example:**
```typescript
await groupService.updateGroupStats(groupId, 3600, 100);
```

**Updates:**
- Adds to `totalHours`
- Adds to `groupXp`
- Recalculates `groupLevel`

---

##### `getGroupLeaderboard(): Promise<GroupLeaderboardEntry[]>`

Get all groups ranked by level.

**Returns:**
- Array of `GroupLeaderboardEntry` objects with:
  - `groupId`
  - `groupName`
  - `groupLevel`
  - `groupXp`
  - `totalHours`
  - `memberCount`
  - `rank`

**Example:**
```typescript
const leaderboard = await groupService.getGroupLeaderboard();
leaderboard.forEach((group, index) => {
  console.log(`#${index + 1} ${group.groupName} - Lv ${group.groupLevel}`);
});
```

---

##### `findPublicGroups(): Promise<Group[]>`

Get all public groups with available space.

**Returns:**
- Array of `Group` objects where:
  - `isPublic === true`
  - `members.length < maxMembers`

**Example:**
```typescript
const publicGroups = await groupService.findPublicGroups();
console.log(`${publicGroups.length} groups available to join`);
```

---

### PostService

Manages session feed posts and reactions.

#### Constructor

```typescript
constructor(db: Firestore)
```

#### Methods

##### `createPost(messageId: string, userId: string, username: string, guildId: string, channelId: string, sessionId: string, duration: number, xpGained: number, levelGained?: number, achievementsUnlocked?: string[]): Promise<void>`

Create a session post in the feed.

**Parameters:**
- `messageId` - Discord message ID
- `userId` - User who completed session
- `username` - User's username
- `guildId` - Discord server ID
- `channelId` - Feed channel ID
- `sessionId` - Completed session ID
- `duration` - Session duration in seconds
- `xpGained` - XP earned
- `levelGained` (optional) - New level if leveled up
- `achievementsUnlocked` (optional) - Array of achievement IDs unlocked

**Example:**
```typescript
await postService.createPost(
  message.id,
  userId,
  username,
  guildId,
  channelId,
  sessionId,
  3600,
  100,
  5,
  ['centurion']
);
```

**Firestore write:**
```
discord-data/sessionPosts/posts/{messageId}
{
  messageId,
  userId,
  username,
  guildId,
  channelId,
  sessionId,
  duration,
  xpGained,
  levelGained?,
  achievementsUnlocked?,
  postedAt: Timestamp.now(),
  reactions: {},
  cheers: []
}
```

---

##### `addReaction(messageId: string, emoji: string, userId: string): Promise<void>`

Add a reaction to a post.

**Parameters:**
- `messageId` - Post message ID
- `emoji` - Emoji used
- `userId` - User who reacted

**Example:**
```typescript
await postService.addReaction(message.id, '❤️', userId);
```

---

##### `removeReaction(messageId: string, emoji: string, userId: string): Promise<void>`

Remove a reaction from a post.

**Parameters:**
- `messageId` - Post message ID
- `emoji` - Emoji used
- `userId` - User who reacted

**Example:**
```typescript
await postService.removeReaction(message.id, '❤️', userId);
```

---

### EventService

Manages study events and RSVPs.

#### Constructor

```typescript
constructor(db: Firestore)
```

#### Methods

##### `createEvent(eventData: EventData): Promise<string>`

Create a new study event.

**Parameters:**
- `eventData` - Object with event details

**Returns:**
- Event ID (UUID)

**Example:**
```typescript
const eventId = await eventService.createEvent({
  serverId: guildId,
  creatorId: userId,
  creatorUsername: username,
  title: 'Library Study Session',
  location: 'Main Library',
  startTime: Timestamp.fromDate(new Date('2025-02-15T14:00:00')),
  duration: 120,
  studyType: 'silent'
});
```

---

##### `getUpcomingEvents(serverId: string): Promise<StudyEvent[]>`

Get all future events for a server.

**Parameters:**
- `serverId` - Discord server ID

**Returns:**
- Array of `StudyEvent` objects where `startTime` > now

**Example:**
```typescript
const events = await eventService.getUpcomingEvents(guildId);
events.forEach(event => {
  console.log(`${event.title} - ${event.startTime}`);
});
```

---

##### `addAttendee(eventId: string, userId: string, username: string): Promise<void>`

RSVP a user to an event.

**Parameters:**
- `eventId` - Event ID
- `userId` - User ID
- `username` - User's username

**Example:**
```typescript
await eventService.addAttendee(eventId, userId, username);
```

---

##### `removeAttendee(eventId: string, userId: string): Promise<void>`

Remove RSVP from an event.

**Parameters:**
- `eventId` - Event ID
- `userId` - User ID

**Example:**
```typescript
await eventService.removeAttendee(eventId, userId);
```

---

##### `cancelEvent(eventId: string, userId: string): Promise<void>`

Cancel an event (creator only).

**Parameters:**
- `eventId` - Event ID
- `userId` - User ID (must be creator)

**Throws:**
- Error if user is not the event creator

**Example:**
```typescript
await eventService.cancelEvent(eventId, userId);
```

---

### DailyGoalService

Manages daily goals.

#### Constructor

```typescript
constructor(db: Firestore)
```

#### Methods

##### `addGoal(userId: string, username: string, goalText: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<string>`

Add a new goal.

**Parameters:**
- `userId` - Discord user ID
- `username` - User's username
- `goalText` - Goal description
- `difficulty` - Goal difficulty (affects XP reward)

**Returns:**
- Goal ID (UUID)

**Example:**
```typescript
const goalId = await dailyGoalService.addGoal(
  userId,
  username,
  'Complete 3 React exercises',
  'medium'
);
```

**XP Rewards:**
- Easy: 10 XP
- Medium: 25 XP
- Hard: 50 XP

---

##### `getGoals(userId: string): Promise<Goal[]>`

Get all active goals for a user.

**Parameters:**
- `userId` - Discord user ID

**Returns:**
- Array of `Goal` objects

**Example:**
```typescript
const goals = await dailyGoalService.getGoals(userId);
goals.forEach(goal => {
  console.log(`${goal.text} (${goal.difficulty})`);
});
```

---

##### `completeGoal(userId: string, goalId: string): Promise<number>`

Mark a goal as completed.

**Parameters:**
- `userId` - Discord user ID
- `goalId` - Goal ID to complete

**Returns:**
- XP awarded (based on difficulty)

**Example:**
```typescript
const xp = await dailyGoalService.completeGoal(userId, goalId);
console.log(`Goal completed! +${xp} XP`);
```

---

##### `deleteGoal(userId: string, goalId: string): Promise<void>`

Delete a goal without completing it.

**Parameters:**
- `userId` - Discord user ID
- `goalId` - Goal ID to delete

**Example:**
```typescript
await dailyGoalService.deleteGoal(userId, goalId);
```

---

## Image Generation Services

All image services share a common pattern:

### ProfileImageService

Generate profile card images.

#### Methods

##### `generate(userData: ProfileData): Promise<AttachmentBuilder>`

Generate a profile card image.

**Parameters:**
- `userData` - Object with:
  - `username` - Display name
  - `avatarUrl` - Avatar URL
  - `level` - User level
  - `xp` - Total XP
  - `stats` - User stats object
  - `achievements` - Recent achievements

**Returns:**
- Discord `AttachmentBuilder` with PNG image

**Example:**
```typescript
const image = await profileImageService.generate({
  username: 'Alice',
  avatarUrl: 'https://...',
  level: 10,
  xp: 2450,
  stats: userStats,
  achievements: ['centurion', 'hot_streak']
});

await interaction.reply({ files: [image] });
```

---

### StatsImageService

Generate statistics chart images.

#### Methods

##### `generate(userData: StatsData, timeframe: string): Promise<AttachmentBuilder>`

Generate a stats chart image.

**Parameters:**
- `userData` - Object with user stats
- `timeframe` - 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'

**Returns:**
- Discord `AttachmentBuilder` with PNG image

**Example:**
```typescript
const image = await statsImageService.generate(userData, 'weekly');
await interaction.reply({ files: [image] });
```

---

### PostImageService

Generate session post images.

#### Methods

##### `generate(postData: PostData): Promise<AttachmentBuilder>`

Generate a session completion post image.

**Parameters:**
- `postData` - Object with:
  - `username`
  - `avatarUrl`
  - `title`
  - `description`
  - `duration`
  - `xpGained`
  - `level`
  - `achievementsUnlocked`

**Returns:**
- Discord `AttachmentBuilder` with PNG image

---

### GroupOverviewImageService

Generate group overview images.

#### Methods

##### `generate(groupData: GroupData): Promise<AttachmentBuilder>`

Generate a group overview card image.

**Parameters:**
- `groupData` - Object with:
  - `groupName`
  - `groupLevel`
  - `groupXp`
  - `totalHours`
  - `members` - Array of member data

**Returns:**
- Discord `AttachmentBuilder` with PNG image

---

## Utility Services

### BadgeService

Manage user badges (future feature).

### WeeklyChallengeService

Manage weekly XP challenges (future feature).

---

## Common Patterns

### Error Handling

All services throw errors that should be caught by command handlers:

```typescript
try {
  await sessionService.createActiveSession(...);
} catch (error) {
  console.error('Failed to create session:', error);
  await interaction.reply({
    content: '❌ Failed to start session. Please try again.',
    ephemeral: true
  });
}
```

### Firestore Transactions

For operations that modify multiple documents, use transactions:

```typescript
await db.runTransaction(async (transaction) => {
  // Read operations
  const sessionDoc = await transaction.get(sessionRef);
  const statsDoc = await transaction.get(statsRef);

  // Write operations
  transaction.update(statsRef, { ... });
  transaction.set(sessionRef, { ... });
});
```

### Timestamp Usage

Always use Firebase `Timestamp` for date/time fields:

```typescript
import { Timestamp } from 'firebase-admin/firestore';

const session = {
  startTime: Timestamp.now(),
  // ...
};
```

### Promise Batching

Use `Promise.all()` for parallel operations:

```typescript
const [stats, session, achievements] = await Promise.all([
  statsService.getUserStats(userId),
  sessionService.getActiveSession(userId),
  achievementService.getUserAchievements(userId)
]);
```

---

## TypeScript Interfaces

All interfaces are defined in `/src/types.ts`:

- `ActiveSession` - Active session data
- `CompletedSession` - Completed session data
- `UserStats` - User statistics
- `Group` - Study group data
- `GroupMembership` - User group membership
- `StudyEvent` - Event data
- `Goal` - Daily goal data
- `SessionPost` - Feed post data
- `AchievementDefinition` - Achievement definition

See [types.ts](/src/types.ts) for complete interface definitions.

---

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md) - System architecture overview
- [Commands Reference](./COMMANDS.md) - All available commands
- [Setup Guide](./SETUP.md) - Installation and configuration
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to Railway
