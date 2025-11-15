# Phase 1 Implementation Checklist: XP & Badge System

**Project:** Study Together Discord Bot
**Timeline:** 2-3 weeks
**Status:** Not Started

---

## 📋 Pre-Implementation Setup

- [x] Create feature branch: `git checkout -b feature/phase-1-xp-badges`
- [x] Review PHASE_1_PLAN.md thoroughly
- [ ] Back up current production database
- [ ] Set up local test Discord server
- [ ] Create test user accounts (at least 3)
- [x] Document current database schema
- [x] Review existing TypeScript interfaces in src/types.ts
- [x] Verify development environment works (`npm run dev`)
- [x] Install any missing dependencies
- [x] Create backup of src/bot.ts (critical file)

---

## 🏗️ Step 1: Update TypeScript Types

### Implementation
- [ ] Open `src/types.ts`
- [ ] Add new fields to `UserStats` interface:
  - [ ] `xp?: number` (total XP earned)
  - [ ] `level?: number` (current level)
  - [ ] `badges?: string[]` (badge IDs)
  - [ ] `badgesUnlockedAt?: { [badgeId: string]: Timestamp }`
  - [ ] `sessionsByDay?: { [date: string]: number }`
  - [ ] `activityTypes?: string[]`
  - [ ] `longestSessionDuration?: number`
  - [ ] `totalReactionsReceived?: number`
  - [ ] `totalReactionsGiven?: number`
  - [ ] `firstSessionOfDayCount?: number`
  - [ ] `sessionsBeforeNoon?: number`
  - [ ] `sessionsAfterMidnight?: number`
- [ ] Create new `BadgeDefinition` interface with all required fields
- [ ] Add TypeScript comments explaining each field
- [ ] Export both interfaces

### Verification
- [ ] Run `npm run build` - compiles without errors
- [ ] Check no breaking changes to existing code
- [ ] Verify all existing fields preserved
- [ ] Review interface in VSCode for type correctness
- [ ] Commit: `git commit -m "Add XP and badge type definitions"`

---

## 🧮 Step 2: Create XP Utility Functions

### Implementation
- [ ] Create new file: `src/utils/xp.ts`
- [ ] Implement `calculateLevel(xp: number): number`
  - [ ] Use formula: `level = Math.floor((xp / 100)^(2/3))`
  - [ ] Cap at level 100
  - [ ] Handle edge case: 0 XP = Level 1
- [ ] Implement `xpForLevel(level: number): number`
  - [ ] Use formula: `100 * Math.pow(level, 1.5)`
- [ ] Implement `xpToNextLevel(currentXp: number): number`
- [ ] Implement `levelProgress(currentXp: number): number`
  - [ ] Returns 0-100 percentage
- [ ] Implement `awardXP(currentXp, xpToAdd)` function
  - [ ] Returns object with newXp, newLevel, leveledUp, levelsGained, oldLevel
- [ ] Add JSDoc comments to all functions
- [ ] Document XP curve in file header comment

### Testing
- [ ] Create `src/utils/xp.test.ts` (or add to test suite)
- [ ] Test: Level 1 (0 XP) → Level 2 (100 XP)
- [ ] Test: Level 5 calculation
- [ ] Test: Level 10 calculation (~1500 XP)
- [ ] Test: Level 20 calculation (~5000 XP)
- [ ] Test: Edge case - 0 XP returns Level 1
- [ ] Test: Edge case - Very high XP caps at Level 100
- [ ] Test: Multiple level gains (e.g., 0 XP → 500 XP)
- [ ] Test: Progress percentage at 0%, 25%, 50%, 75%, 99%, 100%
- [ ] Test: xpToNextLevel returns correct values
- [ ] Run tests: `npm test` (all pass)

### Verification
- [ ] All unit tests pass
- [ ] TypeScript compiles without errors
- [ ] Manual verification: calculateLevel(100) = 2
- [ ] Manual verification: calculateLevel(1500) ≈ 10
- [ ] Functions are pure (no side effects)
- [ ] Commit: `git commit -m "Add XP calculation utilities with tests"`

---

## 💼 Step 3: Create XP Service

### Implementation
- [ ] Create new file: `src/services/xp.ts`
- [ ] Import Firestore types and XP utilities
- [ ] Create `XPService` class with constructor
- [ ] Implement `async awardXP(userId, amount, reason)`:
  - [ ] Fetch user stats from Firestore
  - [ ] Throw error if user not found
  - [ ] Calculate new XP and level using utils
  - [ ] Update Firestore with new values
  - [ ] Add console.log for debugging
  - [ ] Return result object
- [ ] Implement `calculateSessionXP(durationSeconds)`:
  - [ ] Formula: (durationSeconds / 3600) * 10
  - [ ] Round down with Math.floor
- [ ] Implement `getSessionXPBreakdown()`:
  - [ ] Base XP from time
  - [ ] +25 XP for session completion
  - [ ] +25 XP if first session today
  - [ ] +100 XP for 7-day streak
  - [ ] +500 XP for 30-day streak
  - [ ] Return total and breakdown array

### Testing
- [ ] Create `src/services/xp.test.ts`
- [ ] Mock Firestore database
- [ ] Test: awardXP updates database correctly
- [ ] Test: calculateSessionXP - 1 hour = 10 XP
- [ ] Test: calculateSessionXP - 30 minutes = 5 XP
- [ ] Test: calculateSessionXP - 2.5 hours = 25 XP
- [ ] Test: getSessionXPBreakdown - base only
- [ ] Test: getSessionXPBreakdown - with first session bonus
- [ ] Test: getSessionXPBreakdown - with 7-day streak bonus
- [ ] Test: getSessionXPBreakdown - with 30-day streak bonus
- [ ] Test: getSessionXPBreakdown - all bonuses combined
- [ ] Test: Level-up detection works
- [ ] Test: Error thrown for missing user
- [ ] Run tests: all pass

### Verification
- [ ] TypeScript compiles
- [ ] Service can be instantiated
- [ ] All tests pass with mocked Firestore
- [ ] Console logs show XP transactions
- [ ] No breaking changes to existing services
- [ ] Commit: `git commit -m "Add XP service with Firestore integration"`

---

## 🏆 Step 4: Create Badge Definitions

### Implementation
- [ ] Create new file: `src/data/badges.ts`
- [ ] Import `BadgeDefinition` type
- [ ] Define MILESTONE badges (5 total):
  - [ ] first_steps (1 session, 🎯, 50 XP, common)
  - [ ] dedicated (10 sessions, ⭐, 100 XP, common)
  - [ ] veteran (50 sessions, 🌟, 200 XP, rare)
  - [ ] master (100 sessions, 💎, 500 XP, epic)
  - [ ] legend (500 sessions, 👑, 1000 XP, legendary)
- [ ] Define TIME badges (5 total):
  - [ ] getting_started (10 hours, ⏱️, 50 XP, common)
  - [ ] committed (50 hours, 🕐, 100 XP, common)
  - [ ] centurion (100 hours, 💯, 200 XP, rare)
  - [ ] scholar (500 hours, 📚, 500 XP, epic)
  - [ ] sage (1000 hours, 🧙, 1000 XP, legendary)
- [ ] Define STREAK badges (4 total):
  - [ ] hot_streak (3 days, 🔥, 50 XP, common)
  - [ ] on_fire (7 days, 🔥🔥, 150 XP, rare)
  - [ ] unstoppable (30 days, 🌟, 500 XP, epic)
  - [ ] immortal (100 days, ⚡, 1500 XP, legendary)
- [ ] Define INTENSITY badges (3 total):
  - [ ] marathon (4 hours, 💪, 150 XP, rare)
  - [ ] ultra_marathon (8 hours, 🏃, 300 XP, epic)
  - [ ] speed_demon (5 sessions/day, ⚡, 100 XP, rare)
- [ ] Define DIVERSITY badges (3 total):
  - [ ] explorer (3 activities, 🎨, 50 XP, common)
  - [ ] versatile (7 activities, 🌈, 100 XP, rare)
  - [ ] renaissance (15 activities, 🎭, 250 XP, epic)
- [ ] Convert all duration thresholds to seconds
- [ ] Add `order` field to each badge (for sorting)
- [ ] Implement `getBadge(id: string)` helper
- [ ] Implement `getBadgesByCategory(category: string)` helper
- [ ] Implement `getAllBadges()` helper
- [ ] Export `BADGE_DEFINITIONS` array

### Verification
- [ ] Total badge count = 20
- [ ] All badges have unique IDs
- [ ] All emojis render in Discord (test in channel)
- [ ] All categories represented
- [ ] Thresholds are realistic and achievable
- [ ] getBadge() retrieves badges correctly
- [ ] TypeScript compiles without errors
- [ ] Test: getBadge('first_steps') returns correct badge
- [ ] Test: getBadgesByCategory('streak') returns 4 badges
- [ ] Commit: `git commit -m "Add 20 badge definitions with helpers"`

---

## 🎖️ Step 5: Create Badge Service

### Implementation
- [ ] Create new file: `src/services/badges.ts`
- [ ] Import Firestore, badge definitions, and types
- [ ] Create `BadgeService` class with constructor
- [ ] Implement `async checkAndAwardBadges(userId)`:
  - [ ] Fetch user stats from Firestore
  - [ ] Return empty array if no stats
  - [ ] Get current badges list
  - [ ] Initialize newlyUnlocked array
  - [ ] Loop through all badge definitions
  - [ ] Skip if already unlocked
  - [ ] Check conditions using helper method
  - [ ] Update Firestore with FieldValue.arrayUnion
  - [ ] Update badgesUnlockedAt map
  - [ ] Add console.log for each unlock
  - [ ] Return newly unlocked badge IDs
- [ ] Implement `async getUserBadges(userId)`:
  - [ ] Fetch user stats
  - [ ] Map badge IDs to full definitions
  - [ ] Return array of BadgeDefinition objects
- [ ] Implement `private checkBadgeCondition(badge, stats)`:
  - [ ] Handle 'sessions' type
  - [ ] Handle 'hours' type
  - [ ] Handle 'streak' type
  - [ ] Handle 'activities' type
  - [ ] Handle 'custom' type (delegate to checkCustomCondition)
- [ ] Implement `private checkCustomCondition(badgeId, stats, threshold)`:
  - [ ] speed_demon: Check sessionsByDay for any day >= 5
  - [ ] marathon: Check longestSessionDuration >= 14400 (4 hours)
  - [ ] ultra_marathon: Check longestSessionDuration >= 28800 (8 hours)
  - [ ] early_bird: Check sessionsBeforeNoon >= 5
  - [ ] night_owl: Check sessionsAfterMidnight >= 5

### Testing
- [ ] Create `src/services/badges.test.ts`
- [ ] Mock Firestore with sample UserStats
- [ ] Test: first_steps unlocks on first session
- [ ] Test: Time badges unlock at correct thresholds
- [ ] Test: Streak badges unlock correctly
- [ ] Test: Activity badges unlock when trying different types
- [ ] Test: Marathon badges unlock for long sessions
- [ ] Test: Speed demon unlocks for 5 sessions in one day
- [ ] Test: Badges don't unlock twice (duplicate check)
- [ ] Test: getUserBadges returns correct badge details
- [ ] Test: checkBadgeCondition evaluates correctly
- [ ] Test: Custom conditions work
- [ ] Run tests: all pass

### Verification
- [ ] TypeScript compiles
- [ ] All unit tests pass
- [ ] Firestore updates are atomic
- [ ] No duplicate badge unlocks possible
- [ ] Console logs show badge unlocks
- [ ] Service handles missing stats gracefully
- [ ] Commit: `git commit -m "Add badge service with unlock detection"`

---

## 🔌 Step 6: Integrate XP into Stats Service

### Implementation
- [ ] Open `src/services/stats.ts`
- [ ] Import XPService at top of file
- [ ] Import calculateLevel from utils/xp
- [ ] Add `private xpService: XPService` to StatsService class
- [ ] Initialize xpService in constructor
- [ ] Update `updateUserStats()` return type signature:
  - [ ] Add `xpGained: number`
  - [ ] Add `leveledUp: boolean`
  - [ ] Add `newLevel?: number`
- [ ] Add `private getDateKey(timestamp)` helper method
- [ ] In updateUserStats, before database update:
  - [ ] Detect if first session of the day
  - [ ] Detect if streak milestone (7 or 30 days)
  - [ ] Call xpService.getSessionXPBreakdown()
  - [ ] Store XP breakdown
- [ ] For new user creation:
  - [ ] Initialize xp with breakdown total
  - [ ] Initialize level with calculateLevel(xp)
  - [ ] Initialize badges as empty array
  - [ ] Initialize badgesUnlockedAt as empty object
  - [ ] Initialize sessionsByDay with today's date
  - [ ] Initialize all tracking fields (0 or [])
- [ ] For existing user update:
  - [ ] Call xpService.awardXP() after stats update
  - [ ] Update sessionsByDay map
  - [ ] Update longestSessionDuration if needed
  - [ ] Update firstSessionOfDayCount if applicable
- [ ] Return XP info in result object

### Verification
- [ ] TypeScript compiles without errors
- [ ] Run `npm run build`
- [ ] No breaking changes to existing functionality
- [ ] Test manually: Start and end a session
- [ ] Check Firestore: xp and level fields exist
- [ ] Check console logs for XP award messages
- [ ] Verify first session of day detection works
- [ ] Verify sessionsByDay updates correctly
- [ ] Test with existing user (backward compatible)
- [ ] Test with new user (fields initialized)
- [ ] Commit: `git commit -m "Integrate XP system into stats service"`

---

## 💬 Step 7: Update Session Completion UI

### Implementation - /end Command
- [ ] Open `src/bot.ts`
- [ ] Find `/end` modal submit handler (endSessionModal)
- [ ] Capture XP data from statsService.updateUserStats()
- [ ] Build XP message:
  - [ ] If leveledUp: "🎉 **LEVEL UP!** You're now Level X! (+Y XP)"
  - [ ] Else: "✨ +Y XP earned!"
- [ ] Append xpMessage to reply content
- [ ] Test in Discord

### Implementation - /manual Command
- [ ] Find manual session modal handler (addManualSessionModal)
- [ ] Add same XP message logic
- [ ] Capture XP data from stats update
- [ ] Build and append XP message
- [ ] Test in Discord

### Implementation - Voice Channel Auto-post
- [ ] Find voice channel disconnect handler (if exists)
- [ ] Add XP message logic
- [ ] Test by joining/leaving voice channel

### Verification
- [ ] Complete session via /end - see XP message
- [ ] Complete session via /manual - see XP message
- [ ] Voice channel session shows XP (if applicable)
- [ ] Level-up message appears when leveling up
- [ ] XP message is NOT ephemeral (shows in channel)
- [ ] Feed post still works correctly
- [ ] No console errors
- [ ] Messages are user-friendly and celebratory
- [ ] Test edge case: 0 XP session (very short)
- [ ] Test edge case: Huge XP gain (multiple levels)
- [ ] Commit: `git commit -m "Add XP display to session completion messages"`

---

## 🎖️ Step 8: Integrate Badge Checking

### Implementation
- [ ] Open `src/bot.ts`
- [ ] Import BadgeService at top
- [ ] Import getBadge helper from data/badges
- [ ] Initialize BadgeService after other services
- [ ] In `/end` modal handler, after stats update:
  - [ ] Call badgeService.checkAndAwardBadges(user.id)
  - [ ] Store newBadges array
  - [ ] If badges unlocked, build badge message
  - [ ] Map badge IDs to full definitions
  - [ ] Create emoji list: "🏆 **NEW BADGE(S)!** emoji **name**, ..."
  - [ ] Award bonus XP for each badge
  - [ ] Append badgeMessage to reply
- [ ] Repeat for manual session handler
- [ ] Repeat for voice channel handler (if applicable)

### Verification
- [ ] Complete first session - "First Steps" badge unlocks
- [ ] Badge message appears in completion reply
- [ ] Badge XP bonus is awarded
- [ ] Multiple badges can unlock at once (test with new user, long session)
- [ ] Badge message format is correct
- [ ] No duplicate badge unlocks
- [ ] Check Firestore: badges array updated
- [ ] Check Firestore: badgesUnlockedAt has timestamp
- [ ] Console logs show badge unlocks
- [ ] Test: Reach 10 hours - time badge unlocks
- [ ] Test: 7-day streak - streak badge unlocks
- [ ] Commit: `git commit -m "Add badge unlock detection to session flow"`

---

## 📊 Step 9: Update /stats Command

### Implementation
- [ ] Open `src/bot.ts`
- [ ] Find `/stats` command handler (note: was renamed from /mystats)
- [ ] Import XP utilities (calculateLevel, xpToNextLevel, levelProgress)
- [ ] After fetching user stats:
  - [ ] Call badgeService.getUserBadges(user.id)
  - [ ] Calculate currentXp, currentLevel, xpToNext, progress
- [ ] Create progress bar (20 characters):
  - [ ] Use '█' for filled
  - [ ] Use '░' for empty
  - [ ] Calculate based on progress percentage
- [ ] Create badge display:
  - [ ] Show first 8 badge emojis
  - [ ] If more than 8, add "+X more"
  - [ ] If 0 badges, show "*No badges yet*"
- [ ] Update embed description to show level and progress bar
- [ ] Add XP info: "X XP • Y XP to Level Z"
- [ ] Add badges field to embed
- [ ] Keep all existing stat fields

### Verification
- [ ] /stats command shows level prominently
- [ ] Progress bar renders correctly
- [ ] XP to next level is accurate
- [ ] Progress percentage is correct
- [ ] Badges display with emojis
- [ ] "+X more" shows if > 8 badges
- [ ] Handles 0 badges gracefully
- [ ] All existing stats still visible
- [ ] Layout is clean and readable
- [ ] Test with new user (Level 1, 0 badges)
- [ ] Test with established user (Level 10+, multiple badges)
- [ ] Embed color is correct
- [ ] Commit: `git commit -m "Enhance /stats command with XP and badges"`

---

## 🏅 Step 10: Create /badges Command

### Implementation
- [ ] Open `src/bot.ts`
- [ ] Add new SlashCommandBuilder to commands array:
  - [ ] Name: 'badges'
  - [ ] Description: 'View all your unlocked badges'
- [ ] Re-register commands (npm run build && node dist/bot.js)
- [ ] Add command handler in interactionCreate
- [ ] Check if user has stats
- [ ] Fetch user badges with badgeService.getUserBadges()
- [ ] If 0 badges, show friendly message (ephemeral)
- [ ] Group badges by category
- [ ] Create fields array for embed
- [ ] For each category with badges:
  - [ ] Format as "emoji **name** - *description*"
  - [ ] Add to fields
- [ ] Create EmbedBuilder:
  - [ ] Gold color (0xFFD700)
  - [ ] Title: "🏆 Your Badges (X)"
  - [ ] Add category fields
  - [ ] Footer: "Keep grinding to unlock more badges!"
- [ ] Reply with embed (not ephemeral)

### Verification
- [ ] /badges command appears in Discord autocomplete
- [ ] Command shows all unlocked badges
- [ ] Badges grouped by category correctly
- [ ] Category names capitalized
- [ ] Badge descriptions display
- [ ] Handles 0 badges with friendly message
- [ ] Handles 1 badge correctly
- [ ] Handles 15+ badges (test with mock data if needed)
- [ ] Gold color displays correctly
- [ ] Emoji render properly
- [ ] Not ephemeral (public reply)
- [ ] Test with multiple categories
- [ ] Test with single category
- [ ] Commit: `git commit -m "Add /badges command for viewing achievements"`

---

## 📢 Step 11: Add Badge Feed Posts

### Implementation
- [ ] Open `src/bot.ts`
- [ ] Create `postBadgeUnlockToFeed()` helper function:
  - [ ] Parameters: interaction, username, avatarUrl, badges array
  - [ ] Fetch server config
  - [ ] Check if feedChannelId exists
  - [ ] Fetch feed channel
  - [ ] For each badge:
    - [ ] Determine color based on rarity:
      - [ ] Common: 0x2ECC71 (green)
      - [ ] Rare: 0x3498DB (blue)
      - [ ] Epic: 0x9B59B6 (purple)
      - [ ] Legendary: 0xFF00FF (magenta)
    - [ ] Create embed with badge info
    - [ ] Set author with username and avatar
    - [ ] Description: "🏆 **Unlocked: BadgeName**\n*description*"
    - [ ] Send to feed channel
    - [ ] React with badge emoji (catch errors)
  - [ ] Wrap in try/catch
- [ ] In `/end` modal handler, after badge unlock:
  - [ ] Call postBadgeUnlockToFeed with new badges
- [ ] Repeat for manual session handler
- [ ] Repeat for voice channel handler (if applicable)

### Verification
- [ ] Unlock common badge - green feed post appears
- [ ] Unlock rare badge - blue feed post appears
- [ ] Unlock epic badge - purple feed post appears
- [ ] Unlock legendary badge - magenta feed post appears
- [ ] Feed posts appear immediately after session
- [ ] Multiple badges = multiple separate posts
- [ ] Auto-reaction with badge emoji works
- [ ] Handles missing feed channel gracefully (no crash)
- [ ] Handles invalid emoji gracefully (no crash)
- [ ] Feed posts show correct username and avatar
- [ ] Description formatting is correct
- [ ] Test: First session → "First Steps" in feed
- [ ] Test: 100 hours → "Centurion" in feed
- [ ] Commit: `git commit -m "Add badge unlock posts to feed channel"`

---

## 🧪 Comprehensive Testing

### New User Testing
- [ ] Create fresh test Discord account
- [ ] Join test server
- [ ] Use /start command
- [ ] Wait 10+ minutes
- [ ] Use /end command with activity type
- [ ] Verify: "First Steps" badge unlocks
- [ ] Verify: XP awarded (should be ~26+ XP: time + completion + first session)
- [ ] Verify: Level 1 displayed
- [ ] Verify: Feed post for session
- [ ] Verify: Feed post for badge unlock
- [ ] Use /stats - check all fields display
- [ ] Use /badges - check badge appears
- [ ] Complete second session same day
- [ ] Verify: No "first session" bonus second time
- [ ] Complete third session
- [ ] Verify: Stats update correctly

### Existing User Testing
- [ ] Use account with prior session history
- [ ] Check current stats (before changes)
- [ ] Complete a new session
- [ ] Verify: XP calculated correctly
- [ ] Verify: Level updates if applicable
- [ ] Verify: Existing stats preserved (totalSessions, etc.)
- [ ] Verify: No data loss
- [ ] Check /stats displays correctly
- [ ] Verify backward compatibility

### Level-Up Testing
- [ ] Use account close to level up
- [ ] OR manually set XP in Firestore to 90
- [ ] Complete session that should level up
- [ ] Verify: "🎉 LEVEL UP!" message appears
- [ ] Verify: New level shown
- [ ] Verify: XP total shown
- [ ] Check /stats shows new level
- [ ] Test multiple level gains (set XP to 0, complete 10-hour session)

### Badge Unlock Testing
- [ ] Test each badge type:
  - [ ] Milestone: Complete Nth session
  - [ ] Time: Reach hour threshold
  - [ ] Streak: Maintain streak (may need to manipulate dates)
  - [ ] Intensity: Complete long session (4+ hours)
  - [ ] Diversity: Try multiple activity types
- [ ] Test badge XP rewards are awarded
- [ ] Test multiple badges unlock at once
- [ ] Verify no duplicate unlocks
- [ ] Test badge feed posts for each rarity

### Streak Testing
- [ ] Complete session Day 1
- [ ] Complete session Day 2 (next day)
- [ ] Verify: Streak = 2
- [ ] Complete session Day 3
- [ ] Verify: Streak = 3, "Hot Streak" badge unlocks
- [ ] Skip a day
- [ ] Complete session
- [ ] Verify: Streak resets to 1
- [ ] Test 7-day milestone XP bonus
- [ ] Test 30-day milestone (may need to manipulate data)

### Edge Case Testing
- [ ] Very short session (< 1 minute) - minimal XP
- [ ] Very long session (8+ hours) - lots of XP, badges
- [ ] Session spanning midnight - date boundary
- [ ] User at max level (100) - doesn't break
- [ ] User with 0 XP - displays correctly
- [ ] User with many badges (15+) - "/badges" handles well
- [ ] Server with no feed channel configured - no crashes
- [ ] Invalid emoji in badge - reaction fails gracefully

### Command Testing
- [ ] /start - still works
- [ ] /pause - still works
- [ ] /resume - still works
- [ ] /end - shows XP, badges, feed post
- [ ] /cancel - still works
- [ ] /time - still works
- [ ] /manual - shows XP, badges
- [ ] /stats - shows level, XP, progress, badges
- [ ] /badges - shows all badges grouped
- [ ] /leaderboard - still works (existing functionality)

### Performance Testing
- [ ] Session completion < 3 seconds
- [ ] /stats loads quickly (< 2 seconds)
- [ ] /badges loads quickly
- [ ] Badge checking doesn't slow down session end
- [ ] Check Firestore read/write counts
- [ ] Monitor for quota issues

### Error Handling
- [ ] Test with missing user stats
- [ ] Test with corrupted data
- [ ] Test with missing badge definitions
- [ ] Test network errors to Firestore
- [ ] Check all console.error() calls work
- [ ] Verify no crashes on errors

---

## 🚀 Pre-Deployment

### Code Quality
- [ ] Run `npm run build` - no errors
- [ ] Run `npm test` - all tests pass
- [ ] Review all console.log statements (appropriate level)
- [ ] Remove any debugging code
- [ ] Check for TODO comments
- [ ] Review all error messages are user-friendly
- [ ] Verify no hardcoded values
- [ ] Check TypeScript strict mode compliance

### Documentation
- [ ] Update README.md with new commands
- [ ] Document /stats changes
- [ ] Document /badges command
- [ ] Update command list
- [ ] Document XP system (10 XP/hour, bonuses)
- [ ] Document badge system
- [ ] Update environment variables (if any new)
- [ ] Create changelog entry

### Database Migration (if needed)
- [ ] Create migration script: `src/migrations/phase1-xp-system.ts`
- [ ] Test migration on local database copy
- [ ] Add default values for existing users:
  - [ ] xp: 0 or calculated from totalDuration
  - [ ] level: calculateLevel(xp)
  - [ ] badges: []
  - [ ] badgesUnlockedAt: {}
  - [ ] sessionsByDay: approximate from data
  - [ ] Other fields: 0 or []
- [ ] Test migration doesn't break existing data
- [ ] Document rollback procedure

### Testing in Staging
- [ ] Deploy to test/staging environment
- [ ] Test with production data copy
- [ ] Verify all features work
- [ ] Get 3-5 beta testers
- [ ] Collect feedback
- [ ] Fix any bugs found
- [ ] Retest after fixes

### Prepare Rollback Plan
- [ ] Document database schema changes
- [ ] Create rollback script
- [ ] Back up current bot.ts
- [ ] Back up current services/
- [ ] Document rollback steps
- [ ] Test rollback procedure

---

## 🎯 Deployment

### Pre-Deploy Checklist
- [ ] All tests pass
- [ ] Code reviewed
- [ ] Beta testing complete
- [ ] Bugs fixed
- [ ] Documentation updated
- [ ] Rollback plan ready
- [ ] Database backup created
- [ ] Team notified of deployment

### Deploy Steps
- [ ] Merge feature branch to main: `git checkout main && git merge feature/phase-1-xp-badges`
- [ ] Tag release: `git tag -a v2.0.0-phase1 -m "Phase 1: XP and Badge System"`
- [ ] **⚠️ WAIT FOR EXPLICIT USER APPROVAL BEFORE PUSHING ⚠️**
- [ ] Push to repository: `git push origin main --tags`
- [ ] Monitor Railway deployment logs
- [ ] Check for build errors
- [ ] Verify bot comes online
- [ ] Test in production Discord server

### Deployment Verification
- [ ] Bot is online and responsive
- [ ] /stats command works
- [ ] /badges command appears
- [ ] Complete test session
- [ ] Verify XP awards
- [ ] Verify badge unlocks
- [ ] Check feed posts
- [ ] Monitor error logs (30 minutes)
- [ ] Check Firestore data is updating

---

## 📈 Post-Deployment

### Monitoring (First 24 Hours)
- [ ] Check Railway logs every 2 hours
- [ ] Monitor Firestore quota usage
- [ ] Watch for error spikes
- [ ] Check user feedback in Discord
- [ ] Verify badge unlock rate is reasonable
- [ ] Monitor XP distribution
- [ ] Check level distribution

### User Communication
- [ ] Post announcement in Discord about new features
- [ ] Explain XP system (10 XP/hour + bonuses)
- [ ] Explain leveling (exponential curve)
- [ ] Highlight badge system
- [ ] Show example of /stats and /badges
- [ ] Encourage users to try new features
- [ ] Create tutorial or FAQ if needed

### Data Collection
- [ ] Track most-earned badges (first week)
- [ ] Analyze level distribution
- [ ] Monitor session completion rate
- [ ] Track /stats and /badges usage
- [ ] Collect user feedback
- [ ] Note any issues or bugs

### Bug Fixes
- [ ] Create GitHub issues for any bugs found
- [ ] Prioritize critical bugs
- [ ] Fix and deploy patches quickly
- [ ] Document known issues
- [ ] Update TODO list with follow-up tasks

---

## 📊 Success Metrics

### Week 1 (After Deployment)
- [ ] XP system awards correctly for >95% of sessions
- [ ] Leveling displays in all relevant places
- [ ] No critical errors in logs
- [ ] At least 10 users have leveled up
- [ ] Badge unlock rate >50% for first session

### Week 2-3 (Ongoing)
- [ ] 30% increase in daily active users (target)
- [ ] Users check /stats 2x more often (target)
- [ ] Session completion rate +20% (target)
- [ ] Positive user feedback (survey or comments)
- [ ] At least 15 different badges have been earned
- [ ] No duplicate badge unlocks reported

### Overall Phase 1 Success
- [ ] All features working as designed
- [ ] No critical bugs remaining
- [ ] User engagement increased
- [ ] Positive community feedback
- [ ] System is stable and performant
- [ ] Ready for Phase 2 planning

---

## 🎯 Phase 2 Preparation

- [ ] Analyze Phase 1 data and metrics
- [ ] Collect user feedback on what they want next
- [ ] Review badge earn rates (too easy/hard?)
- [ ] Review XP curve (too fast/slow?)
- [ ] Identify most requested features
- [ ] Plan Phase 2 features (social, leaderboard enhancements, etc.)
- [ ] Create Phase 2 planning document
- [ ] Schedule Phase 2 kickoff

---

## 📝 Notes & Learnings

### Issues Encountered
-
-
-

### What Went Well
-
-
-

### What Could Be Improved
-
-
-

### Ideas for Future Phases
-
-
-

---

**Last Updated:** 2025-01-14
**Current Status:** Not Started
**Implementation Time:** 2-3 weeks
