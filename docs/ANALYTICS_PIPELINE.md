# Analytics Pipeline Documentation

## Overview

The Study Together Bot Analytics Pipeline is a comprehensive system for tracking, analyzing, and visualizing user behavior. It's designed to answer critical questions like "Which features are actually used?" and "Where do users drop off?" while remaining lightweight, cost-effective, and privacy-conscious.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Discord Bot Commands                     │
│          (/start, /end, /mystats, /leaderboard, etc.)       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Analytics Middleware                       │
│             (Automatic command tracking wrapper)             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Analytics Service                         │
│  • Event batching (10 events or 5 seconds)                  │
│  • Privacy filtering (hash user IDs if needed)              │
│  • Sampling for high-volume bots                            │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Firestore                        │
│                                                              │
│  discord-data/analytics/                                    │
│  ├── events/{date}/raw/{eventId}     (7-day retention)     │
│  ├── daily/{userId}_{date}           (90-day retention)    │
│  ├── cohorts/{userId}                (permanent)            │
│  └── config/settings                 (configuration)        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Analytics Queries                          │
│  • Pre-built queries for common questions                   │
│  • DAU/WAU/MAU calculations                                 │
│  • Command health metrics                                   │
│  • Session funnel analysis                                  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Analytics Dashboard                         │
│         (Discord embeds showing key metrics)                 │
│         /analytics [overview|commands|retention|...]         │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. AnalyticsService (`analytics.service.ts`)

The core service responsible for tracking events.

**Key Features:**
- **Event batching:** Collects events and writes them in batches (default: 10 events or 5 seconds)
- **Dual storage:** Raw events (detailed) + daily aggregates (cost-effective)
- **Privacy controls:** Optional user ID hashing and command exclusions
- **Fail-safe:** Analytics errors never crash the bot

**Main Methods:**
```typescript
// Command tracking
await analyticsService.trackCommand(userId, serverId, commandName, success, responseTime);

// Session tracking
await analyticsService.trackSessionStart(userId, serverId, activity);
await analyticsService.trackSessionEnd(userId, serverId, sessionId, duration, xpGained);
await analyticsService.trackSessionCancelled(userId, serverId);

// Achievement tracking
await analyticsService.trackAchievementUnlock(userId, serverId, achievementId, name, xp);
await analyticsService.trackLevelUp(userId, serverId, oldLevel, newLevel);

// Feature usage tracking
await analyticsService.trackFeatureUsage(userId, serverId, 'leaderboard');

// Goal tracking
await analyticsService.trackGoalSet(userId, serverId, difficulty);
await analyticsService.trackGoalCompleted(userId, serverId, difficulty, xpGained);
```

### 2. AnalyticsMiddleware (`analytics.middleware.ts`)

Automatic command tracking wrapper.

**Usage:**
```typescript
const middleware = new AnalyticsMiddleware(analyticsService);

// Wrap your command handler
await middleware.trackCommand(interaction, async () => {
  // Your command logic here
  await interaction.reply('Success!');
});
```

This automatically tracks:
- Command execution time
- Success/failure status
- Error messages (if failed)
- User and server IDs

### 3. AnalyticsQueries (`analytics.queries.ts`)

Pre-built queries for common analytics questions.

**Example Queries:**
```typescript
const queries = new AnalyticsQueries(db);

// Active users
const dau = await queries.getDAU();
const wau = await queries.getWAU();
const mau = await queries.getMAU();

// Command usage
const topCommands = await queries.getTopCommands(5, 7); // Top 5 commands, last 7 days
const leastUsed = await queries.getLeastUsedCommands(5, 30); // Bottom 5, last 30 days

// Session metrics
const funnel = await queries.getSessionFunnel(7);
console.log(`Completion rate: ${funnel.completionRate * 100}%`);

// Feature adoption
const adoptionRate = await queries.getFeatureAdoptionRate('leaderboard', 30);
console.log(`${adoptionRate * 100}% of users have used leaderboards`);

// Cohort retention
const retention = await queries.getCohortRetention('2025-01-01', '2025-01-08');
console.log(`Day 7 retention: ${retention * 100}%`);
```

### 4. AnalyticsDashboard (`analytics.dashboard.ts`)

Discord embed builder for visualizing analytics.

**Usage:**
```typescript
const dashboard = new AnalyticsDashboard(queries);

// Create dashboard embed
const embed = await dashboard.createDashboardEmbed();
await interaction.reply({ embeds: [embed] });

// Or use the helper function
await handleAnalyticsCommand(interaction, queries);
```

## Firebase Schema

### Raw Events Collection
```
discord-data/analytics/events/{date}/raw/{eventId}
```

**Example Event:**
```json
{
  "eventType": "command_executed",
  "category": "command",
  "userId": "user_12345",
  "serverId": "server_67890",
  "timestamp": "2025-01-18T10:30:00Z",
  "metadata": {
    "commandName": "start",
    "success": true,
    "responseTimeMs": 250
  }
}
```

**Retention:** 7 days (auto-delete old events to save costs)

### Daily Aggregates Collection
```
discord-data/analytics/daily/{userId}_{date}
```

**Example Aggregate:**
```json
{
  "userId": "user_12345",
  "date": "2025-01-18",
  "serverId": "server_67890",
  "commandsExecuted": 15,
  "commandsFailed": 1,
  "commandBreakdown": {
    "start": 3,
    "end": 3,
    "mystats": 2,
    "leaderboard": 5,
    "time": 2
  },
  "averageResponseTimeMs": 320,
  "sessionsStarted": 3,
  "sessionsCompleted": 2,
  "sessionsCancelled": 1,
  "totalSessionDuration": 7200,
  "totalXpGained": 240,
  "viewedLeaderboard": true,
  "viewedStats": true,
  "achievementsUnlocked": 1,
  "firstActiveAt": "2025-01-18T08:00:00Z",
  "lastActiveAt": "2025-01-18T22:00:00Z"
}
```

**Retention:** 90 days

### User Cohorts Collection
```
discord-data/analytics/cohorts/{userId}
```

**Example Cohort:**
```json
{
  "userId": "user_12345",
  "username": "Anonymous",
  "firstSeenAt": "2025-01-01T10:00:00Z",
  "firstSeenDate": "2025-01-01",
  "cohortWeek": "2025-W01",
  "cohortMonth": "2025-01",
  "serverId": "server_67890"
}
```

**Retention:** Permanent (used for cohort retention analysis)

## Setup Instructions

### Phase 1: Basic Command Tracking (Week 1)

**Goal:** Track which commands users execute and how often.

#### Step 1: Initialize Analytics Service

In `src/bot.ts`, add the analytics service:

```typescript
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsMiddleware } from './services/analytics.middleware';

// After initializing Firebase
const analyticsService = new AnalyticsService(db);
const analyticsMiddleware = new AnalyticsMiddleware(analyticsService);

// Ensure events are flushed on shutdown
process.on('SIGINT', async () => {
  console.log('Flushing analytics...');
  await analyticsService.flush();
  process.exit(0);
});
```

#### Step 2: Wrap Command Handlers

**Option A: Automatic Tracking (Recommended)**

Wrap your entire command handler:

```typescript
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  await analyticsMiddleware.trackCommand(interaction, async () => {
    const { commandName } = interaction;

    // Your existing command handlers
    if (commandName === 'start') {
      // ... existing logic
    } else if (commandName === 'end') {
      // ... existing logic
    }
    // ... etc
  });
});
```

**Option B: Manual Tracking (More Control)**

Track specific commands individually:

```typescript
if (commandName === 'start') {
  const startTime = Date.now();
  let success = true;

  try {
    // Your existing logic
    await interaction.reply({ content: 'Session started!', ephemeral: true });
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const responseTime = Date.now() - startTime;
    await analyticsService.trackCommand(
      interaction.user.id,
      interaction.guildId || 'DM',
      'start',
      success,
      responseTime
    );
  }
}
```

#### Step 3: Add Analytics Dashboard Command

Add the `/analytics` command to your command list:

```typescript
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
        { name: 'Quick Stats', value: 'quick' }
      )
  ),
```

Add the command handler:

```typescript
import { AnalyticsQueries } from './services/analytics.queries';
import { handleAnalyticsCommand } from './services/analytics.dashboard';

const analyticsQueries = new AnalyticsQueries(db);

// In your command handler
if (commandName === 'analytics') {
  await handleAnalyticsCommand(interaction, analyticsQueries);
  return;
}
```

#### Step 4: Test the Setup

1. Run the bot: `npm run dev`
2. Execute a few commands in Discord (`/start`, `/mystats`, etc.)
3. Wait 5-10 seconds for events to batch
4. Run `/analytics quick` to see today's stats

### Phase 2: Feature Adoption Tracking (Week 2)

**Goal:** Track which features users engage with beyond just commands.

#### Step 1: Track Session Lifecycle

In `SessionService.createActiveSession()`:

```typescript
async createActiveSession(
  userId: string,
  username: string,
  serverId: string,
  activity: string,
  intensity?: number
): Promise<void> {
  // ... existing session creation logic

  // Track analytics
  await this.analyticsService.trackSessionStart(userId, serverId, activity, intensity);
}
```

In `SessionService` when ending a session:

```typescript
async endSession(userId: string, sessionId: string, ...): Promise<void> {
  // ... existing end logic

  await this.analyticsService.trackSessionEnd(
    userId,
    serverId,
    sessionId,
    duration,
    xpGained,
    intensity
  );
}
```

#### Step 2: Track Achievement Unlocks

In `AchievementService.checkAndUnlockAchievements()`:

```typescript
const newAchievements = await this.checkAndUnlockAchievements(userId);

for (const achievement of newAchievements) {
  await this.analyticsService.trackAchievementUnlock(
    userId,
    serverId,
    achievement.id,
    achievement.name,
    achievement.xpReward
  );
}
```

#### Step 3: Track Feature Views

Add tracking to leaderboard, stats, and feed commands:

```typescript
if (commandName === 'leaderboard' || commandName === 'd' || commandName === 'w' || commandName === 'm') {
  await analyticsService.trackFeatureUsage(user.id, interaction.guildId || 'DM', 'leaderboard');
  // ... existing logic
}

if (commandName === 'mystats') {
  await analyticsService.trackFeatureUsage(user.id, interaction.guildId || 'DM', 'stats');
  // ... existing logic
}
```

#### Step 4: View Feature Adoption

Run `/analytics features` to see which features are most used.

### Phase 3: Advanced Analysis (Week 3)

**Goal:** Identify drop-off points, segment users, and set up automated alerts.

#### Step 1: Analyze Session Funnel

Run `/analytics sessions` to see:
- How many sessions are started vs. completed
- Session completion rate
- Average session duration and XP

**Action:** If completion rate < 70%, investigate why users are cancelling sessions.

#### Step 2: Review Command Health

Run `/analytics commands` to identify:
- **Error-prone commands:** Success rate < 90%
- **Underutilized commands:** < 10 uses/week
- **Slow commands:** > 3 seconds average response time

**Action:** Fix or remove problematic commands.

#### Step 3: Check Retention Metrics

Run `/analytics retention` to see:
- DAU/WAU/MAU trends
- DAU/WAU ratio (should be >20% for good engagement)
- WAU/MAU ratio (should be >40% for good retention)

**Action:** If ratios are low, improve onboarding or add engagement features.

## How to Add New Tracking Points

### Example: Track a New Feature

1. **Choose the event type** (or create a new one in `analytics.types.ts`):
```typescript
export enum AnalyticsEventType {
  // ... existing types
  POMODORO_STARTED = 'pomodoro_started',
}
```

2. **Add tracking method** to `AnalyticsService`:
```typescript
async trackPomodoroStart(userId: string, serverId: string, focusMinutes: number): Promise<void> {
  const event: AnalyticsEvent = {
    eventType: AnalyticsEventType.POMODORO_STARTED,
    category: AnalyticsCategory.SESSION,
    userId: this.hashUserId(userId),
    serverId,
    timestamp: Timestamp.now(),
    metadata: {
      focusMinutes,
    },
  };

  await this.addEventToBatch(event);
}
```

3. **Call the tracking method** in your feature code:
```typescript
// In your pomodoro command handler
await analyticsService.trackPomodoroStart(user.id, serverId, focusMinutes);
```

4. **Update daily aggregates** (if needed) in `calculateDailyUpdates()`:
```typescript
if (e.eventType === AnalyticsEventType.POMODORO_STARTED) {
  updates.pomodoroSessionsStarted = FieldValue.increment(1);
}
```

5. **Create a query** (optional) in `AnalyticsQueries`:
```typescript
async getPomodoroUsage(days: number = 7): Promise<number> {
  // Query logic here
}
```

## Performance & Cost Optimization

### Cost Breakdown (Estimated)

**Assumptions:**
- 100 active users/day
- 10 commands/user/day
- 1000 total commands/day

**Firestore Operations:**
- **Writes:** 1000 events/day + 100 daily aggregates = 1,100 writes/day
- **Reads:** ~50 dashboard views/day × 100 docs = 5,000 reads/day

**Monthly Cost:**
- Writes: 33,000/month × $0.18/million = **$0.006**
- Reads: 150,000/month × $0.06/million = **$0.009**
- **Total: ~$0.02/month** (well within free tier)

### Optimization Tips

1. **Use batching:** Events are automatically batched (10 events or 5 seconds)
2. **Query daily aggregates:** Avoid querying raw events directly
3. **Limit date ranges:** Only query what you need (7 days instead of 30)
4. **Use sampling:** Set `sampleRate: 0.1` to track 10% of events for large bots

### Scaling for High Volume

If your bot has 1000+ DAU:

```typescript
await analyticsService.updateConfig({
  sampleRate: 0.1, // Track 10% of events
  rawEventRetentionDays: 3, // Keep raw events for 3 days instead of 7
  batchSize: 20, // Larger batches
});
```

## Troubleshooting

### Events Not Being Tracked

**Check 1:** Is analytics enabled?
```typescript
const config = analyticsService.getConfig();
console.log('Analytics enabled:', config.enabled);
```

**Check 2:** Are events being batched?
```typescript
// Force flush to see if events appear
await analyticsService.flush();
```

**Check 3:** Check Firestore console
- Navigate to `discord-data/analytics/events/{today}/raw`
- Should see event documents

### Dashboard Shows No Data

**Check 1:** Wait for daily aggregates to update (up to 5 seconds after first event)

**Check 2:** Query raw events directly:
```typescript
const db = admin.firestore();
const today = new Date().toISOString().split('T')[0];
const snapshot = await db
  .collection('discord-data')
  .doc('analytics')
  .collection('events')
  .doc(today)
  .collection('raw')
  .get();
console.log(`Found ${snapshot.size} events today`);
```

### High Firestore Costs

**Check 1:** Review query patterns
```typescript
// Bad: Full collection scan
const snapshot = await db.collection('discord-data/analytics/daily').get();

// Good: Filter by date
const snapshot = await db
  .collection('discord-data/analytics/daily')
  .where('date', '>=', startDate)
  .get();
```

**Check 2:** Enable sampling
```typescript
await analyticsService.updateConfig({ sampleRate: 0.1 });
```

## Next Steps

1. **Week 1:** Implement Phase 1 (command tracking)
2. **Week 2:** Add Phase 2 (feature adoption)
3. **Week 3:** Analyze data, identify improvements
4. **Week 4:** Set up weekly automated reports (future enhancement)

## Additional Resources

- [ANALYTICS_QUERIES.md](./ANALYTICS_QUERIES.md) - Query examples and use cases
- [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) - Data collection and privacy info
- [Firestore Pricing](https://firebase.google.com/pricing) - Cost calculator
