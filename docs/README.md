# Study Together Documentation

Welcome to the complete documentation for Study Together bot - a Discord bot for collaborative productivity tracking with Strava-style social features.

## Quick Navigation

### Getting Started
- **[Setup Guide](./SETUP.md)** - Install and configure the bot locally or in production
- **[Commands Reference](./COMMANDS.md)** - Complete list of all available commands
- **[Deployment Guide](./DEPLOYMENT.md)** - Deploy to Railway for production use

### For Developers
- **[Architecture Documentation](./ARCHITECTURE.md)** - System design and component overview
- **[API Documentation](./API.md)** - Service layer and code APIs
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute code and features

---

## What is Study Together?

Study Together is a Discord bot that helps communities track productivity, compete on leaderboards, and support each other through study sessions. Think of it as "Strava for studying" - you track your sessions, earn XP and achievements, and share your progress with friends.

### Key Features

- **Session Tracking** - Start, pause, and complete study/work sessions with live timers
- **XP & Leveling** - Earn XP for every hour studied, level up, and unlock achievements
- **Leaderboards** - Compete with others on daily, weekly, monthly, and all-time leaderboards
- **Study Groups** - Create or join groups to earn XP bonuses and track collective progress
- **Achievements** - Unlock 50+ achievements for milestones, streaks, and special accomplishments
- **Social Feed** - Share completed sessions with beautiful cards and get kudos from peers
- **Goals & Events** - Set daily goals and create study events for collaborative sessions
- **Rich Visualizations** - Auto-generated images for stats, profiles, leaderboards, and more

---

## Documentation Overview

### [Setup Guide](./SETUP.md)

Complete installation and configuration instructions.

**Topics covered:**
- Prerequisites (Node.js, Discord, Firebase)
- Discord bot creation and configuration
- Firebase setup and service account
- Local development environment
- Environment variables
- Testing your installation
- Troubleshooting common issues

**Who should read:** Everyone - start here if you're new!

---

### [Commands Reference](./COMMANDS.md)

Every command explained in detail with examples.

**Topics covered:**
- Session management (`/start`, `/stop`, `/pause`, `/time`, `/cancel`)
- Statistics and profiles (`/stats`, `/me`, `/profile`, `/achievements`)
- Leaderboards (`/leaderboard`, `/live`)
- Study groups (`/creategroup`, `/joingroup`, `/group`, `/findgroups`)
- Goals and events (`/goal`, `/createevent`, `/events`)
- Admin commands (`/setup-feed`, `/setup-timezone`)

**Who should read:** All users and admins

---

### [Architecture Documentation](./ARCHITECTURE.md)

In-depth system design and technical architecture.

**Topics covered:**
- High-level system overview
- Directory structure explanation
- Command flow diagrams
- Database schema and collections
- Service layer architecture
- XP and leveling system
- Achievement system
- Image generation pipeline
- Group system design
- Data flow examples
- Security and permissions

**Who should read:** Developers, contributors, advanced users

---

### [API Documentation](./API.md)

Complete service layer API reference.

**Topics covered:**
- Core services (Session, Stats, XP, Achievement)
- Social services (Group, Post, Event, DailyGoal)
- Image generation services
- Method signatures and examples
- TypeScript interfaces
- Common patterns and best practices

**Who should read:** Developers working with the codebase

---

### [Deployment Guide](./DEPLOYMENT.md)

Production deployment to Railway.

**Topics covered:**
- Railway setup and configuration
- Environment variables for production
- Build process and commands
- Monitoring and logs
- Troubleshooting deployment issues
- Rollback procedures
- Scaling considerations
- Cost estimation

**Who should read:** Admins deploying to production

---

### [Contributing Guide](./CONTRIBUTING.md)

How to contribute code, report bugs, and suggest features.

**Topics covered:**
- Code of conduct
- Development workflow
- Code style guidelines
- Testing requirements
- Pull request process
- Commit message conventions
- Issue reporting
- Feature request process

**Who should read:** Contributors and developers

---

## Quick Start

### For Users

1. **Install the bot** - Follow the [Setup Guide](./SETUP.md)
2. **Learn the commands** - Check the [Commands Reference](./COMMANDS.md)
3. **Start tracking** - Run `/start` to begin your first session!

### For Admins

1. **Deploy the bot** - Follow the [Deployment Guide](./DEPLOYMENT.md)
2. **Configure server** - Set up feed channel with `/setup-feed`
3. **Invite users** - Share the bot in your community

### For Developers

1. **Understand the system** - Read [Architecture Documentation](./ARCHITECTURE.md)
2. **Explore the code** - Review [API Documentation](./API.md)
3. **Start contributing** - Follow the [Contributing Guide](./CONTRIBUTING.md)

---

## Common Questions

### How do I install the bot locally?

See [Setup Guide - Local Development Setup](./SETUP.md#part-3-local-development-setup)

### How do I deploy to production?

See [Deployment Guide - Railway Deployment](./DEPLOYMENT.md#railway-deployment)

### What commands are available?

See [Commands Reference - Quick Reference](./COMMANDS.md#quick-reference)

### How does the XP system work?

See [Architecture - XP & Leveling System](./ARCHITECTURE.md#xp--leveling-system)

### How do I contribute?

See [Contributing Guide - Getting Started](./CONTRIBUTING.md#getting-started)

### How are images generated?

See [Architecture - Image Generation Pipeline](./ARCHITECTURE.md#image-generation-pipeline)

### What's the database schema?

See [Architecture - Database Schema](./ARCHITECTURE.md#database-schema)

### How do achievements work?

See [Architecture - Achievement System](./ARCHITECTURE.md#achievement-system)

---

## Architecture at a Glance

```
Discord Client
      ↓
   bot.ts (Command Handlers)
      ↓
   ┌──────────────────────┐
   │  Service Layer       │
   │  • SessionService    │
   │  • StatsService      │
   │  • XPService         │
   │  • AchievementSvc    │
   │  • GroupService      │
   └──────────────────────┘
      ↓
Firebase Firestore
   • activeSessions
   • sessions
   • userStats
   • groups
   • achievements
```

See [Architecture Documentation](./ARCHITECTURE.md) for detailed diagrams.

---

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js 18+
- **Framework:** Discord.js v14
- **Database:** Firebase Firestore
- **Image Generation:** Puppeteer + React
- **Deployment:** Railway

---

## Key Concepts

### Sessions

Users start sessions with `/start`, track time with `/time`, and complete with `/stop`. Sessions earn XP based on duration and unlock achievements.

### XP & Levels

- **Base XP:** 10 XP per hour studied
- **Leveling:** Exponential curve (Level 1 = 100 XP, Level 10 = 3,162 XP)
- **Bonuses:** Intensity, group membership, streak milestones

### Achievements

50+ unlockable achievements across categories:
- Milestones (first session, 100 sessions)
- Time (10 hours, 100 hours, 1000 hours)
- Streaks (7 days, 30 days, 100 days)
- Schedule (early bird, night owl, weekend warrior)
- Social (reactions, cheers)

### Groups

Teams of up to 5 members that:
- Earn collective XP
- Level up together
- Provide XP bonuses (1% per group level, max 50%)
- Compete on group leaderboards

---

## Project Structure

```
study-together-bot/
├── docs/                   # Documentation (you are here!)
│   ├── README.md          # This file
│   ├── SETUP.md
│   ├── COMMANDS.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── CONTRIBUTING.md
│
├── src/                    # Source code
│   ├── bot.ts             # Main entry point
│   ├── types.ts           # TypeScript interfaces
│   ├── services/          # Business logic
│   ├── components/        # React components (for images)
│   ├── data/              # Static data (achievements, badges)
│   └── utils/             # Utility functions
│
├── .env.example           # Environment template
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── README.md              # Main project README
```

---

## Support & Community

### Getting Help

1. **Check documentation** - Start with the relevant guide above
2. **Search issues** - Someone may have had the same question
3. **Create an issue** - If you found a bug or have a question
4. **Join Discord** - (If available) Chat with other users and contributors

### Reporting Bugs

See [Contributing Guide - Issue Guidelines](./CONTRIBUTING.md#issue-guidelines)

### Requesting Features

See [Contributing Guide - Feature Requests](./CONTRIBUTING.md#feature-requests)

---

## Development Resources

### External Documentation

- [Discord.js Guide](https://discordjs.guide/) - Discord bot development
- [Discord.js Documentation](https://discord.js.org/) - API reference
- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore) - Database
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript
- [Puppeteer Documentation](https://pptr.dev/) - Image generation
- [React Documentation](https://react.dev/) - Component library

### Useful Tools

- [Discord Developer Portal](https://discord.com/developers/applications) - Manage bot
- [Firebase Console](https://console.firebase.google.com/) - Manage database
- [Railway Dashboard](https://railway.app/dashboard) - Manage deployments

---

## Version History

### Current Version: 1.0.0

**Major Features:**
- Session tracking with pause/unpause
- XP and leveling system
- Achievement system (50+ achievements)
- Study groups with XP bonuses
- Leaderboards (daily, weekly, monthly, all-time)
- Group leaderboards
- Daily goals
- Study events
- Auto-generated images for all features
- Social feed with reactions

**See CHANGELOG.md for detailed version history**

---

## License

ISC License - See LICENSE file for details

---

## Acknowledgments

Built with:
- [Discord.js](https://discord.js.org/) - Discord API library
- [Firebase](https://firebase.google.com/) - Database and backend
- [Puppeteer](https://pptr.dev/) - Image generation
- [React](https://react.dev/) - UI components

---

## Next Steps

Choose your path:

**I want to use the bot:**
→ Start with [Setup Guide](./SETUP.md)

**I want to understand how it works:**
→ Read [Architecture Documentation](./ARCHITECTURE.md)

**I want to contribute code:**
→ Follow [Contributing Guide](./CONTRIBUTING.md)

**I want to deploy to production:**
→ Follow [Deployment Guide](./DEPLOYMENT.md)

**I want to see all commands:**
→ Check [Commands Reference](./COMMANDS.md)

**I want to use the API:**
→ Review [API Documentation](./API.md)

---

**Happy studying! 📚✨**
