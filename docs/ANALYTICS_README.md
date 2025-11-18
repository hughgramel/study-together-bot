# Study Together Bot - Analytics Pipeline

## Overview

This analytics system helps you answer critical questions about your Discord bot:

- ✅ **Which commands are actually used?** vs. which are dead weight
- ✅ **Where do users drop off?** in session flows, onboarding, features
- ✅ **Are new features helping?** measured by DAU/WAU/MAU changes
- ✅ **What % of users try each feature?** adoption rates for leaderboards, goals, etc.
- ✅ **Are changes working?** compare before/after metrics for XP, achievements, etc.

## What's Included

### TypeScript Services (5 files)
Located in `src/services/`:

1. **`analytics.types.ts`** - Type definitions for events, aggregates, and configuration
2. **`analytics.service.ts`** - Core tracking service with batching and privacy controls
3. **`analytics.middleware.ts`** - Automatic command tracking wrapper
4. **`analytics.queries.ts`** - Pre-built queries for common analytics questions
5. **`analytics.dashboard.ts`** - Discord embed builder for visualizing metrics

### Documentation (4 files)
Located in `docs/`:

1. **`ANALYTICS_PIPELINE.md`** - Complete system architecture and setup guide
2. **`ANALYTICS_QUERIES.md`** - Real-world query examples and use cases
3. **`ANALYTICS_INTEGRATION_GUIDE.md`** - Exact integration points in your codebase
4. **`PRIVACY_POLICY.md`** - Data collection, storage, and user rights

## Quick Start (5 Minutes)

### Step 1: Add Services to Your Bot

**File:** `src/bot.ts` (after line 86)

```typescript
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsMiddleware } from './services/analytics.middleware';
import { AnalyticsQueries } from './services/analytics.queries';

const analyticsService = new AnalyticsService(db);
const analyticsMiddleware = new AnalyticsMiddleware(analyticsService);
const analyticsQueries = new AnalyticsQueries(db);
```

### Step 2: Wrap Your Command Handler

**File:** `src/bot.ts` (in `interactionCreate` event)

```typescript
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  // Wrap with analytics tracking
  await analyticsMiddleware.trackCommand(interaction, async () => {
    const { commandName } = interaction;
    const user = interaction.user;

    // All your existing command handlers (unchanged)
    if (commandName === 'start') { /* ... */ }
    else if (commandName === 'end') { /* ... */ }
    // ... etc
  });
});
```

### Step 3: Add Analytics Dashboard Command

**File:** `src/bot.ts` (in commands array)

```typescript
import { handleAnalyticsCommand } from './services/analytics.dashboard';

// Add to slash commands
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

// Add command handler
if (commandName === 'analytics') {
  await handleAnalyticsCommand(interaction, analyticsQueries);
  return;
}
```

### Step 4: Test It

1. Start your bot: `npm run dev`
2. Run a command: `/start activity: Testing`
3. Wait 5 seconds (for event batching)
4. View analytics: `/analytics quick`

You should see today's command usage stats!

## What Gets Tracked?

### ✅ Automatically Tracked (Phase 1 - 5 mins)

Once you wrap your command handler:
- **Command execution:** Which commands, how often, success rate
- **Response time:** Average, slowest commands
- **Errors:** Failed commands with error messages
- **Active users:** DAU/WAU/MAU automatically calculated

### 📊 Manual Tracking (Phase 2 - 30 mins)

Add these tracking calls to your existing code:

**Session lifecycle:**
```typescript
await analyticsService.trackSessionStart(userId, serverId, activity);
await analyticsService.trackSessionEnd(userId, serverId, sessionId, duration, xpGained);
await analyticsService.trackSessionCancelled(userId, serverId);
```

**Achievements & XP:**
```typescript
await analyticsService.trackAchievementUnlock(userId, serverId, achievementId, name, xp);
await analyticsService.trackLevelUp(userId, serverId, oldLevel, newLevel);
```

**Feature usage:**
```typescript
await analyticsService.trackFeatureUsage(userId, serverId, 'leaderboard');
await analyticsService.trackFeatureUsage(userId, serverId, 'stats');
```

**Goals:**
```typescript
await analyticsService.trackGoalSet(userId, serverId, difficulty);
await analyticsService.trackGoalCompleted(userId, serverId, difficulty, xpGained);
```

See `ANALYTICS_INTEGRATION_GUIDE.md` for exact code locations.

## Dashboard Commands

Run `/analytics` with different report types:

| Command | What It Shows |
|---------|--------------|
| `/analytics overview` | Main dashboard with all key metrics |
| `/analytics commands` | Command health (errors, underused, slow) |
| `/analytics retention` | DAU/WAU/MAU and retention rates |
| `/analytics sessions` | Session completion funnel |
| `/analytics features` | Feature adoption rates |
| `/analytics quick` | Today's quick stats |

## Example Queries

```typescript
import { AnalyticsQueries } from './services/analytics.queries';
const queries = new AnalyticsQueries(db);

// Active users
const dau = await queries.getDAU();
const wau = await queries.getWAU();
const mau = await queries.getMAU();

// Top commands
const topCommands = await queries.getTopCommands(5, 7); // Top 5, last 7 days

// Session metrics
const funnel = await queries.getSessionFunnel(7);
console.log(`Completion rate: ${funnel.completionRate * 100}%`);

// Feature adoption
const adoptionRate = await queries.getFeatureAdoptionRate('leaderboard', 30);

// Full dashboard
const summary = await queries.getDashboardSummary();
```

See `ANALYTICS_QUERIES.md` for 20+ real-world query examples.

## Firebase Schema

```
discord-data/analytics/
├── events/{date}/raw/{eventId}        # Raw events (7-day retention)
│   └── {
│       "eventType": "command_executed",
│       "userId": "user_123",
│       "serverId": "server_456",
│       "timestamp": "2025-01-18T10:00:00Z",
│       "metadata": { "commandName": "start", "success": true }
│     }
│
├── daily/{userId}_{date}              # Daily aggregates (90-day retention)
│   └── {
│       "commandsExecuted": 15,
│       "sessionsCompleted": 3,
│       "totalXpGained": 240,
│       "viewedLeaderboard": true
│     }
│
├── cohorts/{userId}                   # User cohorts (permanent)
│   └── {
│       "firstSeenAt": "2025-01-01T10:00:00Z",
│       "cohortWeek": "2025-W01"
│     }
│
└── config/settings                    # Analytics configuration
    └── {
        "enabled": true,
        "sampleRate": 1.0,
        "rawEventRetentionDays": 7
      }
```

## Cost Estimate

**For 100 active users/day:**
- Writes: 1,100/day × 30 = 33,000/month
- Reads: ~5,000/month (dashboard views)
- **Total: ~$0.02/month** (well within Firebase free tier)

**Optimization tips:**
- Events are batched (10 events or 5 seconds)
- Raw events auto-delete after 7 days
- Query daily aggregates, not raw events
- Enable sampling for high-volume bots

## Privacy & Compliance

**What's tracked:**
- ✅ User IDs (anonymizable)
- ✅ Command names and execution times
- ✅ Session durations and XP
- ✅ Feature usage flags

**What's NOT tracked:**
- ❌ Message content
- ❌ Voice chat audio
- ❌ Session descriptions
- ❌ Personal information
- ❌ Private server details

**User rights:**
- `/analytics opt-out` - Stop tracking your data
- `/analytics delete-my-data` - Delete all your analytics data
- `/analytics export-my-data` - Download your data as JSON

See `PRIVACY_POLICY.md` for full details.

## Phased Rollout

### Phase 1: Basic Command Tracking (Week 1) ✅
**Time:** 5 minutes
**Complexity:** Easy
**Impact:** Answer "Which commands are used?"

1. Add analytics services to `bot.ts`
2. Wrap command handler with `analyticsMiddleware.trackCommand()`
3. Add `/analytics` command
4. Test with `/analytics quick`

### Phase 2: Feature Adoption (Week 2) 📊
**Time:** 30 minutes
**Complexity:** Medium
**Impact:** Answer "Which features are adopted?"

1. Track session lifecycle (start, end, cancel)
2. Track feature views (leaderboard, stats, feed)
3. Track goal setting and completion
4. View with `/analytics features`

### Phase 3: Advanced Analysis (Week 3) 🚀
**Time:** 1 hour
**Complexity:** Medium-Hard
**Impact:** Answer "Where do users drop off?"

1. Track achievement unlocks and level ups
2. Analyze session completion funnel
3. Calculate cohort retention
4. Review command health
5. Identify underutilized features

## Troubleshooting

### No data in dashboard
1. Check that events are being tracked: `await analyticsService.flush()`
2. Verify Firestore permissions allow reads
3. Wait 5-10 seconds for batch flush

### Commands not tracked
1. Ensure `analyticsMiddleware.trackCommand()` wraps your handler
2. Check imports are correct
3. Look for errors in console logs

### High Firestore costs
1. Enable sampling: `analyticsService.updateConfig({ sampleRate: 0.1 })`
2. Reduce retention: `rawEventRetentionDays: 3`
3. Query daily aggregates, not raw events

See `ANALYTICS_INTEGRATION_GUIDE.md` for detailed troubleshooting.

## Real-World Use Cases

This analytics system helps you answer questions like:

1. **"Should I remove the `/compare` command? Nobody uses it."**
   - Run: `queries.getLeastUsedCommands(10, 30)`
   - If < 10 uses in 30 days → remove it

2. **"Did the new achievement system increase daily active users?"**
   - Compare DAU before/after launch
   - Check: `/analytics retention`

3. **"What % of users who start a session actually complete it vs. cancel?"**
   - Run: `queries.getSessionFunnel(7)`
   - Check completion rate

4. **"Which servers are most active? Should I focus growth there?"**
   - Custom query: Group by `serverId`, sort by activity

5. **"Are power users (Level 50+) using different features than newbies?"**
   - Custom query: Segment by XP level, compare feature usage

See `ANALYTICS_QUERIES.md` for query examples for all these questions.

## Architecture Diagram

```
┌─────────────┐
│   Discord   │
│   Commands  │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│   Analytics         │
│   Middleware        │ ← Wraps all commands
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Analytics         │
│   Service           │ ← Batches events
│   (Batching)        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Firebase          │
│   Firestore         │ ← Stores events & aggregates
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Analytics         │
│   Queries           │ ← Pre-built queries
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Analytics         │
│   Dashboard         │ ← Discord embeds
│   (/analytics)      │
└─────────────────────┘
```

## File Structure

```
src/services/
├── analytics.service.ts      # Core tracking service
├── analytics.middleware.ts   # Command wrapper
├── analytics.queries.ts      # Pre-built queries
├── analytics.dashboard.ts    # Discord embeds
└── analytics.types.ts        # TypeScript types

docs/
├── ANALYTICS_README.md              # This file
├── ANALYTICS_PIPELINE.md            # Architecture & setup
├── ANALYTICS_QUERIES.md             # Query examples
├── ANALYTICS_INTEGRATION_GUIDE.md   # Integration steps
└── PRIVACY_POLICY.md                # Privacy & compliance
```

## Success Criteria

The analytics pipeline is successful if:

1. ✅ You can answer "which features are actually used?" in under 2 minutes
2. ✅ You can identify a failing feature before users complain
3. ✅ Implementation takes under 1 day for Phase 1
4. ✅ Firebase costs increase by less than $10/month
5. ✅ You actually check the dashboard weekly for 3+ months

## Next Steps

1. **Now:** Complete Phase 1 integration (5 minutes)
2. **Week 1:** Run `/analytics quick` daily to verify tracking
3. **Week 2:** Add Phase 2 tracking (session lifecycle)
4. **Week 3:** Analyze data, identify top 3 improvements
5. **Week 4:** Implement improvements, measure impact

## Support

- **Full Documentation:** See `docs/ANALYTICS_PIPELINE.md`
- **Query Examples:** See `docs/ANALYTICS_QUERIES.md`
- **Integration Help:** See `docs/ANALYTICS_INTEGRATION_GUIDE.md`
- **Privacy Questions:** See `docs/PRIVACY_POLICY.md`

---

**Built for solo developers.** No complex data science tools required. No external dependencies. Just TypeScript, Firebase, and actionable insights.

**Let the data guide your decisions.** 📊
