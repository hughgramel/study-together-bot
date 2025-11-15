# 🎮 Phase 1: Core Gamification - Implementation Plan

**Timeline:** 2-3 weeks
**Priority:** CRITICAL
**Goal:** Add XP, leveling, and badge systems to create core engagement loop

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Schema Changes](#database-schema-changes)
3. [Implementation Tasks](#implementation-tasks)
4. [Badge Definitions](#badge-definitions)
5. [Testing Checklist](#testing-checklist)
6. [Success Metrics](#success-metrics)

---

## 🎯 Overview

### What We're Building

- **XP System:** Award points for studying, completing sessions, streaks
- **Leveling System:** 1-100 levels based on total XP earned
- **Badge System:** 20 achievement badges that unlock automatically
- **Enhanced /mystats:** Display level, XP, badges, and progress

### Key Features

✅ Award XP for:
- Time studied (10 XP/hour)
- Session completion (25 XP base)
- First session of day (+25 XP bonus)
- Streak milestones (100 XP for 7-day, 500 for 30-day)

✅ Level calculation from XP (exponential curve)

✅ Badge auto-unlock detection

✅ Beautiful embed showing all stats

---

## 🗄️ Database Schema Changes

### 1. **User Stats Collection** (`discord-data/userStats/stats/{userId}`)

**Current Fields:**
```typescript
interface UserStats {
  username: string;
  totalSessions: number;
  totalDuration: number;      // seconds
  currentStreak: number;
  longestStreak: number;
  lastSessionAt: Timestamp;
  firstSessionAt: Timestamp;
}
```

**NEW Fields to Add:**
```typescript
interface UserStats {
  // ... existing fields ...

  // XP & Leveling
  xp: number;                   // total XP earned
  level: number;                // current level (calculated from XP)

  // Badge tracking
  badges: string[];             // array of badge IDs unlocked
  badgesUnlockedAt: {           // map of badge ID -> unlock timestamp
    [badgeId: string]: Timestamp;
  };

  // Additional tracking for badge conditions
  sessionsByDay: {              // map of date (YYYY-MM-DD) -> session count
    [date: string]: number;
  };
  activityTypes: string[];      // unique activity types logged
  longestSessionDuration: number; // seconds
  totalReactionsReceived: number; // reactions on feed posts
  totalReactionsGiven: number;    // reactions given to others
  firstSessionOfDayCount: number; // # of times user started first session of day

  // Time-of-day tracking
  sessionsBeforeNoon: number;
  sessionsAfterMidnight: number;
}
```

### 2. **New Collection: Badges** (`discord-data/badges/definitions/{badgeId}`)

```typescript
interface BadgeDefinition {
  id: string;                   // unique badge ID
  name: string;                 // display name
  emoji: string;                // emoji to display
  description: string;          // what it's for
  category: 'milestone' | 'time' | 'streak' | 'social' | 'intensity' | 'diversity';
  xpReward: number;            // XP awarded when unlocked
  condition: {                  // unlock condition
    type: 'sessions' | 'hours' | 'streak' | 'activities' | 'custom';
    threshold: number;          // e.g., 100 for "100 hours"
    field?: string;             // field to check (e.g., 'totalDuration')
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  order: number;                // display order
}
```

### 3. **Migration Script**

Create `src/migrations/phase1-xp-system.ts`:

```typescript
// Add default XP/level fields to existing users
// Calculate initial XP based on existing hours (10 XP/hour)
// Set level based on XP
// Initialize badges array as empty
// Add sessionsByDay map (approximate from totalSessions)
// Set activity types based on past sessions
```

---

## 📝 Implementation Tasks

### **Week 1: XP & Leveling System**

#### **Task 1.1: Create XP Utility Functions**

**File:** `src/utils/xp.ts`

```typescript
/**
 * Calculate level from total XP using exponential curve
 * Formula: XP = 100 * (level^1.5)
 */
export function calculateLevel(xp: number): number {
  // Level 1 = 0 XP
  // Level 2 = 100 XP
  // Level 5 = 500 XP
  // Level 10 = 1,500 XP
  // Level 20 = 5,000 XP
  // etc.

  if (xp < 100) return 1;

  // Use inverse formula: level = (XP / 100)^(2/3)
  const level = Math.floor(Math.pow(xp / 100, 2 / 3));
  return Math.max(1, Math.min(100, level)); // cap at 100
}

/**
 * Calculate XP required for a specific level
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calculate XP needed to reach next level
 */
export function xpToNextLevel(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  return nextLevelXp - currentXp;
}

/**
 * Calculate progress percentage to next level
 */
export function levelProgress(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);

  const progress = ((currentXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Award XP and check for level up
 * Returns: { newXp, newLevel, leveledUp, levelsGained }
 */
export function awardXP(
  currentXp: number,
  xpToAdd: number
): {
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  levelsGained: number;
  oldLevel: number;
} {
  const oldLevel = calculateLevel(currentXp);
  const newXp = currentXp + xpToAdd;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > oldLevel;
  const levelsGained = newLevel - oldLevel;

  return { newXp, newLevel, leveledUp, levelsGained, oldLevel };
}
```

**Checklist:**
- [ ] Create `src/utils/xp.ts`
- [ ] Implement all XP calculation functions
- [ ] Write unit tests for XP calculations
- [ ] Test edge cases (0 XP, max level, etc.)

---

#### **Task 1.2: Create XP Service**

**File:** `src/services/xp.ts`

```typescript
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { calculateLevel, awardXP as calculateXP } from '../utils/xp';

export class XPService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Award XP to a user and update their level
   * Returns: { newXp, newLevel, leveledUp }
   */
  async awardXP(
    userId: string,
    amount: number,
    reason: string
  ): Promise<{ newXp: number; newLevel: number; leveledUp: boolean; levelsGained: number }> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();

    if (!doc.exists) {
      throw new Error('User stats not found');
    }

    const stats = doc.data();
    const currentXp = stats?.xp || 0;

    const result = calculateXP(currentXp, amount);

    await statsRef.update({
      xp: result.newXp,
      level: result.newLevel,
    });

    // Log XP transaction for debugging
    console.log(`[XP] Awarded ${amount} XP to ${userId} for "${reason}". New XP: ${result.newXp}, Level: ${result.newLevel}`);

    return result;
  }

  /**
   * Calculate XP from session duration
   * 10 XP per hour
   */
  calculateSessionXP(durationSeconds: number): number {
    const hours = durationSeconds / 3600;
    return Math.floor(hours * 10);
  }

  /**
   * Get XP breakdown for a session completion
   */
  getSessionXPBreakdown(
    durationSeconds: number,
    isFirstSessionToday: boolean,
    isStreakMilestone: boolean,
    streakDays: number
  ): { total: number; breakdown: Array<{ source: string; amount: number }> } {
    const breakdown: Array<{ source: string; amount: number }> = [];

    // Base XP for time
    const timeXP = this.calculateSessionXP(durationSeconds);
    breakdown.push({ source: 'Time studied', amount: timeXP });

    // Session completion bonus
    breakdown.push({ source: 'Session completed', amount: 25 });

    // First session of day bonus
    if (isFirstSessionToday) {
      breakdown.push({ source: 'First session today', amount: 25 });
    }

    // Streak milestone bonus
    if (isStreakMilestone) {
      if (streakDays === 7) {
        breakdown.push({ source: '7-day streak milestone', amount: 100 });
      } else if (streakDays === 30) {
        breakdown.push({ source: '30-day streak milestone', amount: 500 });
      }
    }

    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

    return { total, breakdown };
  }
}
```

**Checklist:**
- [ ] Create `src/services/xp.ts`
- [ ] Implement XPService class
- [ ] Add XP logging for debugging
- [ ] Test XP calculations

---

#### **Task 1.3: Integrate XP into Session Completion**

**File:** `src/services/stats.ts` (modify existing)

```typescript
// Add to StatsService class

import { XPService } from './xp';

export class StatsService {
  private db: Firestore;
  private xpService: XPService; // ADD THIS

  constructor(db: Firestore) {
    this.db = db;
    this.xpService = new XPService(db); // ADD THIS
  }

  /**
   * Updates user statistics after completing a session
   * NOW ALSO AWARDS XP
   */
  async updateUserStats(
    userId: string,
    username: string,
    sessionDuration: number
  ): Promise<{
    stats: UserStats;
    xpGained: number;
    leveledUp: boolean;
    newLevel?: number;
  }> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    const now = Timestamp.now();

    // Check if this is first session of the day
    const isFirstSessionToday = doc.exists
      ? !isSameDay(doc.data()!.lastSessionAt, now)
      : true;

    if (!doc.exists) {
      // First session ever - award initial XP
      const xpBreakdown = this.xpService.getSessionXPBreakdown(
        sessionDuration,
        true, // first session of day
        false, // no streak milestone yet
        1
      );

      const newStats: UserStats = {
        username,
        totalSessions: 1,
        totalDuration: sessionDuration,
        currentStreak: 1,
        longestStreak: 1,
        lastSessionAt: now,
        firstSessionAt: now,
        xp: xpBreakdown.total,
        level: calculateLevel(xpBreakdown.total),
        badges: [],
        badgesUnlockedAt: {},
        sessionsByDay: {
          [this.getDateKey(now)]: 1,
        },
        activityTypes: [],
        longestSessionDuration: sessionDuration,
        totalReactionsReceived: 0,
        totalReactionsGiven: 0,
        firstSessionOfDayCount: 1,
        sessionsBeforeNoon: 0,
        sessionsAfterMidnight: 0,
      };

      await statsRef.set(newStats);

      return {
        stats: newStats,
        xpGained: xpBreakdown.total,
        leveledUp: false,
      };
    }

    // Update existing stats
    const stats = doc.data() as UserStats;

    // Calculate new streak
    let newStreak = stats.currentStreak;
    let isStreakMilestone = false;

    if (isSameDay(stats.lastSessionAt, now)) {
      newStreak = stats.currentStreak;
    } else if (isYesterday(stats.lastSessionAt, now)) {
      newStreak = stats.currentStreak + 1;
      // Check for milestone
      if (newStreak === 7 || newStreak === 30) {
        isStreakMilestone = true;
      }
    } else {
      newStreak = 1;
    }

    const newLongestStreak = Math.max(newStreak, stats.longestStreak);

    // Calculate XP to award
    const xpBreakdown = this.xpService.getSessionXPBreakdown(
      sessionDuration,
      isFirstSessionToday,
      isStreakMilestone,
      newStreak
    );

    // Award XP
    const xpResult = await this.xpService.awardXP(
      userId,
      xpBreakdown.total,
      'Session completed'
    );

    // Update session tracking
    const dateKey = this.getDateKey(now);
    const sessionsByDay = stats.sessionsByDay || {};
    sessionsByDay[dateKey] = (sessionsByDay[dateKey] || 0) + 1;

    const updates: Partial<UserStats> = {
      username,
      totalSessions: stats.totalSessions + 1,
      totalDuration: stats.totalDuration + sessionDuration,
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastSessionAt: now,
      sessionsByDay,
      longestSessionDuration: Math.max(
        stats.longestSessionDuration || 0,
        sessionDuration
      ),
      firstSessionOfDayCount: isFirstSessionToday
        ? (stats.firstSessionOfDayCount || 0) + 1
        : stats.firstSessionOfDayCount,
    };

    await statsRef.update(updates);

    const updatedStats = { ...stats, ...updates };

    return {
      stats: updatedStats as UserStats,
      xpGained: xpBreakdown.total,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.leveledUp ? xpResult.newLevel : undefined,
    };
  }

  private getDateKey(timestamp: Timestamp): string {
    const date = timestamp.toDate();
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
```

**Checklist:**
- [ ] Modify `src/services/stats.ts`
- [ ] Integrate XP service into updateUserStats
- [ ] Return XP data from updateUserStats
- [ ] Test XP awards on session completion

---

#### **Task 1.4: Update Session Completion in bot.ts**

**File:** `src/bot.ts` (modify existing end session handlers)

```typescript
// In endSessionModal handler (around line 936)

// Update stats (NOW RETURNS XP INFO)
const statsUpdate = await statsService.updateUserStats(
  user.id,
  user.username,
  duration
);

// Delete active session
await sessionService.deleteActiveSession(user.id);

const durationStr = formatDuration(duration);

// Build XP message
let xpMessage = '';
if (statsUpdate.leveledUp) {
  xpMessage = `\n\n🎉 **LEVEL UP!** You're now Level ${statsUpdate.newLevel}! (+${statsUpdate.xpGained} XP)`;
} else {
  xpMessage = `\n\n✨ +${statsUpdate.xpGained} XP earned!`;
}

await interaction.reply({
  content: `✅ Session completed! (${durationStr})${xpMessage}\n\nYour session has been saved and posted to the feed.`,
  ephemeral: false,
});

// ... rest of code (post to feed, etc.)
```

**Do the same for:**
- Manual session modal handler (line 841)
- VC auto-post (line 743)

**Checklist:**
- [ ] Update `/end` modal handler to show XP
- [ ] Update `/manual` modal handler to show XP
- [ ] Update VC auto-post to award XP
- [ ] Test level-up messages

---

### **Week 2: Badge System**

#### **Task 2.1: Create Badge Definitions**

**File:** `src/data/badges.ts`

```typescript
import { BadgeDefinition } from '../types';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // MILESTONE BADGES
  {
    id: 'first_steps',
    name: 'First Steps',
    emoji: '🎯',
    description: 'Complete your first session',
    category: 'milestone',
    xpReward: 50,
    condition: {
      type: 'sessions',
      threshold: 1,
      field: 'totalSessions',
    },
    rarity: 'common',
    order: 1,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    emoji: '⚡',
    description: 'Complete 5 sessions in one day',
    category: 'intensity',
    xpReward: 100,
    condition: {
      type: 'custom', // needs special check
      threshold: 5,
    },
    rarity: 'rare',
    order: 2,
  },

  // TIME-BASED BADGES (Hours)
  {
    id: 'getting_started',
    name: 'Getting Started',
    emoji: '⏱️',
    description: 'Study for 10 hours total',
    category: 'time',
    xpReward: 50,
    condition: {
      type: 'hours',
      threshold: 36000, // 10 hours in seconds
      field: 'totalDuration',
    },
    rarity: 'common',
    order: 10,
  },
  {
    id: 'committed',
    name: 'Committed',
    emoji: '🕐',
    description: 'Study for 50 hours total',
    category: 'time',
    xpReward: 100,
    condition: {
      type: 'hours',
      threshold: 180000, // 50 hours
      field: 'totalDuration',
    },
    rarity: 'common',
    order: 11,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    emoji: '💯',
    description: 'Study for 100 hours total',
    category: 'time',
    xpReward: 200,
    condition: {
      type: 'hours',
      threshold: 360000, // 100 hours
      field: 'totalDuration',
    },
    rarity: 'rare',
    order: 12,
  },

  // STREAK BADGES
  {
    id: 'hot_streak',
    name: 'Hot Streak',
    emoji: '🔥',
    description: 'Maintain a 3-day streak',
    category: 'streak',
    xpReward: 50,
    condition: {
      type: 'streak',
      threshold: 3,
      field: 'currentStreak',
    },
    rarity: 'common',
    order: 20,
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    emoji: '🔥',
    description: 'Maintain a 7-day streak',
    category: 'streak',
    xpReward: 150,
    condition: {
      type: 'streak',
      threshold: 7,
      field: 'currentStreak',
    },
    rarity: 'rare',
    order: 21,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    emoji: '🌟',
    description: 'Maintain a 30-day streak',
    category: 'streak',
    xpReward: 500,
    condition: {
      type: 'streak',
      threshold: 30,
      field: 'currentStreak',
    },
    rarity: 'epic',
    order: 22,
  },

  // DIVERSITY BADGES
  {
    id: 'explorer',
    name: 'Explorer',
    emoji: '🎨',
    description: 'Try 3 different activity types',
    category: 'diversity',
    xpReward: 50,
    condition: {
      type: 'activities',
      threshold: 3,
      field: 'activityTypes',
    },
    rarity: 'common',
    order: 30,
  },
  {
    id: 'versatile',
    name: 'Versatile',
    emoji: '🌈',
    description: 'Try 7 different activity types',
    category: 'diversity',
    xpReward: 100,
    condition: {
      type: 'activities',
      threshold: 7,
      field: 'activityTypes',
    },
    rarity: 'rare',
    order: 31,
  },

  // INTENSITY BADGES
  {
    id: 'marathon',
    name: 'Marathon',
    emoji: '💪',
    description: 'Complete a session over 4 hours',
    category: 'intensity',
    xpReward: 150,
    condition: {
      type: 'custom',
      threshold: 14400, // 4 hours
    },
    rarity: 'rare',
    order: 40,
  },
  {
    id: 'ultra_marathon',
    name: 'Ultra Marathon',
    emoji: '🏃',
    description: 'Complete a session over 8 hours',
    category: 'intensity',
    xpReward: 300,
    condition: {
      type: 'custom',
      threshold: 28800, // 8 hours
    },
    rarity: 'epic',
    order: 41,
  },

  // TIME-OF-DAY BADGES
  {
    id: 'early_bird',
    name: 'Early Bird',
    emoji: '🐦',
    description: 'Start 5 sessions before 7 AM',
    category: 'milestone',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 5,
    },
    rarity: 'rare',
    order: 50,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    emoji: '🦉',
    description: 'Start 5 sessions after 11 PM',
    category: 'milestone',
    xpReward: 100,
    condition: {
      type: 'custom',
      threshold: 5,
    },
    rarity: 'rare',
    order: 51,
  },

  // Add more badges up to 20 total...
  // (Dedicated, Scholar, Week Warrior, etc.)
];

// Helper to get badge by ID
export function getBadge(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === id);
}

// Get all badges by category
export function getBadgesByCategory(category: string): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(b => b.category === category);
}
```

**Checklist:**
- [ ] Create `src/data/badges.ts`
- [ ] Define all 20 starter badges
- [ ] Add helper functions

---

#### **Task 2.2: Create Badge Service**

**File:** `src/services/badges.ts`

```typescript
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { BADGE_DEFINITIONS, getBadge } from '../data/badges';
import { UserStats, BadgeDefinition } from '../types';

export class BadgeService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Check if user should unlock any new badges
   * Returns array of newly unlocked badge IDs
   */
  async checkAndAwardBadges(userId: string): Promise<string[]> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    if (!doc.exists) return [];

    const stats = doc.data() as UserStats;
    const currentBadges = stats.badges || [];
    const newlyUnlocked: string[] = [];

    for (const badge of BADGE_DEFINITIONS) {
      // Skip if already unlocked
      if (currentBadges.includes(badge.id)) continue;

      // Check if conditions are met
      if (this.checkBadgeCondition(badge, stats)) {
        newlyUnlocked.push(badge.id);

        // Update user stats with new badge
        await statsRef.update({
          badges: [...currentBadges, badge.id],
          [`badgesUnlockedAt.${badge.id}`]: Timestamp.now(),
        });

        console.log(`[BADGE] User ${userId} unlocked "${badge.name}"!`);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Check if badge condition is met
   */
  private checkBadgeCondition(badge: BadgeDefinition, stats: UserStats): boolean {
    const { condition } = badge;

    switch (condition.type) {
      case 'sessions':
        return (stats[condition.field as keyof UserStats] as number) >= condition.threshold;

      case 'hours':
        return (stats[condition.field as keyof UserStats] as number) >= condition.threshold;

      case 'streak':
        return (stats[condition.field as keyof UserStats] as number) >= condition.threshold;

      case 'activities':
        const activityTypes = stats.activityTypes || [];
        return activityTypes.length >= condition.threshold;

      case 'custom':
        // Handle special cases
        return this.checkCustomCondition(badge.id, stats, condition.threshold);

      default:
        return false;
    }
  }

  /**
   * Check custom badge conditions
   */
  private checkCustomCondition(badgeId: string, stats: UserStats, threshold: number): boolean {
    switch (badgeId) {
      case 'speed_demon':
        // 5 sessions in one day
        const sessionsByDay = stats.sessionsByDay || {};
        return Object.values(sessionsByDay).some(count => count >= threshold);

      case 'marathon':
        // Single session over 4 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'ultra_marathon':
        // Single session over 8 hours
        return (stats.longestSessionDuration || 0) >= threshold;

      case 'early_bird':
        // 5 sessions before 7 AM
        return (stats.sessionsBeforeNoon || 0) >= threshold;

      case 'night_owl':
        // 5 sessions after 11 PM
        return (stats.sessionsAfterMidnight || 0) >= threshold;

      default:
        return false;
    }
  }

  /**
   * Get user's unlocked badges with details
   */
  async getUserBadges(userId: string): Promise<BadgeDefinition[]> {
    const statsRef = this.db
      .collection('discord-data')
      .doc('userStats')
      .collection('stats')
      .doc(userId);

    const doc = await statsRef.get();
    if (!doc.exists) return [];

    const stats = doc.data() as UserStats;
    const badgeIds = stats.badges || [];

    return badgeIds
      .map(id => getBadge(id))
      .filter(badge => badge !== undefined) as BadgeDefinition[];
  }
}
```

**Checklist:**
- [ ] Create `src/services/badges.ts`
- [ ] Implement badge checking logic
- [ ] Test badge unlock conditions
- [ ] Add logging for badge unlocks

---

#### **Task 2.3: Integrate Badge Checking into Session Completion**

**File:** `src/bot.ts`

```typescript
// At top, import badge service
import { BadgeService } from './services/badges';

// Initialize badge service
const badgeService = new BadgeService(db);

// In endSessionModal handler (after statsService.updateUserStats)

// Check for new badges
const newBadges = await badgeService.checkAndAwardBadges(user.id);

// Build badge message
let badgeMessage = '';
if (newBadges.length > 0) {
  const badgeDetails = newBadges.map(id => getBadge(id)).filter(b => b);
  const badgeEmojis = badgeDetails.map(b => `${b.emoji} **${b.name}**`).join(', ');
  badgeMessage = `\n🏆 **NEW BADGE${newBadges.length > 1 ? 'S' : ''}!** ${badgeEmojis}`;

  // Award XP for badges
  for (const badge of badgeDetails) {
    if (badge.xpReward > 0) {
      await xpService.awardXP(user.id, badge.xpReward, `Badge unlocked: ${badge.name}`);
    }
  }
}

await interaction.reply({
  content: `✅ Session completed! (${durationStr})${xpMessage}${badgeMessage}\n\nYour session has been saved and posted to the feed.`,
  ephemeral: false,
});
```

**Checklist:**
- [ ] Import and initialize BadgeService
- [ ] Check for badges after each session
- [ ] Award bonus XP for badge unlocks
- [ ] Display badge unlocks in completion message
- [ ] Test badge unlocking

---

### **Week 3: Enhanced /mystats**

#### **Task 3.1: Update /mystats Command**

**File:** `src/bot.ts` (modify /mystats handler around line 1321)

```typescript
// /mystats command
if (commandName === 'mystats') {
  const stats = await statsService.getUserStats(user.id);

  if (!stats) {
    await interaction.reply({
      content: 'No stats yet! Complete your first session with /start and /end.',
      ephemeral: true,
    });
    return;
  }

  // Get user badges
  const userBadges = await badgeService.getUserBadges(user.id);

  // ... existing timeframe calculations ...

  // XP & Level info
  const currentXp = stats.xp || 0;
  const currentLevel = stats.level || 1;
  const xpToNext = xpToNextLevel(currentXp);
  const progress = levelProgress(currentXp);

  // Create progress bar (20 characters wide)
  const progressBarLength = 20;
  const filledLength = Math.floor((progress / 100) * progressBarLength);
  const progressBar = '█'.repeat(filledLength) + '░'.repeat(progressBarLength - filledLength);

  // Badge display (show first 8, or "X more" if > 8)
  let badgeDisplay = '';
  if (userBadges.length > 0) {
    const displayBadges = userBadges.slice(0, 8);
    badgeDisplay = displayBadges.map(b => b.emoji).join(' ');
    if (userBadges.length > 8) {
      badgeDisplay += ` +${userBadges.length - 8} more`;
    }
  } else {
    badgeDisplay = '*No badges yet*';
  }

  const embed = new EmbedBuilder()
    .setColor(0x0080FF)
    .setTitle('📊 Personal Study Statistics')
    .setDescription(
      `**Level ${currentLevel}** ${progressBar} ${progress.toFixed(0)}%\n` +
      `${currentXp.toLocaleString()} XP • ${xpToNext.toLocaleString()} XP to Level ${currentLevel + 1}`
    )
    .addFields(
      { name: '📅 Timeframe', value: '**Daily**\n**Weekly**\n**Monthly**\n**All-time**', inline: true },
      { name: '⏱️ Hours', value: `${formatHours(dailyHours)}\n${formatHours(weeklyHours)}\n${formatHours(monthlyHours)}\n${formatHours(allTimeHours)}`, inline: true },
      { name: '🏆 Place', value: `${dailyRankText}\n${weeklyRankText}\n${monthlyRankText}\n${allTimeRankText}`, inline: true },
      { name: '📚 Total Sessions', value: `**${stats.totalSessions}**`, inline: true },
      { name: '📈 Hours/day (' + monthName + ')', value: `**${avgPerDay.toFixed(1)} h**`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '🔥 Current Streak', value: `**${stats.currentStreak}** days ${currentStreakEmojis}`, inline: true },
      { name: '💪 Longest Streak', value: `**${stats.longestStreak}** days ${longestStreakEmojis}`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: `🏆 Badges (${userBadges.length})`, value: badgeDisplay, inline: false }
    )
    .setFooter({
      text: user.username,
      iconURL: avatarUrl
    });

  await interaction.reply({
    embeds: [embed],
    ephemeral: false,
  });
  return;
}
```

**Checklist:**
- [ ] Update /mystats to show level & XP
- [ ] Add progress bar to next level
- [ ] Display badges (emojis)
- [ ] Test visual layout

---

#### **Task 3.2: Add /badges Command**

**File:** `src/bot.ts`

```typescript
// Add new command definition
new SlashCommandBuilder()
  .setName('badges')
  .setDescription('View all your unlocked badges'),

// Add command handler
if (commandName === 'badges') {
  const stats = await statsService.getUserStats(user.id);

  if (!stats) {
    await interaction.reply({
      content: 'No stats yet! Complete sessions to unlock badges.',
      ephemeral: true,
    });
    return;
  }

  const userBadges = await badgeService.getUserBadges(user.id);

  if (userBadges.length === 0) {
    await interaction.reply({
      content: '🏆 You haven\'t unlocked any badges yet! Keep studying to earn your first badge.',
      ephemeral: true,
    });
    return;
  }

  // Group badges by category
  const categories = ['milestone', 'time', 'streak', 'diversity', 'intensity', 'social'];
  const fields: any[] = [];

  for (const category of categories) {
    const categoryBadges = userBadges.filter(b => b.category === category);
    if (categoryBadges.length === 0) continue;

    const badgeList = categoryBadges
      .map(b => `${b.emoji} **${b.name}** - *${b.description}*`)
      .join('\n');

    fields.push({
      name: category.charAt(0).toUpperCase() + category.slice(1),
      value: badgeList,
      inline: false,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xFFD700) // Gold
    .setTitle(`🏆 Your Badges (${userBadges.length})`)
    .addFields(fields)
    .setFooter({ text: `Keep grinding to unlock more badges!` });

  await interaction.reply({
    embeds: [embed],
    ephemeral: false,
  });
  return;
}
```

**Checklist:**
- [ ] Add /badges command to command list
- [ ] Implement /badges handler
- [ ] Group badges by category
- [ ] Test badge display

---

#### **Task 3.3: Post Badge Unlocks to Feed**

**File:** `src/bot.ts`

```typescript
// Create helper function
async function postBadgeUnlockToFeed(
  interaction: CommandInteraction | ModalSubmitInteraction,
  username: string,
  avatarUrl: string,
  badges: BadgeDefinition[]
) {
  try {
    const config = await getServerConfig(interaction.guildId!);
    if (!config || !config.feedChannelId) return;

    const channel = await client.channels.fetch(config.feedChannelId);
    if (!channel || !channel.isTextBased()) return;

    const textChannel = channel as TextChannel;

    for (const badge of badges) {
      const embed = new EmbedBuilder()
        .setColor(
          badge.rarity === 'legendary' ? 0xFF00FF :
          badge.rarity === 'epic' ? 0x9B59B6 :
          badge.rarity === 'rare' ? 0x3498DB :
          0x2ECC71
        )
        .setAuthor({
          name: `${username} ${badge.emoji}`,
          iconURL: avatarUrl
        })
        .setDescription(`🏆 **Unlocked: ${badge.name}**\n*${badge.description}*`);

      const message = await textChannel.send({ embeds: [embed] });
      await message.react(badge.emoji).catch(() => {});
    }
  } catch (error) {
    console.error('Error posting badge unlock to feed:', error);
  }
}

// Call in session completion handler
if (newBadges.length > 0) {
  const badgeDetails = newBadges.map(id => getBadge(id)).filter(b => b) as BadgeDefinition[];

  // Post to feed
  await postBadgeUnlockToFeed(
    interaction,
    user.username,
    avatarUrl,
    badgeDetails
  );
}
```

**Checklist:**
- [ ] Create badge unlock feed post function
- [ ] Color-code by rarity
- [ ] Post when badges are unlocked
- [ ] Test feed posts

---

## 🧪 Testing Checklist

### **XP System Tests**

- [ ] New user gets correct initial XP after first session
- [ ] XP calculation is accurate (10 XP/hour)
- [ ] Session completion bonus (25 XP) is awarded
- [ ] First session of day bonus (25 XP) is awarded correctly
- [ ] Streak milestone XP (100/500) is awarded correctly
- [ ] Level is calculated correctly from XP
- [ ] Level-up messages appear when leveling up
- [ ] Multiple levels can be gained in one session (edge case)

### **Badge System Tests**

- [ ] First Steps badge unlocks on first session
- [ ] Time-based badges unlock at correct thresholds (10h, 50h, 100h)
- [ ] Streak badges unlock at correct streaks (3, 7, 30 days)
- [ ] Diversity badges unlock when trying different activities
- [ ] Marathon badges unlock for long sessions (4h, 8h)
- [ ] Speed Demon unlocks for 5 sessions in one day
- [ ] Early Bird/Night Owl track time-of-day correctly
- [ ] Badges don't unlock twice (duplicate check)
- [ ] Badge XP rewards are awarded
- [ ] Badge unlocks post to feed

### **/mystats Tests**

- [ ] Level and XP display correctly
- [ ] Progress bar renders correctly
- [ ] Progress percentage is accurate
- [ ] Badges display (emojis)
- [ ] "X more badges" shows if > 8 badges
- [ ] All existing stats still display correctly

### **/badges Tests**

- [ ] Shows all unlocked badges
- [ ] Groups by category correctly
- [ ] Handles 0 badges gracefully
- [ ] Descriptions display correctly

### **Edge Cases**

- [ ] User with 0 XP displays correctly
- [ ] User at max level (100) doesn't break
- [ ] Very long session (12+ hours) calculates XP correctly
- [ ] Session on day boundary (11:59 PM) counts correctly
- [ ] Database migration for existing users works

---

## 📈 Success Metrics

### **Week 1 Goals**

- [ ] XP system awards correctly for all session types
- [ ] Leveling displays in all relevant places
- [ ] No errors in production logs
- [ ] 80%+ of sessions award correct XP

### **Week 2 Goals**

- [ ] At least 10 badges are unlockable
- [ ] Badge unlock rate > 50% for first session
- [ ] Badge feed posts work 100% of time
- [ ] No duplicate badge unlocks

### **Week 3 Goals**

- [ ] /mystats shows all new features
- [ ] /badges command works for all users
- [ ] Visual design is clean and readable
- [ ] User feedback is positive

### **Overall Phase 1 Success**

- [ ] 30% increase in daily active users
- [ ] Users check /mystats 2x more often
- [ ] Session completion rate increases by 20%
- [ ] Positive user feedback on gamification

---

## 🚀 Deployment Plan

### **Pre-Deployment**

1. [ ] Run migration script to add XP/level to existing users
2. [ ] Test on development bot instance
3. [ ] Get feedback from 5-10 beta testers
4. [ ] Fix any bugs found

### **Deployment**

1. [ ] Deploy during low-traffic time (late evening)
2. [ ] Monitor logs for errors
3. [ ] Post announcement in Discord about new features
4. [ ] Create tutorial/walkthrough for new features

### **Post-Deployment**

1. [ ] Monitor user engagement metrics
2. [ ] Collect user feedback
3. [ ] Fix any issues quickly
4. [ ] Plan Phase 2 based on learnings

---

## 📚 Additional Files Needed

- [ ] `src/types.ts` - Add new interfaces (BadgeDefinition, updated UserStats)
- [ ] `src/utils/xp.ts` - XP calculation utilities
- [ ] `src/services/xp.ts` - XP service
- [ ] `src/services/badges.ts` - Badge service
- [ ] `src/data/badges.ts` - Badge definitions
- [ ] `src/migrations/phase1-xp-system.ts` - Migration script

---

## 🎯 Next Steps After Phase 1

Once Phase 1 is complete and stable:

1. **Gather Data** - Analyze which badges are most earned, level distribution
2. **User Feedback** - Survey users on what they want next
3. **Phase 2 Planning** - Prioritize social features (buddies, leaderboards)
4. **Iterate** - Add more badges based on user behavior

---

*Ready to start implementation? Let's begin with Week 1, Task 1.1!*
