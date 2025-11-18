# Analytics Queries - Real-World Examples

This document provides ready-to-use query examples for answering common analytics questions about your Study Together Bot.

## Table of Contents

1. [Command Usage Queries](#command-usage-queries)
2. [User Retention Queries](#user-retention-queries)
3. [Session Analysis Queries](#session-analysis-queries)
4. [Feature Adoption Queries](#feature-adoption-queries)
5. [Achievement Queries](#achievement-queries)
6. [Drop-Off Analysis](#drop-off-analysis)
7. [Cohort Analysis](#cohort-analysis)
8. [Custom Queries](#custom-queries)
9. [Data Export](#data-export)

---

## Command Usage Queries

### Q: Which commands are users actually using?

```typescript
import { AnalyticsQueries } from './services/analytics.queries';

const queries = new AnalyticsQueries(db);

// Get top 10 commands from last 7 days
const topCommands = await queries.getTopCommands(10, 7);

console.log('Top Commands (Last 7 Days):');
topCommands.forEach(([cmd, count], i) => {
  console.log(`${i + 1}. /${cmd} - ${count} uses`);
});
```

**Output:**
```
Top Commands (Last 7 Days):
1. /start - 342 uses
2. /end - 298 uses
3. /time - 156 uses
4. /mystats - 89 uses
5. /leaderboard - 67 uses
```

### Q: Should I remove the `/compare` command? Nobody uses it.

```typescript
// Get least-used commands from last 30 days
const leastUsed = await queries.getLeastUsedCommands(10, 30);

// Check if a specific command is underutilized
const compareUsage = leastUsed.find(([cmd]) => cmd === 'compare');

if (compareUsage && compareUsage[1] < 10) {
  console.log(`⚠️ REMOVE: /compare has only ${compareUsage[1]} uses in 30 days`);
} else if (!compareUsage) {
  console.log('❌ /compare has ZERO uses - strong candidate for removal');
}
```

### Q: Are any commands failing frequently?

```typescript
const commandHealth = await queries.getCommandHealth(7);

// Find error-prone commands
const errorProne = commandHealth.filter(c => c.successRate < 0.9);

if (errorProne.length > 0) {
  console.log('🚨 Commands with < 90% success rate:');
  errorProne.forEach(c => {
    console.log(`  /${c.commandName}: ${(c.successRate * 100).toFixed(1)}% success`);
    console.log(`    Errors: ${c.errorCount}/${c.totalExecutions}`);
  });
}
```

### Q: Which commands are slow?

```typescript
const commandHealth = await queries.getCommandHealth(7);

// Find slow commands (> 3 seconds)
const slowCommands = commandHealth.filter(c => c.averageResponseTimeMs > 3000);

slowCommands.forEach(c => {
  console.log(`🐌 /${c.commandName}: ${c.averageResponseTimeMs.toFixed(0)}ms avg`);
});
```

---

## User Retention Queries

### Q: How many active users do I have?

```typescript
const dau = await queries.getDAU(); // Daily Active Users
const wau = await queries.getWAU(); // Weekly Active Users
const mau = await queries.getMAU(); // Monthly Active Users

console.log(`Active Users:`);
console.log(`  Today: ${dau} users`);
console.log(`  Last 7 days: ${wau} users`);
console.log(`  Last 30 days: ${mau} users`);
```

### Q: Are users coming back regularly?

```typescript
const dau = await queries.getDAU();
const wau = await queries.getWAU();
const mau = await queries.getMAU();

// Stickiness ratios
const dauWauRatio = dau / wau;
const wauMauRatio = wau / mau;

console.log(`Engagement Metrics:`);
console.log(`  DAU/WAU: ${(dauWauRatio * 100).toFixed(1)}%`);
console.log(`    ${dauWauRatio > 0.2 ? '✅' : '❌'} Target: >20% (users return 2+ times/week)`);

console.log(`  WAU/MAU: ${(wauMauRatio * 100).toFixed(1)}%`);
console.log(`    ${wauMauRatio > 0.4 ? '✅' : '❌'} Target: >40% (users return weekly)`);
```

### Q: Did the new achievement system increase daily active users?

```typescript
// Compare DAU before and after feature launch

// Before: Jan 1-7
const dauBefore = await queries.getDAU('2025-01-07');

// After: Jan 8-14
const dauAfter = await queries.getDAU('2025-01-14');

const change = ((dauAfter - dauBefore) / dauBefore) * 100;

console.log(`DAU Change After Achievement System Launch:`);
console.log(`  Before: ${dauBefore} users`);
console.log(`  After: ${dauAfter} users`);
console.log(`  Change: ${change > 0 ? '+' : ''}${change.toFixed(1)}%`);
```

### Q: How many new users joined this week?

```typescript
const startDate = queries['getDateNDaysAgo'](7); // Helper method
const endDate = queries['getTodayDateString'](); // Helper method

const newUsers = await queries.getNewUsers(startDate, endDate);

console.log(`New Users (Last 7 Days): ${newUsers}`);
```

### Q: Are users from Week 1 still active?

```typescript
// Cohort retention analysis
const cohortDate = '2025-01-01'; // Users who joined on Jan 1
const checkDate = '2025-01-08'; // Check if they're active on Jan 8

const day7Retention = await queries.getCohortRetention(cohortDate, checkDate);

console.log(`Day 7 Retention for ${cohortDate} Cohort:`);
console.log(`  ${(day7Retention * 100).toFixed(1)}% of users returned on Day 7`);
console.log(`  ${day7Retention > 0.3 ? '✅' : '❌'} Target: >30%`);
```

---

## Session Analysis Queries

### Q: What % of users who start a session actually complete it?

```typescript
const funnel = await queries.getSessionFunnel(7);

console.log(`Session Funnel (Last 7 Days):`);
console.log(`  Started: ${funnel.sessionsStarted}`);
console.log(`  Completed: ${funnel.sessionsCompleted}`);
console.log(`  Cancelled: ${funnel.sessionsCancelled}`);
console.log(`  Completion Rate: ${(funnel.completionRate * 100).toFixed(1)}%`);

if (funnel.completionRate < 0.7) {
  console.log(`⚠️ WARNING: Low completion rate (<70%) - investigate UX issues`);
}
```

### Q: How long are users studying on average?

```typescript
const funnel = await queries.getSessionFunnel(7);

const avgHours = funnel.averageDuration / 3600;

console.log(`Average Session Duration: ${avgHours.toFixed(1)} hours`);
console.log(`Average XP/Session: ${Math.round(funnel.averageXpPerSession)} XP`);
```

### Q: Are users cancelling sessions more than usual?

```typescript
// Compare this week vs. last week
const thisWeek = await queries.getSessionFunnel(7);
const lastWeek = await queries.getSessionFunnel(14); // 14 days back, then filter

const thisWeekCancelRate = thisWeek.cancellationRate;
const lastWeekCancelRate = lastWeek.cancellationRate - thisWeek.cancellationRate;

console.log(`Cancellation Rate:`);
console.log(`  This Week: ${(thisWeekCancelRate * 100).toFixed(1)}%`);
console.log(`  Last Week: ${(lastWeekCancelRate * 100).toFixed(1)}%`);

if (thisWeekCancelRate > lastWeekCancelRate * 1.2) {
  console.log(`🚨 ALERT: Cancellations up ${(((thisWeekCancelRate / lastWeekCancelRate) - 1) * 100).toFixed(1)}%`);
}
```

---

## Feature Adoption Queries

### Q: Which features are users actually engaging with?

```typescript
const featureUsage = await queries.getFeatureUsage(7);

console.log('Feature Usage (Last 7 Days):');
Array.from(featureUsage.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([feature, count]) => {
    console.log(`  ${feature}: ${count} users`);
  });
```

### Q: What % of users have tried the leaderboard feature?

```typescript
const adoptionRate = await queries.getFeatureAdoptionRate('leaderboard', 30);

console.log(`Leaderboard Adoption (Last 30 Days):`);
console.log(`  ${(adoptionRate * 100).toFixed(1)}% of users have viewed leaderboards`);

if (adoptionRate < 0.3) {
  console.log(`⚠️ Low adoption (<30%) - consider promoting this feature`);
}
```

### Q: Are users setting goals?

```typescript
const goalSettingRate = await queries.getFeatureAdoptionRate('goal_setting', 30);
const goalCompletionRate = await queries.getFeatureAdoptionRate('goal_completion', 30);

console.log(`Goal Feature Adoption:`);
console.log(`  Goal Setting: ${(goalSettingRate * 100).toFixed(1)}%`);
console.log(`  Goal Completion: ${(goalCompletionRate * 100).toFixed(1)}%`);

if (goalSettingRate > 0 && goalCompletionRate > 0) {
  const completionRatio = goalCompletionRate / goalSettingRate;
  console.log(`  Completion Ratio: ${(completionRatio * 100).toFixed(1)}%`);
}
```

---

## Achievement Queries

### Q: How many achievements were unlocked this week?

```typescript
const achievementsUnlocked = await queries.getAchievementsUnlocked(7);

console.log(`Achievements Unlocked (Last 7 Days): ${achievementsUnlocked}`);
```

### Q: Which achievements are unlocked most/least?

This requires a custom query (see Custom Queries section below).

---

## Drop-Off Analysis

### Q: Where do users drop off in their journey?

```typescript
// First command → First session completion
const firstCommandUsers = await queries.getNewUsers('2025-01-01', '2025-01-07');
const firstSessionCompletions = /* custom query needed */;

console.log(`Onboarding Funnel (Week of Jan 1):`);
console.log(`  New Users: ${firstCommandUsers}`);
console.log(`  Completed First Session: ${firstSessionCompletions}`);
console.log(`  Conversion Rate: ${(firstSessionCompletions / firstCommandUsers * 100).toFixed(1)}%`);
```

---

## Cohort Analysis

### Q: Compare Week 1 users to Week 2 users to see if changes help

```typescript
// Get cohorts
const week1Cohort = '2025-W01';
const week2Cohort = '2025-W02';

// Get Day 7 retention for each cohort
const week1Retention = await queries.getCohortRetention('2025-01-01', '2025-01-08');
const week2Retention = await queries.getCohortRetention('2025-01-08', '2025-01-15');

console.log(`Cohort Comparison (Day 7 Retention):`);
console.log(`  ${week1Cohort}: ${(week1Retention * 100).toFixed(1)}%`);
console.log(`  ${week2Cohort}: ${(week2Retention * 100).toFixed(1)}%`);

const improvement = ((week2Retention - week1Retention) / week1Retention) * 100;
console.log(`  Change: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
```

---

## Custom Queries

### Q: Show me users who haven't been active in 7+ days

```typescript
async function getInactiveUsers(db: Firestore, inactiveDays: number = 7): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

  const snapshot = await db
    .collection('discord-data')
    .doc('analytics')
    .collection('cohorts')
    .where('lastActiveAt', '<', cutoffTimestamp)
    .get();

  return snapshot.docs.map(doc => doc.id);
}

const inactiveUsers = await getInactiveUsers(db, 7);
console.log(`Users Inactive for 7+ Days: ${inactiveUsers.length}`);
```

### Q: Which achievements are unlocked most often?

```typescript
async function getAchievementDistribution(db: Firestore, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const dateStr = startDate.toISOString().split('T')[0];

  const achievementCounts = new Map<string, number>();

  // Query raw events for achievement unlocks
  const eventsSnapshot = await db
    .collection('discord-data')
    .doc('analytics')
    .collection('events')
    .where('eventType', '==', 'achievement_unlocked')
    .get();

  eventsSnapshot.forEach(doc => {
    const event = doc.data();
    const achievementId = event.metadata?.achievementId;
    if (achievementId) {
      achievementCounts.set(achievementId, (achievementCounts.get(achievementId) || 0) + 1);
    }
  });

  return Array.from(achievementCounts.entries())
    .sort((a, b) => b[1] - a[1]);
}

const distribution = await getAchievementDistribution(db, 30);
console.log('Achievement Unlock Distribution (Last 30 Days):');
distribution.forEach(([id, count], i) => {
  console.log(`${i + 1}. ${id}: ${count} unlocks`);
});
```

### Q: Which servers are most active?

```typescript
async function getServerActivity(db: Firestore, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const dateStr = startDate.toISOString().split('T')[0];

  const serverCounts = new Map<string, number>();

  const snapshot = await db
    .collection('discord-data')
    .doc('analytics')
    .collection('daily')
    .where('date', '>=', dateStr)
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();
    const serverId = data.serverId;
    if (serverId) {
      serverCounts.set(serverId, (serverCounts.get(serverId) || 0) + 1);
    }
  });

  return Array.from(serverCounts.entries())
    .sort((a, b) => b[1] - a[1]);
}

const serverActivity = await getServerActivity(db, 7);
console.log('Most Active Servers (Last 7 Days):');
serverActivity.slice(0, 5).forEach(([serverId, count], i) => {
  console.log(`${i + 1}. Server ${serverId}: ${count} active user-days`);
});
```

### Q: Are power users (Level 50+) using different features than newbies?

This requires joining analytics data with user stats:

```typescript
async function compareUserSegments(db: Firestore) {
  // Get power users (Level 50+)
  const powerUsersSnapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .where('xp', '>=', xpForLevel(50)) // You'd need to import xpForLevel
    .get();

  const powerUserIds = new Set(powerUsersSnapshot.docs.map(d => d.id));

  // Analyze feature usage for each segment
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const dateStr = last7Days.toISOString().split('T')[0];

  const analyticsSnapshot = await db
    .collection('discord-data')
    .doc('analytics')
    .collection('daily')
    .where('date', '>=', dateStr)
    .get();

  const powerUserFeatures = { leaderboard: 0, stats: 0, feed: 0, goals: 0 };
  const newbieFeatures = { leaderboard: 0, stats: 0, feed: 0, goals: 0 };

  analyticsSnapshot.forEach(doc => {
    const data = doc.data();
    const userId = doc.id.split('_')[0];
    const isPowerUser = powerUserIds.has(userId);

    const features = isPowerUser ? powerUserFeatures : newbieFeatures;

    if (data.viewedLeaderboard) features.leaderboard++;
    if (data.viewedStats) features.stats++;
    if (data.viewedFeed) features.feed++;
    if (data.setGoal) features.goals++;
  });

  console.log('Feature Usage by Segment:');
  console.log('Power Users (Level 50+):', powerUserFeatures);
  console.log('New Users (<Level 50):', newbieFeatures);
}

await compareUserSegments(db);
```

---

## Data Export

### Q: How do I export analytics data for external analysis?

```typescript
import * as fs from 'fs';

// Export last 30 days to JSON
const startDate = '2025-01-01';
const endDate = '2025-01-31';

const data = await queries.exportDailyAnalytics(startDate, endDate);

// Save to file
fs.writeFileSync(
  'analytics_export.json',
  JSON.stringify(data, null, 2)
);

console.log(`Exported ${data.length} daily records to analytics_export.json`);
```

### Q: Can I use this data in Google Sheets?

**Option 1: Manual Export**

1. Run the export query above
2. Upload `analytics_export.json` to Google Sheets using the "File > Import" menu
3. Select "JSON" as the file type

**Option 2: Automated Export (Future Enhancement)**

Create a Cloud Function that exports data to Google Sheets on a schedule:

```typescript
// cloud-function/exportToSheets.ts (pseudocode)
import { google } from 'googleapis';

export async function scheduledExport() {
  const data = await queries.exportDailyAnalytics(startDate, endDate);

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.update({
    spreadsheetId: 'YOUR_SHEET_ID',
    range: 'Analytics!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: convertToRows(data),
    },
  });
}
```

---

## Quick Reference: Common Queries

| Question | Query |
|----------|-------|
| Top 5 commands | `queries.getTopCommands(5, 7)` |
| Least-used commands | `queries.getLeastUsedCommands(5, 30)` |
| Daily active users | `queries.getDAU()` |
| Weekly active users | `queries.getWAU()` |
| Monthly active users | `queries.getMAU()` |
| Session completion rate | `queries.getSessionFunnel(7)` then `.completionRate` |
| Feature adoption | `queries.getFeatureAdoptionRate('leaderboard', 30)` |
| New users this week | `queries.getNewUsers(startDate, endDate)` |
| Command health | `queries.getCommandHealth(7)` |
| Dashboard summary | `queries.getDashboardSummary()` |

---

## Next Steps

1. **Start simple:** Run the dashboard summary query to get an overview
2. **Identify issues:** Use command health and session funnel queries
3. **Deep dive:** Create custom queries for your specific questions
4. **Automate:** Set up weekly exports or automated reports

For more information, see:
- [ANALYTICS_PIPELINE.md](./ANALYTICS_PIPELINE.md) - Setup and architecture
- [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) - Data privacy and compliance
