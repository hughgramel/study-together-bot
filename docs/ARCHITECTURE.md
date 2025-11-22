# Architecture Documentation

## System Overview

Study Together is a Discord bot built for collaborative productivity tracking with social features inspired by Strava. The bot enables users to track study/work sessions, earn XP and achievements, compete on leaderboards, and participate in study groups.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Discord Client                           │
│                  (Gateway + REST API Interface)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Bot Layer (bot.ts)                       │
│  • Command Registration                                          │
│  • Interaction Handling (Commands, Buttons, Modals, Selects)    │
│  • Event Listeners (ready, interactionCreate)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
┌───────────────────┐  ┌─────────────┐  ┌──────────────────┐
│  Service Layer    │  │  Component  │  │  Utility Layer   │
│                   │  │  Layer      │  │                  │
│ • SessionService  │  │  (React)    │  │ • formatters.ts  │
│ • StatsService    │  │             │  │ • xp.ts          │
│ • XPService       │  │ • ProfileCard│ │ • emojiToIcon    │
│ • AchievementSvc  │  │ • StatsChart│  │                  │
│ • GroupService    │  │ • Leaderboard│ │                  │
│ • PostService     │  │ • GroupCard │  │                  │
│ • EventService    │  │ • etc.      │  │                  │
│ • DailyGoalSvc    │  │             │  │                  │
│ • ImageServices   │  │             │  │                  │
└─────────┬─────────┘  └──────┬──────┘  └──────────────────┘
          │                   │
          │                   ▼
          │         ┌──────────────────┐
          │         │  Puppeteer       │
          │         │  (HTML → Image)  │
          │         └──────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Firestore                            │
│                                                                   │
│  discord-data/                                                   │
│  ├── activeSessions/sessions/{userId}                           │
│  ├── sessions/completed/{sessionId}                             │
│  ├── userStats/stats/{userId}                                   │
│  ├── serverConfig/configs/{serverId}                            │
│  ├── groups/active/{groupId}                                    │
│  ├── groupMembers/memberships/{userId}                          │
│  ├── sessionPosts/posts/{messageId}                             │
│  ├── dailyGoals/goals/{userId}                                  │
│  ├── events/scheduled/{eventId}                                 │
│  └── achievements/unlocks/{userId}                              │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── bot.ts                          # Main entry point - Discord client, command handlers
├── types.ts                        # TypeScript interfaces for all data models
│
├── components/                     # React components for image generation
│   ├── ProfileCard.tsx            # User profile overview
│   ├── StatsChart.tsx             # Statistics visualization
│   ├── StatsOverview.tsx          # Stats dashboard
│   ├── LeaderboardCard.tsx        # Leaderboard display
│   ├── GroupOverview.tsx          # Group stats and members
│   ├── GroupLeaderboard.tsx       # Top groups ranking
│   ├── FindGroups.tsx             # Public groups browser
│   ├── SessionPost.tsx            # Completed session embed
│   ├── SessionStartCard.tsx       # Session start notification
│   ├── LevelUpCard.tsx            # Level up celebration
│   ├── AchievementUnlockCard.tsx  # Achievement unlock notification
│   ├── StreakCard.tsx             # Streak milestone notification
│   └── LiveNotificationCard.tsx   # Live session updates
│
├── services/                       # Business logic layer
│   ├── sessions.ts                # Session CRUD operations
│   ├── stats.ts                   # Statistics calculations and leaderboards
│   ├── xp.ts                      # XP calculations and level progression
│   ├── achievements.ts            # Achievement unlock logic
│   ├── groups.ts                  # Group management
│   ├── posts.ts                   # Session feed posts and reactions
│   ├── events.ts                  # Study event scheduling
│   ├── dailyGoal.ts               # Daily goal management
│   ├── badges.ts                  # Badge system
│   ├── challenge.ts               # Weekly challenges
│   │
│   ├── profileImage.ts            # Profile card image generation
│   ├── statsImage.ts              # Stats chart image generation
│   ├── statsOverviewImage.ts      # Stats overview image generation
│   ├── postImage.ts               # Session post image generation
│   ├── groupOverviewImage.ts      # Group overview image generation
│   ├── sessionStartImage.ts       # Session start notification image
│   ├── levelUpImage.ts            # Level up card image
│   ├── achievementUnlockImage.ts  # Achievement unlock image
│   ├── streakImage.ts             # Streak milestone image
│   ├── liveNotificationImage.ts   # Live session notification image
│   │
│   ├── analytics.service.ts       # Analytics data collection
│   ├── analytics.queries.ts       # Analytics queries
│   ├── analytics.dashboard.ts     # Analytics dashboard
│   ├── analytics.middleware.ts    # Analytics tracking middleware
│   └── analytics.types.ts         # Analytics type definitions
│
├── data/
│   ├── achievements.ts            # Achievement definitions
│   └── badges.ts                  # Badge definitions
│
└── utils/
    ├── formatters.ts              # Duration, date, time formatting
    ├── xp.ts                      # XP calculation utilities
    └── emojiToIcon.tsx            # Emoji to icon conversion

config/
├── .env.example                   # Environment variable template
├── firebase-service-account.json  # Firebase credentials (not committed)
├── tsconfig.json                  # TypeScript configuration
└── railway.json                   # Railway deployment config
```

## Command Flow Architecture

### Session Management Flow

```
User: /start activity: "Study React hooks"
  │
  ▼
bot.ts: Handle 'start' command
  │
  ├─> SessionService.getActiveSession(userId)
  │   └─> Check if user already has active session
  │
  ├─> SessionService.createSession(userId, activity)
  │   └─> Create document in activeSessions/sessions/{userId}
  │
  ├─> sessionStartImageService.generate(...)
  │   └─> Render SessionStartCard component to image
  │
  └─> interaction.reply({ files: [image], ephemeral: true })

---

User: /stop title: "React Practice" description: "Built hooks demo"
  │
  ▼
bot.ts: Handle 'stop' command
  │
  ├─> SessionService.getActiveSession(userId)
  │   └─> Fetch active session from Firebase
  │
  ├─> SessionService.completeSession(userId, title, description)
  │   ├─> Calculate duration (minus paused time)
  │   ├─> Create completed session document
  │   └─> Delete active session document
  │
  ├─> XPService.calculateXP(duration, intensity)
  │   ├─> Base: 10 XP per hour
  │   ├─> Intensity bonus (if set)
  │   └─> Group bonus (if in group)
  │
  ├─> StatsService.updateStats(userId, duration, xp)
  │   ├─> Update totalSessions, totalDuration
  │   ├─> Calculate/update streaks
  │   └─> Add XP to user total
  │
  ├─> AchievementService.checkUnlocks(userId, stats)
  │   ├─> Check all achievement conditions
  │   ├─> Unlock eligible achievements
  │   └─> Award bonus XP
  │
  ├─> Check for level up
  │   └─> If leveled up, generate level up image
  │
  ├─> PostService.createPost(session, xp, achievements)
  │   └─> Post to feed channel (if configured)
  │
  └─> interaction.reply({ content: "Session completed!" })
```

### Leaderboard Query Flow

```
User: /leaderboard timeframe: weekly
  │
  ▼
bot.ts: Handle 'leaderboard' command
  │
  ├─> interaction.deferReply()
  │
  ├─> StatsService.getLeaderboard(serverId, timeframe)
  │   ├─> Query all users in server
  │   ├─> Calculate timeframe-specific XP
  │   ├─> Sort by XP descending
  │   └─> Return top 10 users
  │
  ├─> Generate leaderboard image
  │   └─> Render LeaderboardCard component to PNG
  │
  ├─> Create selection menu (daily/weekly/monthly/all-time)
  │
  └─> interaction.editReply({ files: [image], components: [menu] })

---

User: Selects "monthly" from dropdown
  │
  ▼
bot.ts: Handle StringSelectMenu interaction
  │
  ├─> interaction.deferUpdate()
  │
  ├─> Parse selected timeframe
  │
  ├─> StatsService.getLeaderboard(serverId, 'monthly')
  │
  ├─> Generate new leaderboard image
  │
  └─> interaction.editReply({ files: [newImage] })
```

## Database Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete schema documentation.

### Key Collections

- **activeSessions/sessions/{userId}** - One active session per user
- **sessions/completed/{sessionId}** - All completed sessions
- **userStats/stats/{userId}** - User statistics, XP, achievements
- **groups/active/{groupId}** - Study groups
- **groupMembers/memberships/{userId}** - User group memberships
- **serverConfig/configs/{serverId}** - Server settings (feed channel, timezone)

## Service Layer Architecture

The service layer provides clean separation of business logic from Discord interaction handling.

### Core Services

#### SessionService
Handles all session CRUD operations:
- `createSession(userId, activity, intensity?)` - Start new session
- `getActiveSession(userId)` - Get user's current session
- `pauseSession(userId)` - Pause active session
- `unpauseSession(userId)` - Resume paused session
- `completeSession(userId, title, description)` - Complete and save session
- `cancelSession(userId)` - Delete active session without saving

#### StatsService
Manages user statistics and leaderboards:
- `getOrCreateStats(userId, username)` - Get/create user stats
- `updateStats(userId, sessionData)` - Update stats after session
- `getLeaderboard(serverId, timeframe)` - Get ranked users
- `calculateStreaks(userId, lastSessionAt)` - Update streak counts

#### XPService
Handles XP calculations and leveling:
- `calculateSessionXP(duration, intensity?, groupBonus?)` - Calculate XP for session
- `addXP(userId, xpAmount)` - Add XP and check for level up
- `getCurrentLevel(xp)` - Get level from XP total
- `getXPToNextLevel(xp)` - Calculate XP needed for next level

#### AchievementService
Manages achievement unlocking:
- `checkAndUnlockAchievements(userId, stats)` - Check all conditions
- `unlockAchievement(userId, achievementId)` - Award achievement
- `getUserAchievements(userId)` - Get unlocked achievements
- `getProgress(userId, achievementId)` - Get unlock progress

#### GroupService
Handles study group functionality:
- `createGroup(ownerId, name, isPublic)` - Create new group
- `joinGroup(userId, groupId)` - Join existing group
- `leaveGroup(userId)` - Leave current group
- `getGroupOverview(groupId)` - Get group stats and members
- `updateGroupStats(groupId, duration, xp)` - Update group totals
- `getGroupLeaderboard()` - Get top groups by level

### Image Generation Services

All image services follow the same pattern:

1. **Component Definition** (React/TSX)
   - Define visual layout using React components
   - Use Tailwind-style CSS-in-JS for styling
   - Accept props for dynamic data

2. **Service Class** (TypeScript)
   - Initialize Puppeteer browser
   - Render React component to HTML
   - Convert HTML to PNG using Puppeteer
   - Return Discord AttachmentBuilder

3. **Usage in bot.ts**
   ```typescript
   const image = await profileImageService.generate(userData);
   await interaction.reply({ files: [image] });
   ```

Example services:
- `ProfileImageService` - User profile cards
- `StatsImageService` - Statistics charts
- `GroupOverviewImageService` - Group overview cards
- `LevelUpImageService` - Level up celebration cards

## XP & Leveling System

### XP Calculation

**Base XP**: 10 XP per hour of study time

**Multipliers**:
- Intensity bonus: 1x - 2x (if user sets intensity 1-5)
- Group bonus: 1% per group level (max 50%)

**Formula**:
```typescript
baseXP = (duration / 3600) * 10
intensityMultiplier = intensity ? (1 + (intensity - 1) * 0.25) : 1
groupMultiplier = 1 + (groupLevel * 0.01) // capped at 1.5
totalXP = baseXP * intensityMultiplier * groupMultiplier
```

### Level Progression

Levels use exponential scaling:
```typescript
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}
```

Examples:
- Level 1 → 2: 100 XP
- Level 5 → 6: 1,118 XP
- Level 10 → 11: 3,162 XP
- Level 20 → 21: 8,944 XP

### Level Benefits

- Visual progression (level displayed on profile)
- Unlocks level-based achievements
- Bragging rights on leaderboards
- Future: Unlock special features at certain levels

## Achievement System

### Achievement Categories

1. **Milestone** - First-time accomplishments (e.g., first session)
2. **Time** - Total hours studied (e.g., 10h, 100h, 1000h)
3. **Streak** - Consecutive days (e.g., 7 days, 30 days)
4. **Intensity** - Long sessions (e.g., 3h marathon, 8h deep work)
5. **Schedule** - Time-based patterns (early bird, night owl, weekends)
6. **Level** - XP milestones (reach level 10, 25, 50)
7. **Social** - Community engagement (reactions, cheers)
8. **Diversity** - Variety in activities
9. **Meta** - Special achievements (all achievements unlocked)

### Unlock Conditions

Achievements are checked after every completed session:

```typescript
// Example: "Centurion" achievement (100 hours)
{
  id: 'centurion',
  condition: {
    type: 'hours',
    threshold: 360000, // 100 hours in seconds
    field: 'totalDuration'
  },
  xpReward: 500
}
```

The system automatically:
1. Checks all achievement conditions against user stats
2. Unlocks eligible achievements
3. Awards bonus XP
4. Posts achievement unlock card to feed
5. Updates user's achievement list

### Rarity Tiers

- **Common**: Easy to unlock, low XP reward (50-100 XP)
- **Rare**: Moderate difficulty (200-300 XP)
- **Epic**: Challenging (500-750 XP)
- **Legendary**: Extremely difficult (1000+ XP)

## Image Generation Pipeline

Study Together uses a unique approach to generate rich, visual embeds:

### Technology Stack

- **React** (v19) - Component definition
- **ReactDOM** (Server) - HTML rendering
- **Puppeteer** - Headless browser for image capture
- **Lucide React** - Icon library

### Generation Process

```
1. Data Preparation
   └─> Fetch user stats, sessions, achievements from Firebase

2. Component Rendering
   └─> Pass data to React component (e.g., ProfileCard.tsx)

3. HTML Generation
   └─> ReactDOM.renderToStaticMarkup(component)
   └─> Wrap in full HTML document with styles

4. Puppeteer Capture
   └─> Launch headless Chrome
   └─> Set page content to generated HTML
   └─> Take screenshot with transparent background
   └─> Return PNG buffer

5. Discord Attachment
   └─> Create AttachmentBuilder from PNG buffer
   └─> Attach to Discord message
```

### Example: Profile Card Generation

```typescript
// 1. Component (ProfileCard.tsx)
export function ProfileCard({ username, level, xp, stats }) {
  return (
    <div className="profile-card">
      <h1>{username}</h1>
      <div>Level {level}</div>
      <div>{stats.totalHours}h studied</div>
    </div>
  );
}

// 2. Service (profileImage.ts)
export class ProfileImageService {
  async generate(userData) {
    const html = renderToStaticMarkup(
      <ProfileCard {...userData} />
    );

    const page = await browser.newPage();
    await page.setContent(fullHTML);
    const screenshot = await page.screenshot({ type: 'png' });

    return new AttachmentBuilder(screenshot, { name: 'profile.png' });
  }
}

// 3. Usage (bot.ts)
const image = await profileImageService.generate(userData);
await interaction.reply({ files: [image] });
```

### Performance Considerations

- Browser instance is reused (not relaunched per image)
- Screenshots are optimized for Discord (max 8MB)
- Images are generated on-demand (not cached)
- Generation typically takes 200-500ms

## Group System

### Group Structure

Groups are capped at 5 members and have two visibility modes:
- **Public**: Appears in `/findgroups`, anyone can join
- **Private**: Invite-only via group ID

### Group Leveling

Groups earn XP from all member sessions:
- Member completes session → Group gains that XP
- Group levels up at same XP thresholds as users
- Higher group level = higher XP bonus for all members

### Group Bonuses

```
Group Level 1  → 1% XP bonus
Group Level 10 → 10% XP bonus
Group Level 50 → 50% XP bonus (max)
```

This creates incentive for:
- Staying in the same group long-term
- Encouraging groupmates to study more
- Friendly competition between groups

## Data Flow Examples

### Session Completion Flow

```
User completes session
  ↓
1. SessionService.completeSession()
   ├─> Save to sessions/completed/
   ├─> Delete from activeSessions/
   └─> Return session data

2. XPService.calculateSessionXP()
   ├─> Check group membership
   ├─> Apply intensity bonus
   ├─> Apply group bonus
   └─> Return total XP

3. StatsService.updateStats()
   ├─> Increment totalSessions
   ├─> Add duration to totalDuration
   ├─> Update streaks
   ├─> Add XP to total
   └─> Update lastSessionAt

4. GroupService.updateGroupStats() [if in group]
   ├─> Add XP to group total
   └─> Check for group level up

5. AchievementService.checkAndUnlockAchievements()
   ├─> Check all conditions against new stats
   ├─> Unlock eligible achievements
   └─> Award bonus XP

6. Check for user level up
   └─> If leveled up, generate level up card

7. PostService.createPost()
   ├─> Generate session post image
   ├─> Post to feed channel
   ├─> Add reactions
   └─> Create comment thread
```

## Security & Permissions

### Command Permissions

Most commands are available to all users. Admin commands require:
- `ADMINISTRATOR` permission (Discord)
- Examples: `/setup-feed`, `/groupadmin delete`

### Data Access Control

- Users can only access their own active sessions
- Stats and leaderboards are server-scoped
- Group data is visible to all members
- Completed sessions are public within server

### Firebase Security

Firebase security rules should be configured:
```javascript
// Only bot service account can write
match /discord-data/{document=**} {
  allow read: if true;  // Bot reads
  allow write: if false; // Only service account writes
}
```

## Error Handling

### Interaction Replies

All commands use ephemeral replies for errors:
```typescript
await interaction.reply({
  content: '❌ No active session found.',
  ephemeral: true
});
```

### Service Layer

Services throw errors that are caught by command handlers:
```typescript
try {
  await sessionService.createSession(userId, activity);
} catch (error) {
  console.error('Failed to create session:', error);
  await interaction.reply({
    content: '❌ Failed to start session. Please try again.',
    ephemeral: true
  });
}
```

## Performance Optimization

### Firebase Queries

- Use server-scoped queries (filter by `serverId`)
- Index frequently queried fields
- Batch reads with `Promise.all()`
- Cache user stats in memory during session operations

### Image Generation

- Reuse Puppeteer browser instance
- Optimize component rendering
- Use transparent backgrounds (smaller file size)
- Lazy load icon libraries

### Discord API

- Use `deferReply()` for operations > 3 seconds
- Batch message updates when possible
- Use ephemeral replies to reduce server clutter

## Future Architecture Considerations

### Scalability

- **Multiple servers**: Current architecture supports multi-server deployment
- **Rate limiting**: Discord API limits handled automatically by discord.js
- **Database sharding**: May be needed if user base exceeds 10,000+ active users

### Feature Additions

- **Voice channel integration**: Auto-start sessions when joining study VC
- **Mobile app**: Firestore data is already accessible via Firebase SDKs
- **Webhooks**: Allow external services to post sessions (e.g., Toggl, RescueTime)
- **Analytics dashboard**: Web dashboard for server admins

### Monitoring

Consider adding:
- Application Performance Monitoring (APM)
- Firebase quota monitoring
- Command usage analytics
- Error tracking (Sentry)

---

## Additional Resources

- [Setup Guide](./SETUP.md)
- [Commands Reference](./COMMANDS.md)
- [API Documentation](./API.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Deployment Guide](./DEPLOYMENT.md)
