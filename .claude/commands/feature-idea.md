# Feature Idea Evaluation Workflow

You are now running the Feature Impact Framework workflow for evaluating a new feature idea for Study Together Bot.

## Your Task

Guide the user through a structured conversation to:
1. Capture their feature idea
2. Score it using the Feature Impact Framework
3. Generate a complete feature proposal document
4. Make a BUILD/DON'T BUILD recommendation

## Workflow Steps

Follow this exact sequence. Ask ONE question at a time, wait for the user's response, then proceed to the next step.

### Step 1: Capture the Core Idea (1 question)

Ask: "What's your feature idea? Describe it in 1-2 sentences."

Wait for their response. If they provide more than 2 sentences, help them distill it down.

---

### Step 2: Understand the Problem (2 questions)

Ask: "What user problem does this solve? What's the current pain point?"

After they respond, ask: "Has anyone explicitly requested this feature? If so, how many users?"

---

### Step 3: Describe the Solution (2 questions)

Ask: "How would this feature work from a user's perspective? Walk me through the flow:
- What command(s) would they use?
- What would the bot respond with?
- What would they see?"

After they respond, ask: "Are there any specific UI elements? (embeds, buttons, modals, reactions, etc.)"

---

### Step 4: User Stories (1 question)

Ask: "Give me 2-3 user stories in this format:
- As a [user type], I want to [action], so that [benefit]

Example: 'As a daily user, I want to save session templates, so that I don't have to retype the same activity every time.'"

---

### Step 5: Engagement Scoring (1 question)

Present this rubric, then ask them to score:

**Engagement Score: Will this increase daily active users or command usage?**
- 9-10: Creates a new daily habit (daily quests, streak bonuses)
- 7-8: Enhances an existing high-use command (better /time display)
- 5-6: Adds a weekly-use command (monthly reports)
- 3-4: Nice-to-have, occasional use (custom themes)
- 1-2: Edge case or rarely used (data export)

Ask: "Based on this rubric, what engagement score (1-10) would you give this feature? Why?"

---

### Step 6: Retention Scoring (1 question)

Present this rubric, then ask them to score:

**Retention Score: Does this give users a reason to return tomorrow/next week?**
- 9-10: Creates FOMO or requires daily interaction (streaks, limited events)
- 7-8: Provides ongoing progress tracking (levels, achievements)
- 5-6: Offers periodic value (weekly leaderboards, monthly stats)
- 3-4: One-time utility that doesn't create habits
- 1-2: Purely cosmetic or administrative

Ask: "What retention score (1-10) would you give this? Why?"

---

### Step 7: Viral Scoring (1 question)

Present this rubric, then ask them to score:

**Viral Score: Will users share this or invite friends because of it?**
- 9-10: Creates shareable moments (auto-posts to feed, multiplayer features)
- 7-8: Enables friendly competition (leaderboards, challenges)
- 5-6: Has social elements but not inherently viral
- 3-4: Personal feature with minor social aspects
- 1-2: Purely single-player, no social hooks

Ask: "What viral score (1-10) would you give this? Why?"

---

### Step 8: Effort Estimation (1 question)

Present this rubric, then ask them to estimate:

**Development Effort: How long will this realistically take to build AND deploy?**
- S (2-4 hours): New slash command using existing patterns, UI tweaks
- M (1-2 days): New database collection, modal interactions, scheduled tasks
- L (3-5 days): Multi-command feature with new infrastructure
- XL (1-2 weeks): Major systems (study groups, real-time sync, external APIs)

Ask: "What effort size (S/M/L/XL) would you estimate? Break down the work involved."

---

### Step 9: Complexity Assessment (1 question)

Present this rubric, then ask them to assess:

**Technical Complexity: How many things can break? How many edge cases?**
- Low: Uses existing patterns, minimal state management, no external deps
- Medium: New database queries, scheduled jobs, button interactions
- High: Real-time features, third-party APIs, complex state machines

**Red flags for High complexity:**
- Race conditions or concurrency issues
- Firebase security rule changes
- Depends on external API uptime
- Needs data migrations for existing users

Ask: "What complexity level (Low/Medium/High)? List any edge cases you can think of."

---

### Step 10: Calculate Scores

Based on their responses, calculate:

```
Impact Score = (Engagement × 2) + (Retention × 2) + Viral
Effort Score = Size (S=1, M=2, L=3, XL=4) + Complexity bonus (High=+1, else +0)
```

Present the scores and show them where it falls on the decision matrix:

**Decision Matrix:**
- 🚀 BUILD NOW: Impact ≥ 30 AND Effort ≤ 2
- 📅 BUILD LATER: Impact ≥ 25 AND Effort ≥ 3
- 🤔 CONSIDER: Impact 15-24 AND Effort ≤ 2
- ❌ DON'T BUILD: Impact < 15 OR Effort = 5

---

### Step 11: Success Metrics (1 question)

Ask: "How will you measure success for this feature? What metrics will you track?

Example: '30% of daily active users use this command within first month' or 'Increase 7-day retention by 5%'"

---

### Step 12: Generate Proposal Document

Using all the information gathered, create a complete feature proposal using the template at `docs/feature-proposal-template.md`.

Fill in:
- One-sentence description
- Problem statement
- Proposed solution
- User stories
- All impact scores with reasoning
- Calculated Impact and Effort scores
- Decision matrix category
- Success metrics
- Final recommendation

Save the proposal to: `docs/proposals/[feature-name-kebab-case].md`

---

### Step 13: Final Recommendation

Present your recommendation:

1. Show the final scores
2. Explain the decision (BUILD NOW/LATER/CONSIDER/DON'T BUILD)
3. If BUILD NOW or BUILD LATER: Ask if they want to create a GitHub Issue
4. If CONSIDER: Suggest research steps needed before building
5. If DON'T BUILD: Explain why and suggest alternatives

Ask: "Does this recommendation make sense? Would you like to proceed with this feature?"

---

## Important Guidelines

- **Be conversational but structured** - Don't make this feel like a form
- **Challenge unrealistic scores** - If they rate a cosmetic feature as 10/10 engagement, push back gently
- **Use examples from the bot** - Reference existing commands (/start, /time, /mystats) to calibrate scores
- **Keep momentum** - Don't let the conversation drag. Move through steps efficiently
- **Be honest about effort** - Developers underestimate. Add buffer to their estimates
- **Reference the examples** - Point to docs/feature-examples.md for similar features

## Example Opening

When the user runs `/feature-idea`, start with:

"I'll help you evaluate your feature idea using the Feature Impact Framework. This should take about 10-15 minutes.

We'll walk through:
- What problem you're solving
- How users will interact with it
- Impact scoring (engagement, retention, viral)
- Effort estimation
- A BUILD/DON'T BUILD recommendation

Let's start: **What's your feature idea? Describe it in 1-2 sentences.**"

---

## Special Cases

### If they want to skip scoring
Say: "I understand you want to move fast, but scoring takes 10 minutes and prevents building features users won't use. Let's push through - it's worth it."

### If they disagree with the recommendation
Say: "The framework is a guide, not a law. If you have strong conviction this is worth building despite the scores, document your reasoning. Just promise to track whether you were right."

### If the feature is too vague
Say: "This idea needs more definition. Can you be more specific about [X]? Or should we file this as a 'needs research' item and revisit later?"

### If it's clearly a DON'T BUILD
Be direct: "Based on these scores, this doesn't meet the impact threshold. Here's why: [reasoning]. Would you rather spend your time on [suggest alternative]?"

---

Begin the workflow now.
