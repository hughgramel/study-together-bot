# Phase 2: Social & Competitive Features - Planning Summary

## 🎯 Overview

Phase 2 transforms the individual XP system (Phase 1) into a **social, competitive experience** that drives engagement through community interaction and friendly competition.

**Timeline:** 3-4 weeks
**Goal:** 50% increase in user engagement through social features

---

## 🚀 Key Features

### 1. **XP Leaderboards** (Week 1)
- **What:** Leaderboards sorted by XP/level instead of just time
- **Why:** Recognizes efficient studying, not just long hours
- **Views:** Daily XP, Weekly XP, Monthly XP, All-time Level
- **Enhancement:** Badge counts displayed next to usernames

**Impact:** Friendly competition on leveling, not just grinding hours

---

### 2. **Session Reactions** (Week 2)
- **What:** React to friends' session posts with emoji (❤️ 🔥 💪 👏 🎉)
- **Why:** Low-friction way to support and celebrate others
- **Tracking:** Counts reactionsReceived and reactionsGiven in user stats
- **Data:** SessionPost collection stores reactions by messageId

**Impact:** Creates social proof and community engagement

---

### 3. **Cheers/Kudos System** (Week 2)
- **What:** `/cheer @user {message}` - Leave encouraging comments
- **Why:** More meaningful interaction than just reactions
- **Tracking:** Counts cheersReceived and cheersGiven
- **Storage:** Cheers stored on SessionPost with username and timestamp

**Impact:** Builds supportive community culture

---

### 4. **User Profiles** (Week 3)
- **What:** `/profile [@user]` - Rich profile view with achievements
- **Display:**
  - Level and XP progress
  - Badge showcase (rarest badges highlighted)
  - Total sessions and hours
  - Streaks (current and longest)
  - Social stats (reactions, cheers)
  - Favorite activity

- **Enhancement:** "View Profile" button on feed posts

**Impact:** Personal achievement showcase, encourages comparison and aspiration

---

### 5. **Weekly XP Challenges** (Week 4)
- **What:** Automated weekly XP goals with bonus rewards
- **How:**
  - Each week has a target (e.g., 500 XP)
  - Hit target = bonus XP (e.g., +100)
  - Consecutive weeks = streak bonuses
- **Command:** `/challenge` shows progress and top earners
- **Notifications:** DM when completing challenge

**Impact:** Creates recurring engagement loop, brings users back weekly

---

## 🗄️ Database Changes

### New Collections

**1. SessionPosts** (`discord-data/sessionPosts/posts/{messageId}`)
- Tracks session feed posts for reactions and cheers
- Key fields: userId, duration, xpGained, reactions map, cheers array
- Enables social features on historical posts

**2. WeeklyChallenge** (`discord-data/challenges/weekly/{weekKey}`)
- One document per week (e.g., "2025-W03")
- Tracks participants, completions, top earners
- Auto-creates on week rollover

### Extended UserStats

New fields (all optional for backward compatibility):
- Social: `reactionsReceived`, `reactionsGiven`, `cheersReceived`, `cheersGiven`
- Weekly: `weeklyXpEarned` (map), `weeklyStreakCount`
- Profile: `favoriteActivity`, `peakLevel`, `firstBadgeUnlockedAt`

---

## 🎮 New Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/profile [@user]` | View user profile with all stats | `/profile @alice` |
| `/cheer @user {msg}` | Send encouragement | `/cheer @bob Great work!` |
| `/challenge` | View weekly XP challenge | `/challenge` |
| `/leaderboard` (enhanced) | Now includes XP views | Daily/Weekly/Monthly XP |

---

## 🏆 New Badges (4 Social Badges)

- **Cheerleader** 🎺 - Give 10 cheers (Common, 50 XP)
- **Motivator** 💬 - Give 50 cheers (Rare, 100 XP)
- **Popular** ⭐ - Receive 100 reactions (Rare, 100 XP)
- **Influencer** 👑 - Receive 500 reactions (Epic, 250 XP)

**Total Badges:** 20 (Phase 1) + 4 (Phase 2) = **24 badges**

---

## 📊 Success Metrics

### Engagement Targets
- **XP Leaderboards:** 50%+ of active users view them
- **Reactions:** Average 3+ reactions per session post
- **Participation:** 30% of users react to others' posts
- **Cheers:** Average 2+ cheers per active user
- **Weekly Challenge:** 60% participation, 30% completion

### Overall Goals
- **50% increase** in session completion rate
- **40% increase** in daily active users
- **3x more time** spent in Discord (checking feed, profiles)
- Positive user feedback on social features

---

## 🔑 Key Design Decisions

### 1. **Reaction Tracking**
- **Decision:** Store reactions in SessionPost collection, not subcollection
- **Why:** Simpler queries, easier to aggregate stats
- **Tradeoff:** Slightly larger documents, but better performance

### 2. **Weekly Challenges**
- **Decision:** Auto-create challenges, don't require opt-in
- **Why:** Lower barrier to entry, more inclusive
- **Target:** 500 XP/week (achievable with ~3-4 hours of study)

### 3. **Favorite Activity**
- **Decision:** Calculate from most common activity type
- **Why:** Simple, no manual selection needed
- **Display:** Shows engagement diversity

### 4. **Profile Access**
- **Decision:** Anyone can view anyone's profile
- **Why:** Transparency encourages healthy competition
- **Privacy:** No DM or personal data exposed

### 5. **Cheer System**
- **Decision:** Allow self-cheers? **No** - blocked in implementation
- **Why:** Cheers should be social gestures, not self-promotion
- **Alternative:** Users can react to their own posts (Discord default)

---

## ⚠️ Technical Considerations

### Performance
- **Session posts:** New collection adds 1 write per session (minimal overhead)
- **Reactions:** Event-driven, only writes when reactions occur
- **Weekly challenges:** Single document per week, lightweight updates

### Scalability
- **Reaction maps:** May need refactoring if >100 reactions per post
- **Weekly leaderboards:** Denormalized approach for fast queries
- **Firestore limits:** Monitor document size, consider subcollections if needed

### Backward Compatibility
- All Phase 2 fields are optional (`?` syntax)
- Existing users get default values (0, [], {})
- No breaking changes to Phase 1 features

---

## 🛠️ Implementation Order (4 Weeks)

**Week 1:** XP Leaderboards + Badge Display
- Foundation for competitive features
- Low risk, high impact
- Tests Firestore query performance

**Week 2:** Reactions + Cheers
- Core social features
- Requires event listeners
- Most complex week

**Week 3:** User Profiles
- Showcase for Phase 1 & 2 data
- Relatively straightforward
- High user value

**Week 4:** Weekly Challenges
- Engagement loop
- Requires cron/scheduled logic
- Polish and testing

---

## 🎯 Phase 3 Preview (Ideas)

Potential next phase features:
- **Study Buddies:** Pair users for accountability
- **Team Challenges:** Guilds/squads compete together
- **Seasonal Events:** Limited-time badges and bonuses
- **Daily Quests:** Small daily XP bonuses
- **XP Shop:** Spend XP on cosmetics or perks

**Next Steps:** After Phase 2 deployment, analyze metrics and user feedback to prioritize Phase 3.

---

## ✅ Ready to Implement?

All planning documents created:
- ✅ `PHASE_2_PLAN.md` - Detailed implementation plan
- ✅ `PHASE_2_TODO.md` - Step-by-step checklist
- ✅ `DATABASE_SCHEMA.md` - Updated with Phase 2 schema
- ✅ `PHASE_2_SUMMARY.md` - This overview document

**Next:** Review planning, provide feedback, then begin implementation with Week 1!
