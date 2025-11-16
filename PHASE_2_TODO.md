# Phase 2 Implementation Checklist: Social & Competitive Features

**Project:** Study Together Discord Bot
**Timeline:** 3-4 weeks
**Status:** Not Started
**Prerequisites:** Phase 1 Complete ✅

---

## 📋 Pre-Implementation Setup

- [ ] Review PHASE_2_PLAN.md thoroughly
- [ ] Create feature branch: `git checkout -b feature/phase-2-social`
- [ ] Review Phase 1 implementation to understand integration points
- [ ] Plan testing strategy for social features
- [ ] Set up test Discord server with multiple users

---

## 🏗️ Week 1: XP Leaderboards & Badge Display

### Step 1: XP-Based Leaderboards
- [ ] Update /leaderboard dropdown to include XP options
- [ ] Add "Daily XP", "Weekly XP", "Monthly XP", "All-time Level" views
- [ ] Create `getXpLeaderboard()` helper function
- [ ] Query Firestore ordered by XP/level
- [ ] Format leaderboard with level display
- [ ] Handle tie-breaking (same level → sort by XP)
- [ ] Test with multiple users
- [ ] Commit: "Add XP-based leaderboard views"

### Step 2: Badge Showcase on Leaderboards
- [ ] Fetch badge data alongside leaderboard queries
- [ ] Display badge count: "🏆 12"
- [ ] Show top 3 badge emojis per user
- [ ] Test visual layout
- [ ] Commit: "Display badges on leaderboards"

---

## 🎯 Week 2: Social Features (Reactions & Cheers)

### Step 3: Session Post Tracking
- [ ] Create `src/services/posts.ts`
- [ ] Implement `PostService` class
- [ ] Add `createSessionPost(messageId, userId, ...)` method
- [ ] Save post metadata to Firestore after feed post
- [ ] Update session completion handlers to track posts
- [ ] Test post creation in all session flows
- [ ] Commit: "Add session post tracking"

### Step 4: Reaction System
- [ ] Add `messageReactionAdd` event listener to bot.ts
- [ ] Add `messageReactionRemove` event listener
- [ ] Query SessionPost by messageId on reaction
- [ ] Update post's reactions map in Firestore
- [ ] Update UserStats (reactionsReceived/Given)
- [ ] Add logging for reaction events
- [ ] Test reaction adding and removal
- [ ] Test with multiple users and emojis
- [ ] Commit: "Implement session reaction tracking"

### Step 5: Cheers/Kudos Command
- [ ] Add `/cheer` slash command definition
- [ ] Parameters: `user` (required), `message` (required)
- [ ] Implement command handler
- [ ] Find user's most recent session post
- [ ] Add cheer to post's cheers array
- [ ] Update UserStats (cheersReceived/Given)
- [ ] Send confirmation to cheerer (ephemeral)
- [ ] Test cheering flow
- [ ] Handle edge cases (no recent session)
- [ ] Commit: "Add /cheer command for kudos"

---

## 👤 Week 3: User Profiles

### Step 6: /profile Command
- [ ] Add `/profile` slash command definition
- [ ] Optional parameter: `user` (defaults to self)
- [ ] Implement command handler
- [ ] Fetch user stats from Firestore
- [ ] Fetch user badges
- [ ] Calculate favorite activity (most common in activityTypes)
- [ ] Build comprehensive embed:
  - [ ] Level and XP with progress bar
  - [ ] Badge showcase (rarest badges)
  - [ ] Session and time stats
  - [ ] Streak info
  - [ ] Social stats (reactions, cheers)
  - [ ] Favorite activity
- [ ] Color code by level tier
- [ ] Test with various users
- [ ] Test edge cases (new user, no badges, etc.)
- [ ] Commit: "Add /profile command"

### Step 7: Profile Button on Feed Posts
- [ ] Add "View Profile" button to session embeds
- [ ] Implement button interaction handler
- [ ] Show ephemeral profile summary on click
- [ ] Test button interaction
- [ ] Commit: "Add profile button to feed posts"

---

## 🏆 Week 4: Weekly Challenges

### Step 8: Weekly Challenge System
- [ ] Create `src/services/challenges.ts`
- [ ] Implement `ChallengeService` class
- [ ] Implement `getCurrentWeekChallenge()` - auto-create if needed
- [ ] Implement `trackWeeklyXp(userId, xpGained)` - called after sessions
- [ ] Implement `checkWeeklyChallengeCompletion(userId)`
- [ ] Award bonus XP when target hit
- [ ] Update UserStats with weeklyXpEarned
- [ ] Test week creation and XP tracking
- [ ] Commit: "Add weekly challenge system"

### Step 9: /challenge Command
- [ ] Add `/challenge` slash command definition
- [ ] Implement command handler
- [ ] Fetch current week's challenge
- [ ] Fetch user's weekly XP progress
- [ ] Build challenge embed:
  - [ ] Weekly goal and reward
  - [ ] User's progress bar
  - [ ] Top earners leaderboard
  - [ ] Time remaining
- [ ] Test command display
- [ ] Test week rollovers
- [ ] Commit: "Add /challenge command"

### Step 10: Challenge Notifications
- [ ] Detect weekly challenge completion
- [ ] Send DM notification (if user allows)
- [ ] Post completion to feed channel
- [ ] Award bonus XP
- [ ] Track weekly streak
- [ ] Award streak badges (if applicable)
- [ ] Test notifications
- [ ] Commit: "Add weekly challenge notifications"

---

## 🎨 Polish & Additional Features

### Step 11: Update /stats with Social Data
- [ ] Add social stats section to /stats embed
- [ ] Display reactionsReceived/Given
- [ ] Display cheersReceived/Given
- [ ] Display weekly challenge progress
- [ ] Display weekly streak count
- [ ] Test layout
- [ ] Commit: "Add social stats to /stats command"

### Step 12: Social Engagement Badges
- [ ] Add 4 social badges to `src/data/badges.ts`:
  - [ ] Cheerleader (🎺) - Give 10 cheers
  - [ ] Motivator (💬) - Give 50 cheers
  - [ ] Popular (⭐) - Receive 100 reactions
  - [ ] Influencer (👑) - Receive 500 reactions
- [ ] Update BadgeService to check social stats
- [ ] Test badge unlocks
- [ ] Commit: "Add social engagement badges"

### Step 13: Update TypeScript Types
- [ ] Add `SessionPost` interface to types.ts
- [ ] Add `WeeklyChallenge` interface to types.ts
- [ ] Extend `UserStats` with Phase 2 fields
- [ ] Add proper TypeScript types for all new features
- [ ] Run `npm run build` to verify
- [ ] Commit: "Add Phase 2 TypeScript interfaces"

---

## 🧪 Comprehensive Testing

### XP Leaderboards
- [ ] Daily XP leaderboard shows correct data
- [ ] Weekly XP aggregates correctly
- [ ] Monthly XP aggregates correctly
- [ ] All-time level leaderboard sorts properly
- [ ] Badge counts display correctly
- [ ] Handles tie-breaking
- [ ] "Your rank" displays correctly

### Reactions
- [ ] Reaction adds to database
- [ ] Reaction removes from database
- [ ] Stats update correctly (reactionsReceived/Given)
- [ ] Multiple reactions from same user handled
- [ ] Only session posts tracked (not other messages)
- [ ] Handles missing posts gracefully

### Cheers
- [ ] /cheer command works
- [ ] Finds recent session
- [ ] Adds cheer to database
- [ ] Stats update correctly
- [ ] Handles no recent session
- [ ] Confirmation message shows

### Profiles
- [ ] /profile shows own profile
- [ ] /profile @user shows other profile
- [ ] All stats display correctly
- [ ] Favorite activity calculated correctly
- [ ] Badge showcase shows correct badges
- [ ] Social stats display
- [ ] Color coding works
- [ ] Handles new users

### Weekly Challenges
- [ ] Challenge auto-creates each week
- [ ] XP tracking works across sessions
- [ ] Progress bar accurate
- [ ] Completion triggers bonus XP
- [ ] Leaderboard shows top earners
- [ ] Week rollover works (Sunday → Monday)
- [ ] Streak tracking works
- [ ] /challenge displays correctly

### Edge Cases
- [ ] User with 0 social engagement
- [ ] Reacting to very old posts
- [ ] Week boundary edge cases
- [ ] Challenge completion on last minute of week
- [ ] Multiple simultaneous reactions
- [ ] Very high reaction counts (1000+)

---

## 📚 Documentation

- [ ] Update README.md with new commands
- [ ] Document /profile command
- [ ] Document /cheer command
- [ ] Document /challenge command
- [ ] Update XP leaderboard documentation
- [ ] Document social features
- [ ] Update /help command with new features
- [ ] Create Phase 2 changelog

---

## 🚀 Deployment Preparation

### Pre-Deployment
- [ ] All Phase 2 tasks complete
- [ ] All tests passing
- [ ] Beta test with 10-20 users
- [ ] Fix bugs found in beta
- [ ] Code review complete
- [ ] Documentation updated
- [ ] Rollback plan ready
- [ ] Database backup created

### Deployment
- [ ] Merge to main: `git merge feature/phase-2-social`
- [ ] Tag release: `git tag -a v3.0.0-phase2`
- [ ] **⚠️ WAIT FOR EXPLICIT USER APPROVAL ⚠️**
- [ ] Push to production
- [ ] Monitor deployment
- [ ] Verify bot comes online
- [ ] Test in production server

### Post-Deployment
- [ ] Monitor logs (first 24 hours)
- [ ] Check Firestore quota usage
- [ ] Watch for error spikes
- [ ] Collect user feedback
- [ ] Fix critical bugs quickly
- [ ] Monitor weekly challenge participation
- [ ] Track reaction and cheer usage

---

## 📊 Success Metrics

### Week 1-2 (After Deployment)
- [ ] XP leaderboards accessed by 50%+ of users
- [ ] Average 3+ reactions per session post
- [ ] 30% of users react to others' posts
- [ ] Badge display increases leaderboard engagement

### Week 3-4 (Ongoing)
- [ ] 40%+ of users check profiles
- [ ] 60%+ participation in weekly challenge
- [ ] 30%+ complete weekly challenge
- [ ] Average 2+ cheers per active user
- [ ] Positive user feedback on social features

### Overall Phase 2 Success
- [ ] 50% increase in session completion rate
- [ ] 40% increase in daily active users
- [ ] Users spend 3x more time engaging with bot
- [ ] No critical bugs
- [ ] System stable under load
- [ ] Ready for Phase 3

---

## 🎯 Phase 3 Preparation

- [ ] Analyze Phase 2 metrics
- [ ] Collect user feedback on next features
- [ ] Review reaction and cheer engagement rates
- [ ] Review weekly challenge participation
- [ ] Identify most requested features
- [ ] Plan Phase 3 (study buddies, teams, seasonal events?)
- [ ] Create Phase 3 planning document

---

**Last Updated:** 2025-01-15
**Current Status:** Planning Complete, Ready to Begin
**Estimated Implementation Time:** 3-4 weeks
