# Analytics Integration Guide

This guide shows **exactly** where to add analytics tracking to your existing Study Together Bot codebase.

## Quick Start (5 Minutes)

### Step 1: Initialize Services

**File:** `src/bot.ts`

**Location:** After initializing Firebase and existing services (around line 86)

**Add:**
```typescript
// Existing services
const sessionService = new SessionService(db);
const statsService = new StatsService(db);
const achievementService = new AchievementService(db);
const postService = new PostService(db);
const dailyGoalService = new DailyGoalService(db);
const xpService = new XPService(db);

// ADD: Analytics services
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsMiddleware } from './services/analytics.middleware';
import { AnalyticsQueries } from './services/analytics.queries';

const analyticsService = new AnalyticsService(db);
const analyticsMiddleware = new AnalyticsMiddleware(analyticsService);
const analyticsQueries = new AnalyticsQueries(db);
```

### Step 2: Add Shutdown Hook

**File:** `src/bot.ts`

**Location:** At the end of the file, after `client.login()`

**Add:**
```typescript
// Ensure analytics events are flushed on shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down...');
  console.log('📊 Flushing analytics events...');
  await analyticsService.flush();
  console.log('✅ Cleanup complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down...');
  await analyticsService.flush();
  process.exit(0);
});
```

### Step 3: Wrap Command Handler

**File:** `src/bot.ts`

**Location:** In the `interactionCreate` event handler (around line 200)

**Change:**
```typescript
// BEFORE:
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  const user = interaction.user;

  // Command handlers...
});

// AFTER:
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  await analyticsMiddleware.trackCommand(interaction, async () => {
    const { commandName } = interaction;
    const user = interaction.user;

    // All your existing command handlers go here (unchanged)
  });
});
```

**That's it for Phase 1!** All commands are now automatically tracked.

---

## Phase 2: Session Tracking

### Track Session Start

**File:** `src/services/sessions.ts`

**Location:** In `createActiveSession()` method (around line 67)

**Add:**
```typescript
async createActiveSession(
  userId: string,
  username: string,
  serverId: string,
  activity: string,
  intensity?: number // Add this parameter if not present
): Promise<void> {
  const session: ActiveSession = {
    userId,
    username,
    serverId,
    activity,
    startTime: Timestamp.now(),
    isPaused: false,
    pausedDuration: 0,
    intensity, // Add this field
  };

  await this.db
    .collection('discord-data')
    .doc('activeSessions')
    .collection('sessions')
    .doc(userId)
    .set(session);

  // ADD: Track analytics
  if (this.analyticsService) {
    await this.analyticsService.trackSessionStart(userId, serverId, activity, intensity);
  }
}
```

**First, add analyticsService to the constructor:**
```typescript
export class SessionService {
  private db: Firestore;
  private analyticsService?: AnalyticsService; // ADD

  constructor(db: Firestore, analyticsService?: AnalyticsService) { // ADD parameter
    this.db = db;
    this.analyticsService = analyticsService; // ADD
  }
  // ... rest of class
}
```

**Update initialization in `src/bot.ts`:**
```typescript
// BEFORE:
const sessionService = new SessionService(db);

// AFTER:
const analyticsService = new AnalyticsService(db);
const sessionService = new SessionService(db, analyticsService);
```

### Track Session End

**File:** `src/bot.ts` (in the `/end` command handler)

**Location:** After posting to feed channel, before final reply (search for `commandName === 'end'`)

**Add:**
```typescript
// Existing code: calculate duration, XP, etc.
const duration = calculateDuration(session.startTime, Timestamp.now(), pausedDuration);
const xpGained = /* ... your XP calculation ... */;

// Post to feed channel (existing code)
await postService.postSessionToFeed(/* ... */);

// ADD: Track analytics
await analyticsService.trackSessionEnd(
  user.id,
  interaction.guildId || 'DM',
  sessionDoc.id, // session ID
  duration,
  xpGained,
  session.intensity
);

// Existing reply
await interaction.editReply({ /* ... */ });
```

### Track Session Cancel

**File:** `src/bot.ts` (in the `/cancel` command handler)

**Location:** After deleting active session, before reply (search for `commandName === 'cancel'`)

**Add:**
```typescript
// Delete active session (existing code)
await sessionService.deleteActiveSession(user.id);

// ADD: Track analytics
await analyticsService.trackSessionCancelled(
  user.id,
  interaction.guildId || 'DM'
);

// Existing reply
await interaction.reply({ /* ... */ });
```

### Track Session Pause/Resume

**File:** `src/bot.ts`

**In `/pause` handler:**
```typescript
// After updating session to paused state
await analyticsService.trackSessionPaused(
  user.id,
  interaction.guildId || 'DM'
);
```

**In `/resume` handler:**
```typescript
// After updating session to resumed state
await analyticsService.trackSessionResumed(
  user.id,
  interaction.guildId || 'DM'
);
```

---

## Phase 3: Achievement & XP Tracking

### Track Achievement Unlocks

**File:** `src/services/achievements.ts`

**Location:** In the method that unlocks achievements (look for where achievements are added to user stats)

**Add analyticsService to constructor:**
```typescript
export class AchievementService {
  private db: Firestore;
  private analyticsService?: AnalyticsService; // ADD

  constructor(db: Firestore, analyticsService?: AnalyticsService) { // ADD parameter
    this.db = db;
    this.analyticsService = analyticsService; // ADD
  }
}
```

**Update initialization in `src/bot.ts`:**
```typescript
const achievementService = new AchievementService(db, analyticsService);
```

**Track unlocks:**
```typescript
// After unlocking achievement
const achievement = getAchievement(achievementId);

if (this.analyticsService) {
  await this.analyticsService.trackAchievementUnlock(
    userId,
    serverId,
    achievement.id,
    achievement.name,
    achievement.xpReward
  );
}
```

### Track Level Ups

**File:** `src/bot.ts` (in the `/end` command handler, after XP calculation)

**Location:** After calculating new level, before posting to feed

**Add:**
```typescript
// Existing code
const oldLevel = calculateLevel(existingXp);
const newXp = existingXp + xpGained;
const newLevel = calculateLevel(newXp);

// ADD: Track level up
if (newLevel > oldLevel) {
  await analyticsService.trackLevelUp(
    user.id,
    interaction.guildId || 'DM',
    oldLevel,
    newLevel
  );
}
```

---

## Phase 4: Feature Usage Tracking

### Track Leaderboard Views

**File:** `src/bot.ts`

**Location:** In all leaderboard commands (`/leaderboard`, `/d`, `/w`, `/m`)

**Add at the start of each handler:**
```typescript
if (commandName === 'leaderboard' || commandName === 'd' || commandName === 'w' || commandName === 'm') {
  // ADD: Track feature usage
  await analyticsService.trackFeatureUsage(
    user.id,
    interaction.guildId || 'DM',
    'leaderboard'
  );

  // Existing leaderboard logic...
}
```

### Track Stats Views

**File:** `src/bot.ts`

**Location:** In the `/mystats` command handler

**Add:**
```typescript
if (commandName === 'mystats') {
  // ADD: Track feature usage
  await analyticsService.trackFeatureUsage(
    user.id,
    interaction.guildId || 'DM',
    'stats'
  );

  // Existing stats logic...
}
```

### Track Goal Setting

**File:** `src/bot.ts`

**Location:** In the `/goal` command handler (after goal is set)

**Add:**
```typescript
// After creating goal
await dailyGoalService.setGoal(user.id, username, goalText, difficulty);

// ADD: Track analytics
await analyticsService.trackGoalSet(
  user.id,
  interaction.guildId || 'DM',
  difficulty
);
```

### Track Goal Completion

**File:** `src/bot.ts`

**Location:** In the goal completion handler (button interaction or `/complete-goal`)

**Add:**
```typescript
// After marking goal as complete
await dailyGoalService.completeGoal(user.id, goalId);

// ADD: Track analytics
await analyticsService.trackGoalCompleted(
  user.id,
  interaction.guildId || 'DM',
  goal.difficulty,
  xpAwarded
);
```

---

## Phase 5: Dashboard Command

### Add Analytics Slash Command

**File:** `src/bot.ts`

**Location:** In the `commands` array (around line 100-200)

**Add:**
```typescript
const commands = [
  // ... existing commands ...

  // ADD: Analytics dashboard command
  new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('[Admin] View bot usage analytics')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('report')
        .setDescription('Type of report to view')
        .setRequired(false)
        .addChoices(
          { name: 'Overview', value: 'overview' },
          { name: 'Command Health', value: 'commands' },
          { name: 'User Retention', value: 'retention' },
          { name: 'Session Funnel', value: 'sessions' },
          { name: 'Feature Adoption', value: 'features' },
          { name: 'Quick Stats (Today)', value: 'quick' }
        )
    ),
];
```

### Add Analytics Command Handler

**File:** `src/bot.ts`

**Location:** In the command handler section (with other `if (commandName === ...)` blocks)

**Add:**
```typescript
import { handleAnalyticsCommand } from './services/analytics.dashboard';

// In command handler
if (commandName === 'analytics') {
  await handleAnalyticsCommand(interaction, analyticsQueries);
  return;
}
```

---

## Testing Your Integration

### Test Phase 1: Command Tracking

1. **Start the bot:** `npm run dev`
2. **Execute a command:** `/start activity: Testing analytics`
3. **Wait 5 seconds** (for batch to flush)
4. **Check Firestore:**
   - Navigate to `discord-data/analytics/events/{today}/raw`
   - You should see event documents with `eventType: "command_executed"`

5. **View dashboard:** `/analytics quick`
   - Should show today's command usage

### Test Phase 2: Session Tracking

1. **Start a session:** `/start activity: Test session`
2. **End the session:** `/end`
3. **Check dashboard:** `/analytics sessions`
   - Should show 1 session completed
   - Should show completion rate

### Test Phase 3: Achievement Tracking

1. **Complete a session** that unlocks an achievement
2. **Check dashboard:** `/analytics overview`
   - Should show achievements unlocked count

### Test Phase 4: Feature Usage

1. **View leaderboard:** `/leaderboard`
2. **View stats:** `/mystats`
3. **Check dashboard:** `/analytics features`
   - Should show leaderboard and stats usage

### Test Phase 5: Full Dashboard

1. **Run:** `/analytics overview`
2. **Verify sections appear:**
   - Active Users (DAU/WAU/MAU)
   - Sessions (started, completed, cancelled)
   - Top Commands
   - Feature Usage

---

## Troubleshooting Integration Issues

### Commands Not Being Tracked

**Problem:** `/analytics quick` shows no data

**Solution:**
1. Check that `analyticsMiddleware.trackCommand()` wraps your command handler
2. Verify imports are correct:
   ```typescript
   import { AnalyticsService } from './services/analytics.service';
   import { AnalyticsMiddleware } from './services/analytics.middleware';
   ```
3. Force flush and check Firestore:
   ```typescript
   await analyticsService.flush();
   ```

### Sessions Not Being Tracked

**Problem:** Session funnel shows 0 sessions

**Solution:**
1. Verify `SessionService` has `analyticsService` parameter in constructor
2. Check that `trackSessionEnd()` is called in `/end` handler
3. Add debug logging:
   ```typescript
   console.log('[Analytics] Tracking session end:', userId);
   await analyticsService.trackSessionEnd(/* ... */);
   ```

### Analytics Command Not Appearing

**Problem:** `/analytics` command doesn't show up in Discord

**Solution:**
1. Make sure you registered commands: `npm run register-commands` (if you have this script)
2. Or restart bot and wait for Discord to update (can take 1 hour)
3. Check command is in `commands` array before `rest.put()`

### Dashboard Shows "Failed to generate report"

**Problem:** `/analytics overview` returns error

**Solution:**
1. Check error message in console logs
2. Verify Firestore permissions allow bot to read `discord-data/analytics`
3. Test individual queries:
   ```typescript
   const dau = await analyticsQueries.getDAU();
   console.log('DAU:', dau);
   ```

---

## Rollback Plan (If Needed)

If analytics causes issues, you can quickly disable it:

### Option 1: Disable Tracking (Keep Code)

**File:** `src/bot.ts`

**Add at the top:**
```typescript
const ANALYTICS_ENABLED = false; // Set to false to disable

// In command handler:
if (ANALYTICS_ENABLED) {
  await analyticsMiddleware.trackCommand(interaction, async () => {
    // command logic
  });
} else {
  // command logic (direct, no wrapper)
}
```

### Option 2: Remove Analytics Completely

1. **Remove imports** from `src/bot.ts`:
   ```typescript
   // DELETE these lines:
   import { AnalyticsService } from './services/analytics.service';
   import { AnalyticsMiddleware } from './services/analytics.middleware';
   import { AnalyticsQueries } from './services/analytics.queries';
   ```

2. **Remove initialization:**
   ```typescript
   // DELETE these lines:
   const analyticsService = new AnalyticsService(db);
   const analyticsMiddleware = new AnalyticsMiddleware(analyticsService);
   const analyticsQueries = new AnalyticsQueries(db);
   ```

3. **Unwrap command handler:**
   ```typescript
   // Remove the analyticsMiddleware.trackCommand() wrapper
   ```

4. **Remove tracking calls** from session/achievement services

5. **Restart bot**

---

## Performance Impact

**Expected overhead:**
- Command execution: **+5-10ms** (batching overhead)
- Session operations: **+2-5ms** (async tracking, non-blocking)
- Memory usage: **+1-2 MB** (event batch buffer)
- Firestore writes: **+1,100/day** (100 users × 10 commands + 100 aggregates)
- Firestore reads: **~100/day** (dashboard views)

**Total cost:** <$0.02/month for 100 DAU

---

## Next Steps

1. ✅ **Phase 1 (Week 1):** Complete command tracking integration
2. ✅ **Phase 2 (Week 2):** Add session lifecycle tracking
3. ✅ **Phase 3 (Week 3):** Add achievement and feature tracking
4. 📊 **Week 4:** Analyze data, identify improvements
5. 🚀 **Week 5:** Implement improvements based on analytics insights

For more details:
- [ANALYTICS_PIPELINE.md](./ANALYTICS_PIPELINE.md) - System architecture
- [ANALYTICS_QUERIES.md](./ANALYTICS_QUERIES.md) - Query examples
- [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) - Privacy and compliance

---

## Quick Reference: All Integration Points

| Feature | File | Method/Location | Tracking Call |
|---------|------|----------------|---------------|
| **All commands** | `bot.ts` | `interactionCreate` event | `analyticsMiddleware.trackCommand()` |
| Session start | `sessions.ts` | `createActiveSession()` | `trackSessionStart()` |
| Session end | `bot.ts` | `/end` handler | `trackSessionEnd()` |
| Session cancel | `bot.ts` | `/cancel` handler | `trackSessionCancelled()` |
| Session pause | `bot.ts` | `/pause` handler | `trackSessionPaused()` |
| Session resume | `bot.ts` | `/resume` handler | `trackSessionResumed()` |
| Achievement unlock | `achievements.ts` | Achievement unlock logic | `trackAchievementUnlock()` |
| Level up | `bot.ts` | `/end` handler (XP calc) | `trackLevelUp()` |
| Leaderboard view | `bot.ts` | `/leaderboard`, `/d`, `/w`, `/m` | `trackFeatureUsage('leaderboard')` |
| Stats view | `bot.ts` | `/mystats` handler | `trackFeatureUsage('stats')` |
| Goal set | `bot.ts` | `/goal` handler | `trackGoalSet()` |
| Goal complete | `bot.ts` | Goal completion handler | `trackGoalCompleted()` |
| **Dashboard** | `bot.ts` | `/analytics` handler | `handleAnalyticsCommand()` |

**Total integration time:** 30-60 minutes

**Lines of code added:** ~50 lines (excluding service files)

**Breaking changes:** None (all tracking is additive)
