# Contributing Guide

Thank you for your interest in contributing to Study Together! This guide will help you get started with contributing code, reporting bugs, and suggesting features.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Issue Guidelines](#issue-guidelines)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone. We expect all contributors to:

- Be respectful and considerate
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other contributors

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or inflammatory comments
- Public or private harassment
- Publishing others' private information without permission

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18+ installed
- Git installed and configured
- A Discord account (for testing)
- A Firebase account (for testing)
- Familiarity with TypeScript and Discord.js

### Initial Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub
   # Then clone your fork
   git clone https://github.com/YOUR_USERNAME/study-together-bot.git
   cd study-together-bot
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/study-together-bot.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment**
   - Follow the [Setup Guide](./SETUP.md) to configure `.env` and Firebase
   - Create a test Discord server for development

5. **Verify setup**
   ```bash
   npm run dev
   ```

---

## Development Workflow

### Branching Strategy

We use a feature branch workflow:

```
main (production-ready code)
  ↑
  └─ feature/your-feature-name (your changes)
```

**Creating a feature branch:**
```bash
# Update main first
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/add-new-command
```

**Branch naming conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Adding tests

**Examples:**
- `feature/add-pomodoro-timer`
- `fix/leaderboard-pagination`
- `docs/update-api-reference`
- `refactor/session-service`

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes**
   - Write code following our [style guidelines](#code-style-guidelines)
   - Add tests if applicable
   - Update documentation if needed

3. **Test locally**
   ```bash
   npm run dev
   # Test your changes in Discord
   ```

4. **Commit changes**
   ```bash
   git add .
   git commit -m "Add new feature: description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature
   ```

6. **Create Pull Request**
   - Go to GitHub
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template

---

## Code Style Guidelines

### TypeScript Style

**Use TypeScript strict mode:**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true
  }
}
```

**Always define types:**
```typescript
// Good
async function getUser(userId: string): Promise<UserStats | null> {
  // ...
}

// Bad
async function getUser(userId) {
  // ...
}
```

**Use interfaces from `types.ts`:**
```typescript
import { ActiveSession, UserStats } from '../types';

const session: ActiveSession = {
  userId,
  username,
  // ...
};
```

### Naming Conventions

**Variables and functions:**
```typescript
// camelCase for variables and functions
const activeSession = await getActiveSession(userId);
```

**Classes:**
```typescript
// PascalCase for classes
export class SessionService {
  // ...
}
```

**Constants:**
```typescript
// UPPER_SNAKE_CASE for constants
const MAX_SESSION_DURATION = 43200; // 12 hours
const DEFAULT_XP_PER_HOUR = 10;
```

**File names:**
```typescript
// camelCase for files
sessionService.ts
groupOverviewImage.ts
```

### Function Structure

**Keep functions focused and single-purpose:**
```typescript
// Good - one clear purpose
async function calculateSessionXP(duration: number): Promise<number> {
  return Math.floor((duration / 3600) * 10);
}

// Bad - doing too much
async function completeSessionAndUpdateEverything(userId: string, title: string) {
  // Completing session
  // Updating stats
  // Checking achievements
  // Posting to feed
  // etc. (too much!)
}
```

**Use descriptive variable names:**
```typescript
// Good
const elapsedTimeInSeconds = calculateDuration(startTime, endTime);

// Bad
const t = calculateDuration(s, e);
```

### Async/Await

**Prefer async/await over promises:**
```typescript
// Good
async function getUserData(userId: string) {
  const stats = await statsService.getUserStats(userId);
  const session = await sessionService.getActiveSession(userId);
  return { stats, session };
}

// Avoid
function getUserData(userId: string) {
  return statsService.getUserStats(userId).then(stats => {
    return sessionService.getActiveSession(userId).then(session => {
      return { stats, session };
    });
  });
}
```

### Error Handling

**Always handle errors gracefully:**
```typescript
async function startSession(interaction: CommandInteraction) {
  try {
    await sessionService.createActiveSession(...);
    await interaction.reply({
      content: '✅ Session started!',
      ephemeral: true
    });
  } catch (error) {
    console.error('Failed to start session:', error);
    await interaction.reply({
      content: '❌ Failed to start session. Please try again.',
      ephemeral: true
    });
  }
}
```

### Discord Interaction Patterns

**Use ephemeral replies for user-only messages:**
```typescript
// Good - user-only error
await interaction.reply({
  content: '❌ No active session found.',
  ephemeral: true
});

// Good - public success (feed post)
await interaction.reply({
  content: '✅ Session completed! Posted to feed.',
  ephemeral: false
});
```

**Defer replies for long operations:**
```typescript
// If operation takes > 3 seconds
await interaction.deferReply();

// Do long operation
const image = await statsImageService.generate(...);

// Then edit reply
await interaction.editReply({ files: [image] });
```

### Comments

**Write self-documenting code, but add comments when needed:**
```typescript
// Good - explains WHY
// Paused time is excluded from duration to prevent gaming the system
const activeDuration = totalDuration - pausedDuration;

// Bad - explains WHAT (obvious from code)
// Add 1 to the session count
stats.totalSessions += 1;
```

**Use JSDoc for public APIs:**
```typescript
/**
 * Calculate XP earned from a session
 *
 * @param duration - Session duration in seconds
 * @param intensity - Optional intensity multiplier (1-5)
 * @returns XP amount (integer)
 *
 * @example
 * calculateSessionXP(3600); // 1 hour = 100 XP
 * calculateSessionXP(3600, 3); // With intensity = 150 XP
 */
export function calculateSessionXP(duration: number, intensity?: number): number {
  // ...
}
```

---

## Testing Requirements

### Manual Testing

Before submitting a PR, test your changes:

1. **Start the bot locally**
   ```bash
   npm run dev
   ```

2. **Test the specific feature**
   - Run the new/modified command
   - Test edge cases
   - Test error scenarios

3. **Test related features**
   - Ensure you didn't break existing functionality

4. **Test on multiple scenarios**
   - New user (no stats)
   - Existing user (with stats)
   - Different server configurations

### Test Checklist

For command changes:
- [ ] Command appears in Discord (slash command registration)
- [ ] Command responds correctly to valid input
- [ ] Command handles invalid input gracefully
- [ ] Error messages are user-friendly
- [ ] Ephemeral vs public replies are correct
- [ ] Data is saved to Firebase correctly
- [ ] Images generate correctly (if applicable)

For service changes:
- [ ] Service methods work as expected
- [ ] Firebase reads/writes are correct
- [ ] Error handling works
- [ ] No breaking changes to existing code

### Writing Tests (Optional but Encouraged)

If adding complex logic, consider writing unit tests:

```typescript
// src/services/xp.test.ts
import { calculateSessionXP } from './xp';

describe('XP Calculation', () => {
  test('calculates XP for 1 hour session', () => {
    expect(calculateSessionXP(3600)).toBe(100);
  });

  test('rounds up for partial hours', () => {
    expect(calculateSessionXP(1800)).toBe(50);
  });
});
```

Run tests:
```bash
npm test
```

---

## Pull Request Process

### Before Creating a PR

1. **Update your branch**
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature
   git rebase main
   ```

2. **Test thoroughly**
   - Run the bot locally
   - Test all affected features
   - Check for console errors

3. **Review your changes**
   ```bash
   git diff main
   ```

4. **Commit with clear messages**
   - See [Commit Message Guidelines](#commit-message-guidelines)

### Creating the PR

1. **Push to your fork**
   ```bash
   git push origin feature/your-feature
   ```

2. **Open PR on GitHub**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the template

### PR Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test this?

- [ ] Tested locally
- [ ] Tested in production environment
- [ ] Added unit tests

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed my code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No breaking changes (or documented)
- [ ] Tested thoroughly

## Screenshots (if applicable)
Add screenshots of new features or UI changes.
```

### PR Review Process

1. **Automated checks**
   - TypeScript compilation
   - Linting (if configured)
   - Tests (if configured)

2. **Code review**
   - Maintainer reviews code
   - May request changes

3. **Address feedback**
   ```bash
   # Make requested changes
   git add .
   git commit -m "Address review feedback"
   git push origin feature/your-feature
   ```

4. **Approval and merge**
   - Once approved, maintainer merges
   - Your branch is deleted
   - Changes deploy to production

---

## Commit Message Guidelines

### Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples

**Good commit messages:**
```
feat: Add pomodoro timer integration

Implements a pomodoro timer system that automatically pauses sessions
after 25 minutes and suggests a 5-minute break. Integrates with existing
session pause/unpause functionality.

Closes #123
```

```
fix: Correct streak calculation for edge case

Fixes a bug where streaks were not properly calculated when a user's
last session was exactly at midnight.

Fixes #456
```

```
docs: Update API documentation for GroupService

Added missing method documentation and corrected parameter types.
```

**Bad commit messages:**
```
fixed stuff
wip
asdf
Update bot.ts
```

### Commit Best Practices

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep subject line under 50 characters
- Separate subject from body with blank line
- Wrap body at 72 characters
- Reference issues and PRs in footer

---

## Issue Guidelines

### Reporting Bugs

**Before creating an issue:**
1. Search existing issues to avoid duplicates
2. Check if it's already fixed in main branch
3. Gather necessary information

**Bug report template:**
```markdown
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Run command `/start`
2. Wait 5 minutes
3. Run command `/stop`
4. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- Bot version: v1.2.3
- Node.js version: 18.0.0
- Discord.js version: 14.14.1

## Logs
```
Paste relevant error logs here
```

## Screenshots (if applicable)
Add screenshots.
```

### Requesting Features

**Feature request template:**
```markdown
## Feature Description
What feature do you want added?

## Use Case
Why is this feature useful?

## Proposed Solution
How do you think this should work?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Any other information.
```

---

## Feature Requests

### Evaluation Criteria

We evaluate feature requests based on:

1. **Alignment with project goals**
   - Does it fit the vision of Study Together?
   - Is it related to productivity tracking?

2. **User value**
   - How many users will benefit?
   - Is it a common use case?

3. **Implementation complexity**
   - How difficult is it to implement?
   - Does it require major architectural changes?

4. **Maintenance burden**
   - Will it require ongoing maintenance?
   - Does it introduce new dependencies?

### Feature Development Process

1. **Discussion**
   - Create an issue to discuss the feature
   - Get feedback from maintainers

2. **Design**
   - Plan the implementation
   - Discuss API design
   - Consider edge cases

3. **Implementation**
   - Create feature branch
   - Implement the feature
   - Write tests

4. **Review**
   - Submit PR
   - Address feedback
   - Iterate

5. **Merge and deploy**
   - Merge to main
   - Deploy to production

---

## Development Tips

### Useful Commands

```bash
# Run in development mode (auto-restart)
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Run tests (if configured)
npm test

# Check TypeScript errors
npx tsc --noEmit

# Format code (if prettier configured)
npm run format
```

### Debugging

**Console logging:**
```typescript
console.log('[DEBUG] Session data:', session);
console.error('[ERROR] Failed to update stats:', error);
```

**Discord.js debug events:**
```typescript
client.on('debug', console.log);
client.on('warn', console.warn);
client.on('error', console.error);
```

**Firebase emulator (optional):**
```bash
firebase emulators:start
# Test locally without affecting production data
```

### Common Pitfalls

1. **Forgetting to defer long replies**
   - Commands that take > 3 seconds will timeout
   - Always use `interaction.deferReply()` for image generation

2. **Not handling errors**
   - Always wrap async operations in try/catch
   - Provide user-friendly error messages

3. **Hardcoding values**
   - Use constants and environment variables
   - Don't hardcode Discord IDs or channel names

4. **Breaking changes without migration**
   - Consider backward compatibility
   - Provide migration scripts if needed

---

## Getting Help

If you need help:

1. **Check documentation**
   - [Setup Guide](./SETUP.md)
   - [Architecture](./ARCHITECTURE.md)
   - [API Documentation](./API.md)

2. **Search existing issues**
   - Someone may have had the same question

3. **Ask in discussions**
   - Use GitHub Discussions for questions
   - Or join our Discord server (if available)

4. **Ask maintainers**
   - Tag maintainers in issues or PRs
   - Be patient - we're volunteers!

---

## Recognition

Contributors will be:
- Listed in the README
- Mentioned in release notes
- Invited to join the contributors team

Thank you for contributing to Study Together! Your efforts help make productivity tracking better for everyone.

---

**Additional Resources:**
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Reference](./API.md)
- [Commands Reference](./COMMANDS.md)
- [Discord.js Guide](https://discordjs.guide/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
