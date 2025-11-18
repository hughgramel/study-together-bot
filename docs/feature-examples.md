# Feature Impact Framework - Scored Examples

**Purpose:** Reference examples showing how to score different types of features for Study Together Bot.

**Last Updated:** 2025-11-18

---

## Example 1: Session Templates (Quick Win)

### One-Sentence Description
Allow users to save session configurations (activity name, goal duration, intensity) as reusable templates with a simple `/start [template-name]` command.

### Impact Scoring

**Engagement Score: 8/10**
- Enhances the existing high-use `/start` command
- Reduces friction for repeat sessions (same activity, same duration)
- Current users run `/start` multiple times daily - templates make this faster
- Evidence: Users frequently start sessions with identical activities ("Deep Work", "Homework", "Coding")

**Retention Score: 7/10**
- Creates a personal library of session types
- Users build habits around specific session templates
- Encourages consistent daily routines (e.g., "Morning Routine" template)
- Not as strong as streaks, but supports habit formation

**Viral Score: 4/10**
- Minimal social component
- Users might share their template names in chat ("What templates do you use?")
- Not inherently shareable or competitive
- Personal utility feature

**Effort: S (1)**
- 3 hours total: 2 hours coding, 30 min testing, 30 min docs
- New slash command: `/save-template [name]` and `/templates` (list)
- Modify `/start` to accept optional template parameter
- Simple Firestore subcollection: `userStats/{userId}/templates/{templateId}`
- Uses existing session creation logic

**Complexity: Low (0 bonus)**
- No race conditions
- No external dependencies
- Uses existing database patterns
- Minimal edge cases (max 10 templates per user, duplicate names)

### Calculated Scores

```
Impact = (8 × 2) + (7 × 2) + 4 = 34/50
Effort = 1 + 0 = 1/5
```

### Decision

**Category:** 🚀 **BUILD NOW**

**Why:** High impact (34) with minimal effort (1). This is a classic quick win that enhances the most-used command. Users will immediately feel the value when they start their 5th "Deep Work" session of the week and don't have to retype everything.

**Expected Outcome:**
- 60%+ of daily users will create at least 1 template within first week
- Average `/start` command completion time reduced by 40%
- No significant change to retention (not the primary driver)

**Next Steps:**
- Create GitHub Issue
- Ship within current sprint
- Track: % of users who create templates, % of starts using templates

---

## Example 2: Study Groups/Rooms (High-Impact, High-Effort)

### One-Sentence Description
Let users create persistent "study rooms" where multiple users can join, co-track sessions, and see live updates of who's currently studying together with shared leaderboards.

### Impact Scoring

**Engagement Score: 9/10**
- Creates a new daily habit (checking who's in your study room)
- Adds real-time social presence to existing sessions
- Users might keep Discord open to see room activity
- Transforms solo productivity into group accountability

**Retention Score: 9/10**
- Strong FOMO element (see friends studying without you)
- Creates "study buddy" accountability loops
- Requires daily check-ins to stay relevant in group
- Potential for "study group streaks" or challenges

**Viral Score: 10/10**
- Inherently multiplayer - requires inviting friends
- Users will recruit others to join their study rooms
- Creates shareable moments (group milestones, all-nighters)
- Strong network effects (more valuable with more members)

**Effort: XL (4)**
- 10-14 days total:
  - `/create-room`, `/join-room`, `/leave-room`, `/room-stats` commands
  - Real-time room membership tracking
  - Shared room leaderboards and stats
  - Room activity notifications
  - Room discovery/browse interface
  - Permission system (private vs. public rooms, kick users)
  - Database: New `rooms` collection with complex queries
  - UI: Multiple embeds, button interactions, modals

**Complexity: High (+1 bonus)**
- Race conditions (multiple users joining/leaving simultaneously)
- Real-time state sync across users
- Complex permission model (room ownership, moderation)
- Edge cases: Room inactivity, member limits, spam prevention
- Requires Firebase security rule overhaul

### Calculated Scores

```
Impact = (9 × 2) + (9 × 2) + 10 = 46/50
Effort = 4 + 1 = 5/5
```

### Decision

**Category:** 📅 **BUILD LATER** (borderline ❌ DON'T BUILD due to max effort)

**Why:** This is the highest impact feature possible (46), but also maximum effort/complexity (5). It's a strategic bet that could transform the bot, but it's risky. The effort score is at the ceiling, which means:
- High chance of scope creep
- Potential for bugs and edge cases
- Long time before users see value

**Tie-Breaker Analysis:**
- **Pro:** Unlocks multiplayer features, strong viral potential
- **Con:** Complex to maintain, requires critical mass of users
- **Decision:** Wait until you have at least 500 DAU to justify this investment

**Alternative Approach:**
- **Phase 1 (M effort):** Simple "study buddy" pairing system (1-on-1 only)
- **Phase 2 (L effort):** Small group rooms (max 5 people)
- **Phase 3 (XL effort):** Full study groups with discovery

**Next Steps:**
- File as "strategic backlog" GitHub Issue
- Validate demand with Discord poll
- Build Phase 1 first, measure adoption before committing to full feature

---

## Example 3: Custom Achievement Badges (Moderate Win)

### One-Sentence Description
Allow users to unlock custom profile badges (icons displayed in embeds) by completing achievement milestones, with a `/badges` command to view and equip them.

### Impact Scoring

**Engagement Score: 5/10**
- Adds a new command (`/badges`) used occasionally
- Users check badges weekly, not daily
- Doesn't change core session workflow
- Nice-to-have, not essential

**Retention Score: 6/10**
- Provides ongoing progress tracking (badge collection)
- Creates small dopamine hits when unlocking new badges
- Long-term goals (e.g., "1000 Hours" badge)
- Not as strong as streaks (already have achievements)

**Viral Score: 7/10**
- Badges display in activity feed embeds (social proof)
- Users will show off rare badges
- Friendly competition ("Who has the rarest badge?")
- Screenshots of badge collections

**Effort: M (2)**
- 1.5 days total:
  - Design badge icon system (emoji or custom images)
  - `/badges` command with pagination
  - Equip/unequip badge UI (modal or buttons)
  - Update existing embeds to display equipped badge
  - Database: Add `equippedBadge` field to userStats
  - Badge unlock logic (already have achievements, extend that)

**Complexity: Low (0 bonus)**
- Builds on existing achievement system
- No race conditions
- No external dependencies
- Simple state management

### Calculated Scores

```
Impact = (5 × 2) + (6 × 2) + 7 = 29/50
Effort = 2 + 0 = 2/5
```

### Decision

**Category:** 🚀 **BUILD NOW** (on the border with 📅 BUILD LATER)

**Why:** Impact score is 29 (just under the 30 threshold for automatic BUILD NOW), but effort is low (2). This is a **tie-breaker scenario**.

**Tie-Breaker Criteria:**
1. ✅ Lower effort (2 vs. higher alternatives)
2. ❌ Engagement score is only 5 (not a daily driver)
3. ✅ Builds on existing infrastructure (achievements)
4. ✅ Requested by multiple users (assume yes for this example)
5. ✅ Unlocks future features (badge trading, seasonal badges)

**Final Decision:** 🚀 **BUILD NOW**

**Reasoning:** While impact is moderate, the viral score (7) and low effort (2) make this worth building. Badges enhance the social feed experience and give existing achievement hunters something new to pursue. Build this during a "polish sprint" when you don't have energy for big features.

**Expected Outcome:**
- 40% of users equip a badge within first month
- Increased activity feed engagement (+10% reactions)
- Foundation for future badge-related features

**Risks:**
- Could feel redundant with existing achievements (mitigation: make badges more visual/prestigious)
- Low engagement if users don't care about cosmetics (mitigation: make badges unlock perks)

---

## Example 4: Custom Profile Themes (Low-Impact)

### One-Sentence Description
Let users customize the color and emoji theme of their session embeds with a `/theme` command that offers 10+ preset themes (Dark Mode, Ocean, Forest, etc.).

### Impact Scoring

**Engagement Score: 3/10**
- One-time setup command, rarely used after initial config
- Doesn't change core workflows
- Nice-to-have customization, not a driver of daily use

**Retention Score: 2/10**
- No ongoing value after setup
- Purely cosmetic, doesn't create habits
- Minimal impact on whether users return tomorrow

**Viral Score: 4/10**
- Users might share screenshots of cool themes
- Minor personalization element
- Not inherently competitive or social

**Effort: S (1)**
- 3 hours total:
  - `/theme list` and `/theme set [name]` commands
  - 10 preset color + emoji combinations
  - Store preference in `userStats/{userId}`
  - Update embed generation to use custom theme

**Complexity: Low (0 bonus)**
- Simple key-value storage
- No dependencies
- Minimal edge cases

### Calculated Scores

```
Impact = (3 × 2) + (2 × 2) + 4 = 14/50
Effort = 1 + 0 = 1/5
```

### Decision

**Category:** ❌ **DON'T BUILD**

**Why:** Impact score is 14, below the 15 threshold. Even though effort is minimal (1), this feature doesn't move the needle on engagement, retention, or virality. It's a classic "seems cool but doesn't matter" feature.

**What Users Actually Want:**
- They want more *functionality*, not more *customization*
- If they're asking for themes, it might be a proxy request for "the bot feels impersonal"
- Better solution: Add personality to existing embeds (fun messages, contextual emoji)

**Alternative Approach:**
- **Instead of custom themes:** Add automatic theme variations based on session milestones
  - First session of the day: Morning sunrise theme
  - Late night session (after 10pm): Night owl theme
  - Long session (3+ hours): Epic marathon theme
- This delivers the "personality" without requiring user configuration

**Next Steps:**
- Archive this proposal
- If 10+ users explicitly request themes, reconsider (validated demand)
- Focus on higher-impact features instead

---

## Example 5: Session Categories/Tags (Hard to Score)

### One-Sentence Description
Allow users to tag sessions with categories (e.g., "Math", "Reading", "Project X") and view stats broken down by category with a `/stats-by-category` command.

### Impact Scoring

**Engagement Score: 6/10** (High Uncertainty)
- Could enhance the `/start` command (add optional category parameter)
- Power users will love this for tracking different subjects
- Casual users might ignore it completely
- **Uncertainty:** Is this used daily or just for end-of-week reviews?

**Retention Score: 5/10** (High Uncertainty)
- Provides long-term tracking value
- Category leaderboards could create niche competitions
- **Uncertainty:** Do users care about category breakdowns, or just total time?

**Viral Score: 3/10**
- Minimal social element
- Users might share category stats ("I studied 20 hours of Math this week!")
- Not inherently competitive

**Effort: M (2)** (High Uncertainty)
- 1-2 days, but could expand:
  - Add optional `category` parameter to `/start`
  - New `/stats-by-category` command with charts
  - Database: Add `category` field to sessions
  - UI: Category selection modal vs. simple text input?
  - **Uncertainty:** Do we need predefined categories or freeform tags?

**Complexity: Medium (+0.5 bonus)**
- Database queries by category (new index needed)
- Edge cases: Typos in category names, renaming categories, too many categories
- **Uncertainty:** How to handle category migrations?

### Calculated Scores (Best Guess)

```
Impact = (6 × 2) + (5 × 2) + 3 = 25/50
Effort = 2 + 0.5 = 2.5/5 (round to 3)
```

### Decision

**Category:** 🤔 **CONSIDER** (Needs More Research)

**Why:** This feature has high uncertainty across all dimensions. The scores could swing dramatically based on:
1. **User Research:** Do power users actually want this, or is it "nice in theory"?
2. **Implementation Details:** Freeform tags vs. predefined categories changes effort significantly
3. **Success Metrics:** Unclear what "success" looks like here

**What's Unclear:**
- ❓ Would 30%+ of users actually tag their sessions?
- ❓ Is this solving a real pain point, or creating busywork?
- ❓ Do category leaderboards drive competition, or fragment the community?

**Next Steps (Research Phase):**

1. **Discord Poll (2 min):**
   ```
   "Would you use session categories to track different subjects/projects?"
   - Yes, I'd tag every session
   - Maybe, for some sessions
   - No, too much overhead
   ```

2. **Prototype Validation (1 hour):**
   - Build a minimal `/tag-last-session` command
   - Test with 10 users for 1 week
   - Measure: % of sessions that get tagged

3. **Competitive Research (30 min):**
   - Do other productivity bots have this?
   - What do Toggl, RescueTime, etc. do for categories?

4. **Re-Score After Research:**
   - If poll shows 60%+ interest → Engagement = 8 → Impact = 33 → BUILD NOW
   - If prototype shows <20% adoption → DON'T BUILD
   - If unclear → BUILD LATER

**Decision Rule:** Only build if research validates that users will *actually* use this, not just say they want it.

---

## Scoring Patterns & Lessons

### Pattern 1: Quick Wins (High Impact, Low Effort)
**Examples:** Session Templates, Notification Preferences
**Characteristics:**
- Enhance existing high-use features
- Simple database additions
- Immediate user value

**Lesson:** Prioritize these ruthlessly. Ship 3 quick wins before 1 big bet.

---

### Pattern 2: Strategic Bets (High Impact, High Effort)
**Examples:** Study Groups, Real-Time Collaboration
**Characteristics:**
- Could transform the product
- Require weeks of work
- High risk of scope creep

**Lesson:** Validate demand before committing. Consider phased rollouts.

---

### Pattern 3: Polish Features (Medium Impact, Low Effort)
**Examples:** Custom Badges, Embed Improvements
**Characteristics:**
- Improve existing experience
- Don't change core workflows
- Good for "maintenance sprints"

**Lesson:** Build these when you're burned out on big features, not as priorities.

---

### Pattern 4: Vanity Features (Low Impact, Any Effort)
**Examples:** Custom Themes, Profile Decorations
**Characteristics:**
- Seem cool but don't drive metrics
- Often requested by vocal minority
- Distract from core value

**Lesson:** Just say no. Redirect energy to engagement/retention drivers.

---

### Pattern 5: Unclear Features (High Uncertainty)
**Examples:** Session Categories, AI-Powered Insights
**Characteristics:**
- Depend on user behavior assumptions
- Could be high or low impact
- Need validation before scoring

**Lesson:** Don't guess. Spend 1-2 hours on research before scoring.

---

## Anti-Patterns to Avoid

### ❌ The "I Already Started Building" Trap
**Example:** You're 4 hours into building profile themes when you realize Impact = 14.

**Solution:** Score BEFORE writing code. If you catch yourself mid-build, use the framework to decide if you should finish or cut losses.

---

### ❌ The "But Everyone Wants This" Fallacy
**Example:** 5 users in Discord asked for a feature. You assume it's high-impact.

**Solution:** 5 users ≠ "everyone". Check what % of your active users are requesting it. If <10%, reduce engagement score by 2.

---

### ❌ The "Quick Feature Creep" Spiral
**Example:** Session categories starts as "S effort" but becomes "L effort" when you add autocomplete, renaming, and hierarchical tags.

**Solution:** Score the MVP version only. Additional features require separate proposals.

---

### ❌ The "Competitor Has It" Justification
**Example:** Another productivity bot has study groups, so you must build it too.

**Solution:** Competitors have different users and goals. Score based on YOUR users' needs, not feature parity.

---

## Framework Calibration

After building these examples, track actual outcomes:

| Feature | Predicted Impact | Actual Impact | Accuracy |
|---------|-----------------|---------------|----------|
| Session Templates | 34 | [TBD after launch] | [TBD] |
| Study Groups | 46 | [Not built yet] | N/A |
| Custom Badges | 29 | [TBD after launch] | [TBD] |
| Profile Themes | 14 | [Not built] | N/A |
| Session Categories | 25 | [Needs research] | N/A |

**Calibration Process:**
1. After launching a feature, wait 4 weeks
2. Measure: % of users who use it, impact on DAU/retention
3. Re-score the feature based on actual data
4. If predicted impact was off by 10+ points, update scoring rubric

**Example Calibration:**
- If Session Templates actual impact = 24 (not 34), ask: "Why was engagement lower than expected?"
- Update framework: "Features that enhance existing commands: reduce engagement score by 2"

---

## Quick Decision Tree

```
Start
  |
  ├─ Impact < 15? → ❌ DON'T BUILD
  |
  ├─ Impact 15-24?
  │   ├─ Effort ≤ 2? → 🤔 CONSIDER (needs validation)
  │   └─ Effort > 2? → ❌ DON'T BUILD
  |
  ├─ Impact 25-29?
  │   ├─ Effort ≤ 2? → 🚀 BUILD NOW (use tie-breakers)
  │   └─ Effort ≥ 3? → 📅 BUILD LATER
  |
  ├─ Impact 30-39?
  │   ├─ Effort ≤ 2? → 🚀 BUILD NOW
  │   ├─ Effort = 3? → 🚀 BUILD NOW or 📅 BUILD LATER (use tie-breakers)
  │   └─ Effort ≥ 4? → 📅 BUILD LATER
  |
  └─ Impact 40+?
      ├─ Effort ≤ 3? → 🚀 BUILD NOW (strategic bet)
      └─ Effort ≥ 4? → 📅 BUILD LATER (validate first)
```

---

## Template Usage Tips

### For Quick Wins (S/M effort, Impact 25+)
- Spend 5 minutes on the template, not 15
- Focus on Impact Scoring and Decision Matrix
- Skip extensive risk analysis
- Get it scored and start building

### For Strategic Bets (L/XL effort)
- Spend the full 10 minutes (or more) on the template
- Fill out every section thoroughly
- Include competitive analysis
- Get community feedback before committing

### For Unclear Features
- Stop at Impact Scoring section
- If any score has "High Uncertainty", switch to research mode
- Use the template's "Open Questions" section
- Re-score after gathering data

---

**Framework Version:** 1.0.0
**Next Review:** 2025-12-18 (1 month)
