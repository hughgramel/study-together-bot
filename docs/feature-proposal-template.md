# Feature Proposal: [Feature Name]

**Date:** YYYY-MM-DD
**Proposed By:** [Your Name / Discord User]
**Status:** 🔍 Proposed

---

## One-Sentence Description

<!-- Describe the feature in ONE sentence. If you can't, it's too complex. -->

---

## Problem Statement

<!-- What user problem does this solve? Why do users need this? -->

**Current Pain Point:**
<!-- Describe the frustration or gap in current functionality -->

**User Quotes/Requests:**
<!-- Include actual Discord messages or paraphrased requests if available -->
<!-- If no user has requested this, write "No explicit requests - builder intuition" -->

---

## Proposed Solution

<!-- Describe HOW the feature works from a user perspective -->

**User Flow:**
1. User does X...
2. Bot responds with Y...
3. User sees Z...

**Example Commands/Interactions:**
```
/example-command [options]
```

**Visual Mockup (optional):**
<!-- Include Discord embed mockups, button layouts, or flow diagrams -->

---

## User Stories

<!-- Write 2-3 user stories. Format: "As a [user type], I want to [action] so that [benefit]" -->

1. **As a** daily user, **I want to** [action], **so that** [benefit]
2. **As a** new user, **I want to** [action], **so that** [benefit]
3. **As a** power user, **I want to** [action], **so that** [benefit]

---

## Impact Scoring

### 1. Engagement Score: __/10

<!-- Will this increase daily active users or command usage? -->

**Score:** [1-10]

**Reasoning:**
<!-- Check all that apply -->
- [ ] Creates a new daily habit (9-10)
- [ ] Enhances an existing high-use command (7-8)
- [ ] Adds a weekly-use command (5-6)
- [ ] Nice-to-have, occasional use (3-4)
- [ ] Edge case or rare use (1-2)

**Evidence:**
<!-- Usage stats, similar feature benchmarks, user polling results -->

---

### 2. Retention Score: __/10

<!-- Does this give users a reason to return tomorrow/next week? -->

**Score:** [1-10]

**Reasoning:**
<!-- Check all that apply -->
- [ ] Creates FOMO or requires daily interaction (9-10)
- [ ] Provides ongoing progress tracking (7-8)
- [ ] Offers periodic value (weekly/monthly) (5-6)
- [ ] One-time utility (3-4)
- [ ] Purely cosmetic/admin (1-2)

**Retention Mechanism:**
<!-- What makes users come back? Streaks? Leaderboard position? New content? -->

---

### 3. Viral Score: __/10

<!-- Will users share this or invite friends because of it? -->

**Score:** [1-10]

**Reasoning:**
<!-- Check all that apply -->
- [ ] Creates shareable moments (auto-posts to feed) (9-10)
- [ ] Enables friendly competition (leaderboards) (7-8)
- [ ] Has social elements but not viral (5-6)
- [ ] Personal feature with minor social hooks (3-4)
- [ ] Purely single-player (1-2)

**Viral Hook:**
<!-- What would users screenshot or share? What makes this multiplayer-friendly? -->

---

### 4. Development Effort: [S/M/L/XL]

<!-- How long will this realistically take to build AND deploy? -->

**Estimate:** [Choose one]
- [ ] S (2-4 hours) - New command using existing patterns
- [ ] M (1-2 days) - New database collection or modal interactions
- [ ] L (3-5 days) - Multi-command feature with new infrastructure
- [ ] XL (1-2 weeks) - Major system (study groups, real-time sync, external APIs)

**Breakdown:**
- Coding: [X hours]
- Testing: [X hours]
- Documentation: [X hours]
- Deployment & monitoring: [X hours]
- **Total:** [X hours]

**Dependencies:**
<!-- List any required changes to existing systems, new libraries, or external services -->

---

### 5. Technical Complexity: [Low/Medium/High]

<!-- How many things can break? How many edge cases exist? -->

**Complexity:** [Choose one]
- [ ] Low - Uses existing patterns, minimal state management
- [ ] Medium - New database queries, scheduled jobs, button interactions
- [ ] High - Real-time features, third-party APIs, complex state machines

**Risk Factors:**
<!-- Check all that apply -->
- [ ] Race conditions or concurrency issues
- [ ] Firebase security rule changes required
- [ ] Depends on external API uptime
- [ ] Needs data migrations for existing users
- [ ] Affects multiple Discord servers differently

**Edge Cases:**
<!-- List 3-5 edge cases you'll need to handle -->
1.
2.
3.

---

## Calculated Scores

### Impact Score
```
Impact = (Engagement × 2) + (Retention × 2) + Viral
Impact = (____ × 2) + (____ × 2) + ____
Impact = ____ / 50
```

### Effort Score
```
Effort = Size + Complexity Bonus
Effort = ____ (S=1, M=2, L=3, XL=4) + ____ (High=+1, else +0)
Effort = ____ / 5
```

---

## Decision Matrix

<!-- Plot your scores on the matrix -->

**Category:** [Choose one based on your scores]
- [ ] 🚀 **BUILD NOW** (Impact ≥ 30 AND Effort ≤ 2)
- [ ] 📅 **BUILD LATER** (Impact ≥ 25 AND Effort ≥ 3)
- [ ] 🤔 **CONSIDER** (Impact 15-24 AND Effort ≤ 2)
- [ ] ❌ **DON'T BUILD** (Impact < 15 OR Effort = 5)

**Priority Level:** [1-5]
<!-- 1 = Drop everything, 5 = Nice to have someday -->

---

## Success Metrics

<!-- How will you measure if this feature works? Define metrics BEFORE building. -->

### Primary Metric
**Metric:** [e.g., Daily active users who use this command]
**Target:** [e.g., 30% of DAU use this within first month]
**Measurement:** [e.g., Firebase query for command usage]

### Secondary Metrics
1. **Metric:** [e.g., User retention rate]
   **Target:** [e.g., +5% increase in 7-day retention]

2. **Metric:** [e.g., Activity feed engagement]
   **Target:** [e.g., 50+ reactions per week on related posts]

### Failure Criteria
<!-- When would you consider this feature a failure and remove it? -->
- If fewer than [X]% of users use it after [Y] weeks
- If it causes [Z] support questions per week
- If it increases server costs by more than [N]%

---

## Risks & Mitigation

### Technical Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [e.g., Firebase quota exceeded] | [Low/Med/High] | [Low/Med/High] | [How to prevent/handle] |

### Product Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [e.g., Users don't understand the feature] | [Low/Med/High] | [Low/Med/High] | [User education plan] |

### Business Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [e.g., Increases server costs significantly] | [Low/Med/High] | [Low/Med/High] | [Cost monitoring plan] |

---

## Alternatives Considered

<!-- What other solutions did you consider? Why did you reject them? -->

### Alternative 1: [Name]
**Description:** [Brief description]
**Pros:** [Why it's good]
**Cons:** [Why you didn't choose it]

### Alternative 2: [Name]
**Description:** [Brief description]
**Pros:** [Why it's good]
**Cons:** [Why you didn't choose it]

### Do Nothing
**Pros:** [Why not building is okay]
**Cons:** [What we lose by not building]

---

## Open Questions

<!-- What do you still need to figure out? -->

- [ ] Question 1?
- [ ] Question 2?
- [ ] Question 3?

---

## Implementation Plan (If Approved)

<!-- High-level technical approach. Don't write code yet. -->

### Phase 1: [Name]
**Tasks:**
- [ ] Task 1
- [ ] Task 2

**Estimated Time:** [X hours]

### Phase 2: [Name]
**Tasks:**
- [ ] Task 1
- [ ] Task 2

**Estimated Time:** [X hours]

### Phase 3: Launch & Monitor
**Tasks:**
- [ ] Deploy to production
- [ ] Announce in Discord servers
- [ ] Monitor success metrics for [X] weeks
- [ ] Iterate based on feedback

---

## Final Recommendation

<!-- Your call: Should we build this? -->

**Recommendation:** [BUILD NOW / BUILD LATER / CONSIDER / DON'T BUILD]

**Reasoning:**
<!-- 2-3 sentences justifying your decision based on the scores above -->

**Next Steps:**
- [ ] Get feedback from Discord community (if CONSIDER)
- [ ] Create GitHub Issue (if BUILD NOW or BUILD LATER)
- [ ] Archive proposal (if DON'T BUILD)
- [ ] Schedule implementation (if BUILD NOW)

---

## Appendix

### User Feedback
<!-- Include Discord screenshots, poll results, or survey responses -->

### Competitive Analysis
<!-- Do other productivity bots have this? How is ours different? -->

### Related Features
<!-- Link to existing features this builds upon or complements -->

---

**Template Version:** 1.0.0
**Framework:** [FEATURE_IMPACT_FRAMEWORK.md](./FEATURE_IMPACT_FRAMEWORK.md)
