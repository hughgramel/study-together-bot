# 🎮 Phase 2: Social & Competitive Features - Implementation Plan

**Timeline:** 3-4 weeks
**Priority:** HIGH
**Goal:** Add social engagement and XP-based competition to amplify the core gamification loop

**Prerequisites:** Phase 1 complete (XP, leveling, badges implemented)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Schema Changes](#database-schema-changes)
3. [Implementation Tasks](#implementation-tasks)
4. [Testing Checklist](#testing-checklist)
5. [Success Metrics](#success-metrics)

---

## 🎯 Overview

### What We're Building

Phase 2 transforms the individual XP system into a social, competitive experience:

- **XP Leaderboards:** Compete on XP/level, not just time
- **Session Reactions:** React to friends' sessions with emoji kudos
- **Badge Showcase:** Display badges on leaderboards and profiles
- **User Profiles:** Rich profile view with level, badges, and achievements
- **Weekly Challenges:** Bonus XP for hitting weekly targets
- **Cheers System:** Give/receive encouragement on sessions

### Why Phase 2?

Phase 1 gave users individual progression. Phase 2 creates:
- **Social proof:** See others' achievements
- **Friendly competition:** Compete on levels, not just hours
- **Community engagement:** React and cheer on friends
- **Retention:** Weekly challenges keep users coming back

---

## 🗄️ Database Schema Changes

### 1. **Session Posts Collection** (`discord-data/sessionPosts/posts/{messageId}`)

**Purpose:** Track session feed posts for reactions and cheers

```typescript
interface SessionPost {
  messageId: string;           // Discord message ID
  userId: string;              // User who completed session
  username: string;
  guildId: string;
  channelId: string;
  sessionId: string;           // Reference to completed session
  duration: number;            // Session duration in seconds
  xpGained: number;            // XP awarded for this session
  levelGained?: number;        // If leveled up, the new level
  badgesUnlocked?: string[];   // Badge IDs unlocked in this session
  postedAt: Timestamp;

  // Reaction tracking
  reactions: {
    [emoji: string]: string[]; // emoji -> array of user IDs who reacted
  };
  cheers: Array<{              // Cheers/kudos given
    userId: string;
    username: string;
    message: string;
    timestamp: Timestamp;
  }>;
}
```

### 2. **User Stats Updates** (extend existing)

```typescript
interface UserStats {
  // ... existing Phase 1 fields ...

  // Social engagement
  reactionsReceived: number;    // Total reactions on their posts
  reactionsGiven: number;       // Total reactions given to others
  cheersReceived: number;       // Total cheers received
  cheersGiven: number;          // Total cheers given to others

  // Weekly challenge tracking
  weeklyXpEarned: {             // Map of week key -> XP earned
    [weekKey: string]: number;  // e.g., "2025-W03" -> 1250
  };
  weeklyStreakCount: number;    // Consecutive weeks hitting target

  // Additional stats for profiles
  favoriteActivity?: string;    // Most common activity type
  peakLevel?: number;           // Highest level reached (for rollback safety)
  firstBadgeUnlockedAt?: Timestamp;
}
```

### 3. **Weekly Challenges Collection** (`discord-data/challenges/weekly/{weekKey}`)

```typescript
interface WeeklyChallenge {
  weekKey: string;              // ISO week format "2025-W03"
  startDate: Timestamp;
  endDate: Timestamp;

  // Challenge parameters
  targetXp: number;             // XP goal for the week
  bonusXp: number;              // Bonus XP for completing
  bonusBadge?: string;          // Optional badge for completion

  // Participant tracking
  participants: string[];       // User IDs who participated
  completedBy: string[];        // User IDs who completed

  // Leaderboard data (top 10)
  topEarners: Array<{
    userId: string;
    username: string;
    xpEarned: number;
    level: number;
  }>;
}
```

---

## 📝 Implementation Tasks

### **Week 1: XP Leaderboards**

#### **Task 1.1: Add XP Sort to Leaderboard**

**Goal:** Allow users to view leaderboards sorted by XP/level instead of just time

**Files:**
- `src/bot.ts` (modify /leaderboard command)

**Implementation:**
1. Update leaderboard dropdown menu to include XP options:
   - Daily XP
   - Weekly XP
   - Monthly XP
   - All-time XP (or by level)
2. Create `getXpLeaderboard()` helper function
3. Query Firestore ordered by `xp` DESC or `level` DESC
4. Format leaderboard with level badges (🥇🥈🥉 + level icons)
5. Display: "Level X • Y XP" for each user

**Display Format:**
```
🏆 Weekly XP Leaderboard

🥇 Level 15 • @user1 — 2,450 XP
🥈 Level 12 • @user2 — 1,820 XP
🥉 Level 10 • @user3 — 1,350 XP
4️⃣ Level 9 • @user4 — 980 XP
...
```

**Checklist:**
- [ ] Add XP leaderboard options to dropdown
- [ ] Implement `getXpLeaderboard()` helper
- [ ] Query Firestore by XP/level
- [ ] Format with level display
- [ ] Test with multiple users
- [ ] Handle tie-breaking (by XP if same level)
- [ ] Commit: "Add XP-based leaderboard views"

---

#### **Task 1.2: Show Badges on Leaderboards**

**Goal:** Display badge count or top badges next to usernames

**Implementation:**
1. When fetching leaderboard data, also fetch badge counts
2. Display badge count in leaderboard entry: "🏆 12"
3. On detailed view, show top 3 badge emojis
4. Optional: Color-code by badge rarity (most rare badge determines color)

**Display Enhancement:**
```
🥇 Level 15 • @user1 — 2,450 XP 🏆 15 🔥💎⚡
```

**Checklist:**
- [ ] Fetch badge data with leaderboard queries
- [ ] Display badge count
- [ ] Show top badge emojis
- [ ] Test visual layout
- [ ] Commit: "Show badges on leaderboards"

---

### **Week 2: Session Reactions & Social Features**

#### **Task 2.1: Track Session Posts in Database**

**Goal:** Create database entries for session feed posts to enable reactions

**Files:**
- `src/bot.ts` (modify session completion handlers)
- `src/services/posts.ts` (new)

**Implementation:**
1. Create `PostService` class
2. Implement `createSessionPost()` method
3. When posting to feed, save post metadata to Firestore
4. Store: messageId, userId, duration, xpGained, timestamp
5. Initialize reactions object as empty
6. Initialize cheers array as empty

**Checklist:**
- [ ] Create `src/services/posts.ts`
- [ ] Implement `PostService` class
- [ ] Save session posts to Firestore
- [ ] Test post creation
- [ ] Verify messageId is captured
- [ ] Commit: "Add session post tracking"

---

#### **Task 2.2: Implement Reaction System**

**Goal:** Allow users to react to session posts and track reactions

**Files:**
- `src/bot.ts` (add reaction listeners)
- `src/services/posts.ts` (extend)

**Implementation:**
1. Add `messageReactionAdd` event listener
2. Check if reaction is on a session post (query Firestore by messageId)
3. If yes, update post's reactions map
4. Increment reactionsReceived for post author
5. Increment reactionsGiven for reactor
6. Add console log for debugging
7. Handle reaction removal (`messageReactionRemove`)

**Allowed Reactions:**
- ❤️ (love)
- 🔥 (fire)
- 💪 (strong)
- 👏 (clap)
- 🎉 (celebrate)

**Checklist:**
- [ ] Add messageReactionAdd listener
- [ ] Query session posts by messageId
- [ ] Update reactions map in Firestore
- [ ] Update user stats (reactionsReceived/Given)
- [ ] Handle reaction removal
- [ ] Test with multiple reactions
- [ ] Test with multiple users
- [ ] Commit: "Implement session post reactions"

---

#### **Task 2.3: Cheers/Kudos System**

**Goal:** Allow users to leave encouraging comments on sessions

**Command:** `/cheer @user {message}`

**Implementation:**
1. Add new slash command: `/cheer`
2. Parameters:
   - `user` (required): User to cheer
   - `message` (required): Encouraging message
3. Find user's most recent session post
4. Add cheer to post's cheers array
5. Update cheersReceived/Given stats
6. Send ephemeral confirmation to cheerer
7. Optionally DM the recipient (notify of cheer)

**Checklist:**
- [ ] Add /cheer command definition
- [ ] Implement command handler
- [ ] Find user's recent session post
- [ ] Add cheer to Firestore
- [ ] Update user stats
- [ ] Send confirmation
- [ ] Test cheering flow
- [ ] Test edge cases (no recent session)
- [ ] Commit: "Add /cheer command for kudos"

---

### **Week 3: User Profiles**

#### **Task 3.1: Create /profile Command**

**Goal:** Rich profile view with all user achievements and stats

**Command:** `/profile [@user]`

**Display Includes:**
- Level and XP with progress bar
- Total badges (with showcase of rarest)
- Total sessions and hours
- Current and longest streak
- Favorite activity (most common)
- Social stats (reactions received/given, cheers)
- Recent achievements (last 3 badges)

**Embed Layout:**
```
🎯 @username's Profile

**Level 15** ██████████░░░░░ 67%
2,450 XP • 350 XP to Level 16

🏆 Badges (15/20)
💎 Master • ⚡ Immortal • 🔥 On Fire

📊 Statistics
Total Sessions: 87 • Total Hours: 52.3h
Current Streak: 12 days 🔥 • Longest: 23 days

❤️ Social
Reactions: 234 received • 189 given
Cheers: 45 received • 52 given

🎨 Favorite Activity
Coding (42 sessions)
```

**Implementation:**
1. Add /profile command (optional user parameter)
2. Fetch user stats from Firestore
3. Fetch user badges
4. Calculate favorite activity (max count in activityTypes)
5. Build embed with all sections
6. Color code by level tier (1-10: green, 11-25: blue, 26-50: purple, 51+: gold)

**Checklist:**
- [ ] Add /profile command definition
- [ ] Implement handler with optional user param
- [ ] Fetch and calculate all stats
- [ ] Build comprehensive embed
- [ ] Add color coding by level
- [ ] Test with various users
- [ ] Test with no badges
- [ ] Test with missing stats
- [ ] Commit: "Add /profile command"

---

#### **Task 3.2: Add Quick Profile to Feed Posts**

**Goal:** Make feed posts interactive - click for profile

**Implementation:**
1. Add "View Profile" button to session feed embeds
2. Use Discord button component
3. On click, show ephemeral profile summary
4. Include quick stats and badges

**Checklist:**
- [ ] Add button to session embeds
- [ ] Create button interaction handler
- [ ] Show ephemeral profile on click
- [ ] Test button interaction
- [ ] Commit: "Add profile button to feed posts"

---

### **Week 4: Weekly Challenges**

#### **Task 4.1: Weekly XP Challenge System**

**Goal:** Automated weekly XP goals with bonus rewards

**Features:**
- Every week has an XP target (e.g., 500 XP)
- Users who hit target get bonus XP (e.g., +100)
- Optional: Bonus badge for 4-week streak
- Leaderboard shows top earners for the week

**Implementation:**
1. Create `ChallengeService` class
2. Implement `getCurrentWeekChallenge()` - creates if doesn't exist
3. Implement `trackWeeklyXp(userId, xpGained)` - called after every session
4. Implement `checkWeeklyChallengeCompletion(userId)`
5. Award bonus XP when target hit
6. Add `/challenge` command to view current week's progress

**Weekly Challenge Embed:**
```
⚡ Weekly Challenge: Week 3, 2025

🎯 Goal: Earn 500 XP this week
🏆 Reward: +100 Bonus XP

Your Progress:
██████░░░░ 320 / 500 XP (64%)

🔥 Top Earners
1. @user1 — 780 XP ✅
2. @user2 — 650 XP ✅
3. You — 320 XP

Time Remaining: 3 days, 12 hours
```

**Checklist:**
- [ ] Create `src/services/challenges.ts`
- [ ] Implement ChallengeService
- [ ] Auto-create weekly challenges
- [ ] Track XP per week
- [ ] Award completion bonuses
- [ ] Add /challenge command
- [ ] Show progress bar
- [ ] Show top earners
- [ ] Test week rollovers
- [ ] Commit: "Add weekly XP challenges"

---

#### **Task 4.2: Challenge Notifications**

**Goal:** Notify users when they complete weekly challenge

**Implementation:**
1. When user completes weekly target, send DM (if enabled)
2. Show in feed as special post
3. Update /stats to show weekly streak count

**Notification Message:**
```
🎉 Weekly Challenge Complete!

You hit 500 XP this week and earned:
✨ +100 Bonus XP
🏆 Weekly Warrior badge (4-week streak)

Keep grinding! Next week's challenge starts Monday.
```

**Checklist:**
- [ ] Detect challenge completion
- [ ] Send DM notification (with permission)
- [ ] Post to feed
- [ ] Award bonus XP
- [ ] Award streak badges
- [ ] Test notifications
- [ ] Commit: "Add weekly challenge notifications"

---

### **Week 4 (cont.): Polish & Enhancements**

#### **Task 4.3: Enhanced /stats with Social**

**Goal:** Add social stats to /stats command

**New Fields to Display:**
- Reactions received/given
- Cheers received/given
- Weekly challenge progress
- Weekly streak count

**Checklist:**
- [ ] Update /stats embed
- [ ] Add social stats section
- [ ] Add weekly challenge section
- [ ] Test layout
- [ ] Commit: "Add social stats to /stats command"

---

#### **Task 4.4: Reaction Badges**

**Goal:** Add badges for social engagement

**New Badges:**
1. **Cheerleader** (🎺) - Give 10 cheers to others (common)
2. **Motivator** (💬) - Give 50 cheers (rare)
3. **Popular** (⭐) - Receive 100 reactions (rare)
4. **Influencer** (👑) - Receive 500 reactions (epic)

**Implementation:**
1. Add badge definitions to `src/data/badges.ts`
2. Update `BadgeService` to check social stats
3. Award on reaction/cheer milestones

**Checklist:**
- [ ] Add 4 social badges to definitions
- [ ] Update badge checking logic
- [ ] Test badge unlocks
- [ ] Verify XP rewards
- [ ] Commit: "Add social engagement badges"

---

## 🧪 Testing Checklist

### XP Leaderboards
- [ ] Daily XP leaderboard shows correct data
- [ ] Weekly XP leaderboard aggregates correctly
- [ ] Monthly XP leaderboard works
- [ ] All-time level leaderboard sorts by level then XP
- [ ] Badge counts display correctly
- [ ] Top badge emojis show
- [ ] Handles tie-breaking
- [ ] "Your rank" displays correctly

### Reactions
- [ ] Reaction on session post updates database
- [ ] reactionsReceived increments for post author
- [ ] reactionsGiven increments for reactor
- [ ] Multiple reactions from same user counted once
- [ ] Reaction removal decrements counts
- [ ] Only whitelisted emojis counted (or all?)
- [ ] Non-session posts don't trigger tracking

### Cheers System
- [ ] /cheer command works
- [ ] Finds user's recent session
- [ ] Adds cheer to post
- [ ] Updates stats correctly
- [ ] Handles user with no sessions
- [ ] Handles self-cheers (allowed or blocked?)
- [ ] Confirmation message shows

### Profiles
- [ ] /profile shows own profile
- [ ] /profile @user shows other user
- [ ] All stats display correctly
- [ ] Favorite activity calculated correctly
- [ ] Badge showcase shows rarest badges
- [ ] Social stats display
- [ ] Color coding by level works
- [ ] Handles new user gracefully

### Weekly Challenges
- [ ] Challenge auto-creates each week
- [ ] XP tracking works
- [ ] Progress bar accurate
- [ ] Completion triggers bonus
- [ ] Leaderboard shows top earners
- [ ] Week rollover works correctly
- [ ] Streak tracking works
- [ ] /challenge command displays correctly

### Edge Cases
- [ ] User with 0 social engagement
- [ ] Reacting to very old posts
- [ ] Week boundary (Sunday → Monday)
- [ ] Challenge completion on last day
- [ ] Multiple challenge completions
- [ ] Very active user (1000+ reactions)

---

## 📈 Success Metrics

### Week 1-2 Goals (XP Leaderboards & Reactions)
- [ ] XP leaderboards accessed by 50%+ of active users
- [ ] Average 3+ reactions per session post
- [ ] 30% of users react to others' posts
- [ ] Badge display on leaderboards increases engagement

### Week 3-4 Goals (Profiles & Challenges)
- [ ] 40%+ of users check their profile
- [ ] 30%+ of users check others' profiles
- [ ] 60%+ participation in weekly challenge
- [ ] 30%+ complete weekly challenge
- [ ] Average 2+ cheers per active user

### Overall Phase 2 Success
- [ ] 50% increase in session completion rate
- [ ] 40% increase in daily active users
- [ ] Users spend 3x more time in Discord (checking feed, profiles)
- [ ] Positive feedback on social features
- [ ] No critical bugs
- [ ] System stable under increased load
- [ ] 80%+ weekly challenge completion rate (target is achievable)

---

## 🚀 Deployment Plan

### Pre-Deployment
1. [ ] Complete all Phase 2 tasks
2. [ ] Run comprehensive tests
3. [ ] Beta test with 10-20 users
4. [ ] Fix bugs found in beta
5. [ ] Update documentation
6. [ ] Create rollback plan

### Deployment
1. [ ] Deploy during low-traffic period
2. [ ] Monitor logs closely (first 2 hours)
3. [ ] Announce new features in Discord
4. [ ] Create tutorial for social features
5. [ ] Post about weekly challenges

### Post-Deployment
1. [ ] Monitor first weekly challenge (full week)
2. [ ] Collect user feedback
3. [ ] Analyze engagement metrics
4. [ ] Fix any issues quickly
5. [ ] Plan Phase 3 based on learnings

---

## 🎯 Phase 3 Ideas (Future)

Potential features for Phase 3:
- **Study Buddies:** Pair users for accountability
- **Team Challenges:** Guilds/squads compete together
- **Seasonal Events:** Limited-time badges and XP bonuses
- **Achievements:** Meta-achievements for badge collecting
- **Leaderboard Rewards:** Monthly prizes for top earners
- **Daily Quests:** Small daily XP bonuses (e.g., "complete 2 sessions")
- **XP Shop:** Spend XP on cosmetics or perks
- **Rich Presence:** Discord status showing study session

---

## 📚 Additional Files Needed

- [ ] `src/services/posts.ts` - Session post tracking
- [ ] `src/services/challenges.ts` - Weekly challenge system
- [ ] `src/data/badges.ts` - Add 4 social badges (extend existing)
- [ ] `src/utils/leaderboard.ts` - Leaderboard helpers (optional)
- [ ] Update `src/types.ts` - Add SessionPost, WeeklyChallenge interfaces
- [ ] Update `DATABASE_SCHEMA.md` - Document new collections

---

**Ready to begin Phase 2?**

Start with Week 1, Task 1.1: XP Leaderboards
