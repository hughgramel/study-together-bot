# Feature Impact Framework

**Version:** 1.0.0
**Last Updated:** 2025-11-18
**Owner:** Study Together Bot Development Team

## Quick Start (First-Time Users)

1. Copy `feature-proposal-template.md` for your new feature idea
2. Fill out the template (10 minutes max)
3. Calculate your Impact Score using the formula below
4. Check the Decision Matrix to see if you should build it
5. File as GitHub Issue with the `feature-proposal` label

**Golden Rule:** If scoring takes more than 10 minutes, your feature is too complex. Break it down.

---

## Why This Framework Exists

As a solo developer, your time is your most valuable resource. This framework exists to:

- ✅ **Prevent overbuilding** features that seem cool but don't drive engagement
- ✅ **Surface quick wins** that deliver outsized impact for minimal effort
- ✅ **Make saying "no" easier** with objective criteria
- ✅ **Track assumptions** so you can learn what actually works

**This framework is NOT:**
- ❌ A bureaucratic process that slows you down
- ❌ A substitute for user feedback
- ❌ A way to avoid building anything risky

---

## Scoring Dimensions

### 1. Engagement Score (1-10)

**Question:** Will this increase daily active users or command usage?

| Score | Criteria |
|-------|----------|
| 9-10  | Creates a new daily habit (e.g., daily quests, streak bonuses) |
| 7-8   | Enhances an existing high-use command (e.g., better `/time` display) |
| 5-6   | Adds a new command users will use weekly (e.g., monthly reports) |
| 3-4   | Nice-to-have feature used occasionally (e.g., custom themes) |
| 1-2   | Edge case or rarely-accessed feature (e.g., data export) |

**Discord Bot Context:**
- High engagement = commands used daily by 50%+ of active users
- Medium engagement = commands used weekly by 30%+ of users
- Low engagement = commands used by power users only

### 2. Retention Score (1-10)

**Question:** Does this give users a reason to return tomorrow/next week?

| Score | Criteria |
|-------|----------|
| 9-10  | Creates FOMO or requires daily interaction (streaks, limited events) |
| 7-8   | Provides ongoing progress tracking (levels, achievements) |
| 5-6   | Offers periodic value (weekly leaderboards, monthly stats) |
| 3-4   | One-time utility that doesn't create habits |
| 1-2   | Purely cosmetic or administrative feature |

**Discord Bot Context:**
- Does it create a "check-in" behavior?
- Does it reward consistency over time?
- Would users notice if they missed a day/week?

### 3. Viral Score (1-10)

**Question:** Will users share this or invite friends because of it?

| Score | Criteria |
|-------|----------|
| 9-10  | Creates shareable moments (auto-posts to feed, multiplayer features) |
| 7-8   | Enables friendly competition (leaderboards, challenges) |
| 5-6   | Has social elements but not inherently viral |
| 3-4   | Personal feature with minor social aspects |
| 1-2   | Purely single-player, no social hooks |

**Discord Bot Context:**
- Does it create content for the activity feed?
- Does it work better with more participants?
- Would users screenshot this to share outside Discord?

### 4. Development Effort

**Question:** How long will this realistically take to build AND deploy?

| Size | Time Estimate | Examples |
|------|---------------|----------|
| **S** | 2-4 hours | New slash command using existing patterns, UI tweaks |
| **M** | 1-2 days | New database collection, modal interactions, scheduled tasks |
| **L** | 3-5 days | Multi-command feature with new infrastructure |
| **XL** | 1-2 weeks | Major systems (study groups, real-time sync, external APIs) |

**Include in estimate:**
- Writing tests
- Updating documentation
- Deployment and monitoring
- Bug fixes from production testing

**Pro Tip:** If you estimate "S" but haven't built something similar before, it's probably "M".

### 5. Technical Complexity

**Question:** How many things can break? How many edge cases exist?

| Level | Criteria |
|-------|----------|
| **Low** | Uses existing patterns, minimal state management, no external deps |
| **Medium** | New database queries, scheduled jobs, button interactions |
| **High** | Real-time features, third-party APIs, complex state machines |

**Red Flags (automatic "High" complexity):**
- Race conditions or concurrency issues
- Requires Firebase security rule changes
- Depends on external API uptime
- Needs data migrations for existing users

---

## Impact Score Formula

```
Impact Score = (Engagement × 2) + (Retention × 2) + (Viral × 1)
```

**Why this weighting?**
- Engagement and Retention are doubled because they directly drive DAU/MAU
- Viral is important but harder to predict, so weighted lower

**Score Ranges:**
- **40-50:** Game-changer feature (rare)
- **30-39:** High-impact feature
- **20-29:** Moderate-impact feature
- **10-19:** Low-impact feature
- **0-9:** Probably not worth building

---

## Effort Score Mapping

For the decision matrix, map effort to numbers:

| Effort | Score |
|--------|-------|
| S      | 1     |
| M      | 2     |
| L      | 3     |
| XL     | 4     |

Add +1 to score if complexity is "High" (max 5).

**Examples:**
- Medium effort + Low complexity = 2
- Large effort + High complexity = 4
- Small effort + Medium complexity = 1

---

## Decision Matrix

Plot your feature on this matrix:

```
Impact Score (y-axis) vs Effort Score (x-axis)

50 |                    | 🚀 BUILD NOW
   |         🚀         |
40 |    🚀  BUILD NOW   |
   |                    |
30 |         📅         | 📅 BUILD LATER
   |    BUILD LATER     |
20 |                    | 🤔 CONSIDER
   |    🤔 CONSIDER     |
10 |                    | ❌ DON'T BUILD
   |    ❌ DON'T BUILD  |
 0 +--------------------+
   0    1    2    3    4    5
        Effort Score
```

### Decision Rules

#### 🚀 BUILD NOW
- **Impact ≥ 30 AND Effort ≤ 2**
- **Impact ≥ 40 AND Effort ≤ 3**

These are your quick wins and strategic bets. Drop everything else.

#### 📅 BUILD LATER (Backlog)
- **Impact ≥ 25 AND Effort ≥ 3**
- **Impact ≥ 30 AND Effort = 3**

High-impact but resource-intensive. Wait until you have a full week to focus.

#### 🤔 CONSIDER (Needs More Research)
- **Impact 15-24 AND Effort ≤ 2**
- **Impact 25-29 AND Effort ≥ 3**

Unclear value or risky effort estimate. Get user feedback before committing.

#### ❌ DON'T BUILD
- **Impact < 15**
- **Effort = 5 (XL + High complexity)**
- **Any feature with Engagement + Retention < 8**

Politely decline. Suggest alternatives or wait for user demand.

### Tie-Breaker Criteria

When two features score similarly, prioritize:

1. **Lower effort** (ship faster, learn faster)
2. **Higher engagement score** (daily habits beat monthly features)
3. **Builds on existing infrastructure** (less maintenance burden)
4. **Requested by multiple users** (validated demand)
5. **Unlocks future features** (platform play)

---

## Process Workflow

### When to Use This Framework

**Always evaluate:**
- New feature requests from users
- Ideas that require more than 4 hours of work
- Features that add new commands or database collections
- Anything that changes core user workflows

**Skip the framework for:**
- Bug fixes (always do these)
- Documentation updates
- Refactoring without user-facing changes
- Features under 2 hours that improve existing commands

### Step-by-Step Process

#### 1. Initial Screening (2 minutes)
- Can you describe the feature in one sentence?
- Does it align with the bot's core value (productivity tracking + social)?
- Has someone explicitly asked for this, or is it "wouldn't it be cool if..."?

If any answer is "no" or unclear, stop here.

#### 2. Fill Out Template (5 minutes)
- Copy `feature-proposal-template.md`
- Complete all scoring sections
- Write at least one user story
- Define success metrics

#### 3. Calculate Scores (1 minute)
- Impact Score = (Engagement × 2) + (Retention × 2) + (Viral × 1)
- Effort Score = Size + (Complexity bonus)
- Plot on decision matrix

#### 4. Make Decision (2 minutes)
- Check decision matrix category
- Apply tie-breaker criteria if needed
- Write final recommendation

#### 5. File or Archive
- **BUILD NOW:** Create GitHub Issue, add to current sprint
- **BUILD LATER:** Create GitHub Issue, label `backlog`
- **CONSIDER:** Create Discussion thread, gather feedback
- **DON'T BUILD:** Archive proposal, document why

### Review Cadence

**Weekly:**
- Review all "BUILD NOW" items in backlog
- Check if priorities have shifted

**Monthly:**
- Re-score "BUILD LATER" items based on new usage data
- Archive "CONSIDER" items with no traction

**Quarterly:**
- Review the framework itself (see Framework Changelog)
- Update scoring criteria based on what actually worked

---

## Integration with Development Workflow

### GitHub Issues
Every scored feature should become an issue with:

```markdown
**Impact Score:** 34/50
**Effort:** M (2)
**Decision:** 🚀 BUILD NOW

[Link to full proposal]
```

**Labels:**
- `feature-proposal` - All scored features
- `quick-win` - Impact ≥ 30, Effort ≤ 2
- `strategic-bet` - Impact ≥ 40
- `needs-feedback` - CONSIDER category

### Project Board Columns
Map scores to columns:

1. **Proposed** - All new proposals
2. **Quick Wins** - BUILD NOW (small effort)
3. **This Sprint** - BUILD NOW (selected items)
4. **Backlog** - BUILD LATER
5. **Research Needed** - CONSIDER
6. **Won't Do** - DON'T BUILD (archive)

### Community Feedback
Before scoring, consider:

- **Discord Polls:** Ask users if they'd use this feature (yes/no/maybe)
- **Usage Analytics:** Check current command usage to estimate engagement
- **Feature Requests:** Count how many unique users have asked for this

**Rule of Thumb:** If fewer than 3 users have requested it, reduce engagement score by 2.

### Analytics Integration
After launching a feature, track:

- **Engagement:** Daily/weekly command usage
- **Retention:** Did DAU/MAU improve?
- **Viral:** New server joins or user invites
- **Effort Accuracy:** Was your estimate correct?

Update the scoring rubric based on what you learn.

---

## Common Pitfalls

### ❌ "But it would be so cool to build..."
**The Framework Says:** Cool ≠ Useful. Check engagement and retention scores.

### ❌ "This is a quick feature, I'll just build it..."
**The Framework Says:** Small efforts add up. If Impact < 15, you're wasting time.

### ❌ "Everyone will love this!"
**The Framework Says:** "Everyone" is not a user persona. Score realistically.

### ❌ "I already started building, might as well finish..."
**The Framework Says:** Sunk cost fallacy. If it scores poorly, cut your losses.

### ❌ "The framework says don't build, but my gut says yes..."
**The Framework Says:** Trust your gut for strategic bets, but track the outcome to refine scoring.

---

## Success Metrics for This Framework

Track these metrics over 3-6 months:

### Prediction Accuracy
- **% of "BUILD NOW" features that succeed** (target: 70%+)
  - Success = used by 30%+ of users within first month
- **% of "DON'T BUILD" decisions that were correct** (target: 90%+)
  - Correct = no user complaints or requests after 3 months

### Time Savings
- **Average time to score a feature** (target: <10 minutes)
- **% reduction in abandoned features** (target: 50% reduction)

### Development Velocity
- **Features shipped per month** (should increase as you focus on quick wins)
- **Time from proposal to production** (should decrease)

### Confidence
- **Do you feel more confident saying "no" to features?** (qualitative)
- **Are you building features users actually want?** (qualitative)

---

## Framework Changelog

### v1.0.0 (2025-11-18)
- Initial framework release
- Scoring dimensions: Engagement, Retention, Viral, Effort, Complexity
- Decision matrix with 4 categories
- Integration with GitHub Issues and Project Boards

### Future Improvements
- **v1.1:** Add "Technical Debt" dimension for infrastructure improvements
- **v1.2:** Create scoring calculator CLI tool
- **v1.3:** Add "Market Differentiation" score for competitive features

---

## Quick Reference

**Scoring Time:** 10 minutes max
**Impact Formula:** (Engagement × 2) + (Retention × 2) + Viral
**Effort Formula:** Size (1-4) + Complexity bonus (0-1)

**Build Now:** Impact ≥ 30 AND Effort ≤ 2
**Build Later:** Impact ≥ 25 AND Effort ≥ 3
**Consider:** Impact 15-24 AND Effort ≤ 2
**Don't Build:** Impact < 15 OR Effort = 5

**Files:**
- `feature-proposal-template.md` - Copy this for new proposals
- `feature-examples.md` - Reference scored examples
- `FEATURE_IMPACT_FRAMEWORK.md` - This document

---

## License & Attribution

This framework is part of the Study Together Bot project. Feel free to adapt for your own projects.

**Inspired by:**
- RICE Scoring (Intercom)
- ICE Scoring (Growth Hackers)
- Impact/Effort Matrix (Lean Startup)

**Tailored for:**
- Solo developers and small teams
- Discord bot development
- Rapid iteration and learning
