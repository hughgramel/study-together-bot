# 🚀 Study Together Bot - Engagement Roadmap

> **Goal:** Build a Strava-meets-Duolingo productivity platform with deep social features and gamification

---

## 📊 Table of Contents

1. [Core Gamification Systems](#core-gamification-systems)
2. [Badge System](#badge-system)
3. [Social & Buddy Features](#social--buddy-features)
4. [Goals & Challenges](#goals--challenges)
5. [Live Features (Website/App)](#live-features-websiteapp)
6. [Analytics & Comparisons](#analytics--comparisons)
7. [Implementation Phases](#implementation-phases)

---

## 🎮 Core Gamification Systems

### 1. **XP/Points System**

**Base XP Sources:**
- **Time studied:** 10 XP per hour
- **Session completion:** 25 XP base reward
- **First session of the day:** +25 XP bonus
- **Goal completion:** 50-100 XP (based on difficulty)
- **Daily challenge completion:** 50-150 XP
- **Streak milestones:** 100 XP (7-day), 500 XP (30-day)

**Weighted XP Bonuses:**
- **Leaderboard position:**
  - #1 daily: +50 XP at end of day
  - #2 daily: +30 XP
  - #3 daily: +20 XP
  - Top 3 weekly: Bonus 200/150/100 XP at week end
- **Badge completion:** 25-500 XP per badge unlocked
- **Group study sessions:** 1.5x XP multiplier
- **Buddy study sessions:** 2x XP multiplier (when studying together at scheduled time)

### 2. **Leveling System**

**Level Progression:**
- Level 1: 0 XP (starting point)
- Level 2: 100 XP
- Level 3: 250 XP
- Level 5: 500 XP
- Level 10: 1,500 XP
- Level 20: 5,000 XP
- Level 30: 12,000 XP
- Level 50: 50,000 XP
- Level 100: 250,000 XP

**Level Perks:**
- Level 5: Unlock custom status color
- Level 10: Unlock role shop access
- Level 15: Unlock buddy system features
- Level 20: Unlock group creation
- Level 25: Access to exclusive role colors
- Level 30: Create custom challenges
- Level 50: Special "Legend" badge + role

**Visual Progression:**
- Display level in all embeds, feed posts, /mystats
- Level-up celebrations posted to feed
- Progress bar to next level in /mystats

---

## 🏆 Badge System

### **Individual Achievement Badges**

#### **Milestone Badges**
- 🎯 **First Steps** - Complete your first session
- ⚡ **Speed Demon** - Complete 5 sessions in one day
- 💯 **Centurion** - Reach 100 total hours studied
- 🎓 **Scholar** - Reach 500 total hours studied
- 🧠 **Mastermind** - Reach 1,000 total hours studied
- 📚 **Lifetime Learner** - Reach 2,500 total hours studied

#### **Time-Based Badges (Hours Logged)**
- ⏱️ **Getting Started** - 10 hours total
- 🕐 **Committed** - 50 hours total
- 🕓 **Dedicated** - 100 hours total
- 🕖 **Devoted** - 250 hours total
- 🕙 **Obsessed** - 500 hours total
- ⏰ **Time Master** - 1,000 hours total

#### **Session Count Badges (Days with Activity)**
- 📅 **Week Warrior** - 7 days with sessions
- 🗓️ **Month Master** - 30 days with sessions
- 📆 **Quarter Champion** - 90 days with sessions
- 🎖️ **Year Legend** - 365 days with sessions

#### **Login Streak Badges (Consecutive Days)**
- 🔥 **Hot Streak** - 3-day streak
- 🔥🔥 **On Fire** - 7-day streak
- 🔥🔥🔥 **Blazing** - 14-day streak
- 🌟 **Unstoppable** - 30-day streak
- ⭐ **Legendary** - 60-day streak
- 💫 **Immortal** - 100-day streak

#### **Activity Diversity Badges (Types of Activities)**
- 🎨 **Explorer** - Log 3 different activity types
- 🌈 **Versatile** - Log 7 different activity types
- 🎭 **Renaissance** - Log 15 different activity types
- 🌍 **Universal** - Log 25+ different activity types

#### **Time-of-Day Badges**
- 🐦 **Early Bird** - Start session before 7 AM (5 times)
- 🦉 **Night Owl** - Start session after 11 PM (5 times)
- ☀️ **Daylight Grinder** - Complete 20 sessions during 9 AM - 5 PM
- 🌙 **Midnight Scholar** - Complete 10 sessions after midnight

#### **Intensity Badges**
- 💪 **Marathon** - Single session over 4 hours
- 🏃 **Ultra Marathon** - Single session over 8 hours
- 🎯 **Laser Focus** - Complete 3 sessions in a row without pausing
- ⚔️ **Warrior** - Complete session over 6 hours on weekend

#### **Social Badges**
- 👥 **Team Player** - Participate in 5 group sessions
- 🤝 **Reliable Buddy** - Complete 10 buddy sessions
- 💬 **Supporter** - React to 50 other users' sessions
- 🎉 **Motivator** - Get 100 reactions on your sessions
- 👑 **Influencer** - Have 5+ study buddies

### **Group Badges**

#### **Team Achievement Badges**
- 🏅 **Squad Goals** - Group completes 100 combined hours in a week
- 🚀 **Power Team** - Group completes 500 combined hours total
- 💎 **Elite Squad** - All group members maintain 7-day streak
- 🌟 **Dream Team** - Group holds top 3 spots on weekly leaderboard

#### **Group Milestones**
- 🎊 **Founding Member** - Be in first 5 members of a group
- 📈 **Growth Driver** - Refer 3+ members to your group
- 🏆 **Champion Group** - Group wins monthly challenge

### **Competitive Badges**

#### **Leaderboard Badges**
- 🥇 **Daily Dominator** - Finish #1 on daily leaderboard
- 🥈 **Silver Sprint** - Finish #2 on daily leaderboard
- 🥉 **Bronze Grind** - Finish #3 on daily leaderboard
- 👑 **Weekly Champion** - Finish #1 on weekly leaderboard
- 🏅 **Monthly Master** - Finish #1 on monthly leaderboard
- ⚡ **Speed King/Queen** - Hold #1 spot for 7 consecutive days

#### **Challenge Badges**
- ⚔️ **Duelist** - Win a 1v1 friend challenge
- 🎯 **Challenge Master** - Complete 10 different challenges
- 💪 **Undefeated** - Win 5 friend challenges in a row
- 🔱 **Champion** - Win monthly server-wide challenge

---

## 👥 Social & Buddy Features

### 1. **Study Buddies / Accountability Partners**

**Core Features:**
- `/buddy add @username` - Send buddy request
- `/buddy remove @username` - Remove buddy
- `/buddy list` - View all buddies
- `/buddy stats @username` - Compare stats with buddy

**Buddy Benefits:**
- **Live Notifications:** Get notified when buddy starts studying
- **Buddy Feed:** Special feed showing only buddy activities
- **Comparison View:** Side-by-side stat comparison
- **Encouragement System:** Send cheers, kudos to buddies
- **Double XP Sessions:** When both buddies study at same time (scheduled)
- **Buddy Challenges:** Quick 1v1 challenges (e.g., "Who can study more this week?")

**Buddy Streaks:**
- Track consecutive days both buddies logged sessions
- **Buddy Streak Badges:**
  - 🤝 **Synced** - 3-day buddy streak
  - 💫 **In Sync** - 7-day buddy streak
  - ⭐ **Perfect Harmony** - 30-day buddy streak

### 2. **Study Groups**

**Group Features:**
- `/group create [name]` - Create a study group
- `/group invite @username` - Invite to group
- `/group leaderboard` - Group-only leaderboard
- `/group stats` - Combined group statistics
- `/group challenge` - Create group-only challenge

**Group Benefits:**
- **Group Study Sessions:** Join group session (1.5x XP multiplier)
- **Group Goals:** Collaborative goals (e.g., "Study 200 hours this week as a group")
- **Group Feed:** Private feed for group members
- **Group Challenges:** Compete against other groups
- **Group Roles:** Founder, Admin, Member (with permissions)

**Group Leaderboard:**
- Ranked by combined group hours
- Monthly group competitions
- Special group badges for top groups

### 3. **Friendship-Based Leaderboards**

**Friend Connection System:**
- Connect via buddy system or groups
- `/friends leaderboard` - Leaderboard of only your friends
- **Friend Network Stats:**
  - Total hours studied by friend network
  - Average friend streak
  - Most active friend of the week

### 4. **Scheduled Study Sessions (When2meet Style)**

**Implementation:**
- `/schedule create` - Create a study poll
- Group members vote on available times
- Bot finds optimal time for most members
- Auto-schedules session and reminds participants

**Scheduled Session Features:**
- **Pre-Session Reminders:** 1 hour before, 15 minutes before
- **Session Start:** Bot pings all participants
- **Bonus XP:** 2x XP for completing scheduled session
- **Attendance Tracking:** Track who shows up vs. commits
- **Reliability Score:** Users who consistently attend get "Reliable" badge

---

## 🎯 Goals & Challenges

### 1. **Personal Goals System**

**Goal Types:**
- **Daily Goals:** "Study 2 hours today", "Complete 3 sessions"
- **Weekly Goals:** "Study 15 hours this week", "Maintain 7-day streak"
- **Monthly Goals:** "Reach 60 hours this month", "Complete 40 sessions"
- **Custom Goals:** User-defined goals with custom XP rewards

**Commands:**
- `/goal add [type] [description] [target]` - Create goal
- `/goal list` - View active goals with progress
- `/goal complete [id]` - Mark goal as complete (auto-detection preferred)
- `/goal delete [id]` - Delete goal

**Goal Rewards:**
- Easy goals: 50 XP
- Medium goals: 100 XP
- Hard goals: 200 XP
- Bonus: Display goal completions in feed

### 2. **Daily Challenges**

**System:**
- New challenge every day at midnight (Pacific Time)
- Randomized from pool of challenges
- Bonus XP for completion (50-150 XP)
- Track completion streak (complete challenges X days in a row)

**Example Daily Challenges:**
- "Study 2 hours today"
- "Complete 3 sessions"
- "Start before 10 AM"
- "Study with a buddy"
- "Try a new activity type"
- "Complete a session over 90 minutes"

**Commands:**
- `/challenge` - View today's challenge
- `/challenge history` - View past challenges and completion

### 3. **Friend Challenges (1v1)**

**Challenge System:**
- `/challenge create @friend [time-period] [goal]`
  - Example: `/challenge create @alex 7-days "Who can study more?"`
- Friend accepts or declines
- Bot tracks progress for both users
- Winner announced automatically at end
- Winner gets **Duelist** badge (+ bonus XP)

**Challenge Types:**
- **Time-based:** Most hours in X days
- **Session-based:** Most sessions in X days
- **Streak-based:** Longest streak maintained
- **Consistency:** Most consecutive days with sessions

**Rewards:**
- Winner: 200 XP + special badge for challenge type
- Loser: 50 XP participation reward
- Create challenge rivalry tracking (W-L record between friends)

### 4. **Monthly Server Challenges**

**Server-Wide Events:**
- Special monthly themed challenge
- All users compete
- Top 10 get special badges + XP
- Example: "Finals Week Grind: Study 40 hours this week"

**Monthly Challenge Themes:**
- January: "New Year Resolution" (30-day streak challenge)
- February: "Love of Learning" (Most diverse activities)
- March: "Spring Sprint" (Most total hours)
- Finals Weeks: "Grind Season" (Bonus XP all week)

---

## 🌐 Live Features (Website/App)

> **Note:** These features are for future website/mobile app expansion

### 1. **Live Study Rooms**

**Virtual Study Spaces:**
- Join live study room with other users
- Real-time participant list
- See who's currently studying
- Shared ambient sounds/music (optional)

**Room Features:**
- **Group Timer:** Synchronized pomodoro timer for room
- **Live Chat:** Text chat for quick questions, breaks
- **Video Option:** Optional webcam for accountability
- **Screen Share:** Share screens for co-working
- **Focus Mode:** Mute chat during focus sessions

**Room Types:**
- Public rooms (anyone can join)
- Private rooms (invite-only)
- Group rooms (linked to Discord groups)
- Buddy rooms (just you and your buddy)

### 2. **Shared Pomodoro Timer**

**Features:**
- 25-min focus / 5-min break (customizable)
- Synchronized across all room participants
- Bot posts status in Discord when timer starts/ends
- Track pomodoros completed
- **Pomodoro Badges:**
  - 🍅 **Pomodoro Pro** - 25 pomodoros completed
  - 🍅🍅 **Tomato Master** - 100 pomodoros completed

### 3. **Live Dashboard**

**Real-time Stats:**
- Who's currently studying (across all servers)
- Live global stats (total hours studied today)
- Live leaderboard updates
- Recent completions feed
- Friend activity feed

### 4. **When2meet Integration**

**Scheduling Tool:**
- Create availability poll
- Members mark available times
- Bot finds optimal time
- Auto-schedules and reminds everyone
- Sync with Google Calendar (optional)

---

## 📈 Analytics & Comparisons

### 1. **Enhanced /mystats Command**

**Additional Stats:**
- **Visual Graph:** Weekly bar chart of daily hours (generated image)
- **Breakdown by Category:** Pie chart of activity types
- **Streak Calendar:** Heatmap of active days (like GitHub contributions)
- **Level Progress Bar:** Visual progress to next level
- **Badge Collection:** Display all unlocked badges
- **Comparison to Averages:**
  - Your daily avg vs. server avg
  - Your monthly hours vs. last month
  - Percentile ranking (e.g., "Top 15% this week")

### 2. **Stat Comparison**

**Commands:**
- `/compare @username` - Compare your stats with another user
- `/compare-buddy` - Compare with primary buddy

**Comparison View (Embed):**
```
📊 You vs. @Alex

                You        Alex
Daily:         3.2h       4.1h  ⬆️
Weekly:        18.5h      22.0h ⬆️
Monthly:       67h        71h   ⬆️
Streak:        🔥12       🔥15  ⬆️
Level:         23         28    ⬆️
Total Hours:   342h       456h  ⬆️
```

**Buddy vs. Buddy Stats:**
- Head-to-head record in challenges
- Who's ahead this week
- Longest simultaneous streak

### 3. **Progress Tracking**

**Week-over-Week:**
- `/progress weekly` - Compare this week vs. last week
- Show % change in hours, sessions, avg session length

**Month-over-Month:**
- `/progress monthly` - Compare this month vs. last month
- Highlight improvements and declines

**Personal Bests:**
- Longest single session
- Most hours in a day
- Most hours in a week
- Longest streak
- Most sessions in a day

### 4. **Leaderboard Time on Top Tracking**

**New Stat: "Crown Time"**
- Track total hours/days user held #1 spot
- Display in `/mystats`
- **Crown Badges:**
  - 👑 **King/Queen for a Day** - Hold #1 for 24 hours
  - 👑👑 **Reigning Champion** - Hold #1 for 7 days
  - 👑👑👑 **Eternal Ruler** - Hold #1 for 30 days

**XP from Crown Time:**
- +5 XP per hour holding #1 daily
- +50 XP per day holding #1 weekly
- Bonus 500 XP for full month at #1

---

## 🔄 Implementation Phases

### **Phase 1: Core Gamification** (2-3 weeks)
**Priority: CRITICAL**

- [ ] XP/Points system implementation
  - Track XP in user stats
  - Award XP for time, sessions, goals, streaks
- [ ] Leveling system (1-100)
  - Calculate level from XP
  - Display in all embeds
  - Level-up announcements
- [ ] Basic badge system (20 starter badges)
  - Milestone, time-based, streak badges
  - Badge storage in Firestore
  - Display in `/mystats`
- [ ] Enhanced `/mystats`
  - Show level, XP, badges
  - Progress bar to next level

**Success Metrics:**
- Users check `/mystats` 2x more often
- 30% increase in daily active users

---

### **Phase 2: Social Engagement** (2-3 weeks)
**Priority: HIGH**

- [ ] Study buddy system
  - `/buddy` commands
  - Buddy requests/acceptance
  - Buddy notifications
  - Buddy stats comparison
- [ ] Auto-posted daily leaderboard
  - Cron job at 6 PM Pacific
  - Post top 5 to feed channel
- [ ] Weekly role assignment (top 3)
  - Auto-assign roles every Monday
  - 🥇 🥈 🥉 roles with colors
- [ ] Weekly recap DMs
  - Send every Sunday 8 PM
  - Include: hours, rank change, streak, encouragement

**Success Metrics:**
- 40% of users have at least 1 buddy
- 50% increase in feed engagement (reactions)

---

### **Phase 3: Goals & Challenges** (2-3 weeks)
**Priority: HIGH**

- [ ] Personal goals system
  - `/goal` commands (add, list, complete, delete)
  - Goal tracking in Firestore
  - XP rewards for completion
  - Goal progress in `/mystats`
- [ ] Daily challenges
  - Random challenge pool
  - New challenge at midnight PT
  - Auto-detection of completion
  - Challenge streak tracking
- [ ] Study reminders
  - `/set-reminder` command
  - Store user preferences
  - DM users at specified times
  - "You haven't studied today" reminders

**Success Metrics:**
- 60% of active users set at least 1 goal
- 40% complete daily challenge each day

---

### **Phase 4: Advanced Social** (3 weeks)
**Priority: MEDIUM-HIGH**

- [ ] Study groups
  - `/group` commands (create, invite, stats, leaderboard)
  - Group-only feed and challenges
  - Group badges
  - Group leaderboard
- [ ] Friend challenges (1v1)
  - `/challenge @friend` command
  - Challenge tracking system
  - Win/loss records
  - Challenge badges
- [ ] Scheduled study sessions
  - `/schedule` commands
  - When2meet style polls
  - Auto-reminders
  - 2x XP for attendance
  - Reliability scoring

**Success Metrics:**
- 30% of users in at least 1 group
- 20% participate in friend challenge

---

### **Phase 5: Economy & Customization** (2 weeks)
**Priority: MEDIUM**

- [ ] Role shop
  - `/shop` command
  - Purchase colored roles with XP
  - Role tiers (1000, 2500, 5000 XP)
  - Custom role names for Level 30+
- [ ] Level perks system
  - Unlock features at certain levels
  - Special permissions for high levels
- [ ] Profile customization
  - Custom status messages
  - Profile themes
  - Badge showcase (pin favorite badges)

**Success Metrics:**
- 25% of users purchase at least 1 role
- Users grind for specific XP goals

---

### **Phase 6: Analytics & Insights** (2-3 weeks)
**Priority: MEDIUM**

- [ ] Enhanced analytics
  - Weekly/monthly progress reports
  - `/compare @user` command
  - Personal bests tracking
  - Crown time (time on top of leaderboard)
- [ ] Visual stats (graphs)
  - Generate chart images with QuickChart
  - Weekly bar chart in `/mystats`
  - Streak heatmap calendar
  - Activity breakdown pie chart
- [ ] Category/tagging system
  - Auto-detect activity categories
  - Stats by category
  - Category leaderboards
  - Diversity badges

**Success Metrics:**
- Users share stats screenshots in feed
- 30% check `/compare` weekly

---

### **Phase 7: Live Features (Web/App)** (Ongoing - Future)
**Priority: LOW (Requires web app)**

- [ ] Live study rooms
  - Real-time room system
  - Live chat
  - Participant list
  - Synchronized timer
- [ ] Shared pomodoro timer
  - Synchronized 25/5 timer
  - Room-wide breaks
  - Pomodoro tracking
- [ ] Live dashboard
  - Real-time global stats
  - Live leaderboard
  - Friend activity feed
- [ ] When2meet integration
  - Scheduling polls
  - Calendar sync
  - Auto-reminders

**Success Metrics:**
- 20% of sessions happen in live rooms
- Average room occupancy > 3 users

---

## 🎯 Success KPIs

### **Engagement Metrics**
- **Daily Active Users (DAU):** Target 40% of total users
- **Weekly Active Users (WAU):** Target 70% of total users
- **Avg Sessions per User per Week:** Target 5+
- **Avg Study Time per User per Week:** Target 10+ hours
- **Retention Rate (Week 2):** Target 60%
- **Retention Rate (Month 2):** Target 40%

### **Social Metrics**
- **Users with Buddies:** Target 50%
- **Users in Groups:** Target 35%
- **Feed Reactions per Post:** Target avg 5+
- **Challenges Completed:** Target 30% participation

### **Gamification Metrics**
- **Users with Goals:** Target 60%
- **Daily Challenge Completion:** Target 40%
- **Badges Earned per User:** Target avg 8+
- **Level Distribution:** Target 30% Level 10+, 10% Level 20+

---

## 📝 Notes & Considerations

### **Technical Requirements**
- **Image Generation:** Use QuickChart API or node-canvas for graphs
- **Scheduling:** Use `node-schedule` or cron for reminders, daily challenges, leaderboard posts
- **Real-time (Web):** WebSocket server for live features (Socket.io)
- **Database:** Firestore subcollections for groups, buddies, challenges
- **Rate Limits:** Discord rate limits on DMs (batch reminders carefully)

### **Community Management**
- Monitor for XP/badge farming/cheating
- Manual session logging limits (cap at 12 hours/session)
- Abuse reporting system
- Admin tools to reset stats if needed

### **Future Expansion Ideas**
- Mobile app with push notifications
- Integration with focus apps (Forest, Freedom)
- Spotify integration (track study playlists)
- Export data (CSV, PDF reports)
- AI study recommendations based on patterns
- Marketplace for custom challenges/goals

---

## 🚀 Quick Start Implementation

### **Week 1: Foundation**
1. Add `xp`, `level` fields to user stats
2. Create XP calculation functions
3. Update session completion to award XP
4. Display XP/level in `/mystats`

### **Week 2: Badges & Milestones**
1. Create badge schema in Firestore
2. Implement 10 core badges
3. Badge unlock detection logic
4. Display badges in `/mystats`

### **Week 3: Social Core**
1. Build buddy system (add/remove/list)
2. Buddy notifications on session start
3. `/compare` command
4. Auto-posted daily leaderboard

### **Week 4: Goals**
1. Goal CRUD commands
2. Goal tracking logic
3. Auto-detection of goal completion
4. Goal progress display

**By end of Month 1:** Have XP, levels, badges, buddies, goals all functional.

---

*Last Updated: [Date]*
*Maintained by: Study Together Bot Team*
