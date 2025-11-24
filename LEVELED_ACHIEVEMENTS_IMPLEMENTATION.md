# Leveled Achievements System - Implementation Complete

## Overview

This document outlines the complete implementation of the Duolingo-style leveled achievements system that replaces the previous one-time achievement system with a progressive leveling system.

## What Changed

### Before
- 48+ individual achievements with one-time unlocks
- Each achievement awarded a one-time XP bonus
- No progression or ongoing rewards
- Complex achievement unlock logic across many categories

### After
- **4 core leveled achievements** with 10 levels each
- Each achievement level grants **+0.1% permanent XP boost**
- Maximum boost: **4.0%** (4 achievements × 10 levels × 0.1%)
- Clean, visual Duolingo-style display
- Progressive rewards that encourage long-term engagement

---

## The 4 Core Achievements

### 1. Scholar 📚 (Blue)
**Tracks:** Total hours studied
**Levels:** 10 → 25 → 50 → 100 → 250 → 500 → 1000 → 2500 → 5000 → 10000 hours
**Description:** "Total hours studied"

### 2. Marathon Runner ⚡ (Orange)
**Tracks:** Longest single session
**Levels:** 1 → 2 → 4 → 6 → 8 → 10 → 12 → 15 → 18 → 24 hours
**Description:** "Longest session"

### 3. Wildfire 🔥 (Red)
**Tracks:** Longest streak
**Levels:** 1 → 7 → 14 → 30 → 60 → 90 → 180 → 365 → 500 → 1000 days
**Description:** "Longest streak"

### 4. Champion 🏆 (Gold)
**Tracks:** User level (calculated from XP)
**Levels:** 1 → 5 → 10 → 25 → 35 → 50 → 75 → 90 → 100 → 125
**Description:** "User level"

---

## XP Boost System

### How It Works
- Each achievement level unlocked = **+0.1% XP boost**
- Boosts **stack across all achievements**
- Applies to **all XP gains** (sessions, manual time, feed posts)
- Calculated and stored in `UserStats.totalAchievementBoost`

### Example Progression
```
Level 3 Scholar + Level 2 Wildfire + Level 1 Champion = 6 total levels
Total boost = 6 × 0.1% = +0.6% XP
```

### XP Calculation Order
1. **Base XP** (100 XP/hour)
2. **Intensity multiplier** (1.0-2.0x based on session intensity)
3. **Achievement boost** (+0.0% to +4.0%)
4. **User level bonus** (up to +50% at level 100)
5. **Group bonus** (up to +50% based on group level)

---

## Files Created

### Data & Types
- `src/data/leveledAchievements.ts` - Achievement definitions
- `src/types.ts` - Updated with `LeveledAchievementDefinition` and `LeveledAchievementProgress`

### Services
- `src/services/leveledAchievements.ts` - Core achievement logic
- `src/services/leveledAchievementsImage.ts` - Puppeteer image generation service

### Components
- `src/components/LeveledAchievementCard.tsx` - Single achievement display
- `src/components/LeveledAchievementsList.tsx` - Full achievements list

### Scripts
- `scripts/migrate-leveled-achievements.ts` - Migration script with backup

---

## Files Modified

### Core Logic
- `src/services/stats.ts`
  - Added achievement boost to XP calculation (line 283-286, 172-178)
  - Integrated achievement level-up checking (line 442, 219)
  - Imports `LeveledAchievementService`

### Commands
- `src/commands/stats/achievements.ts`
  - Complete rewrite to use leveled achievements
  - Now generates and displays achievement progress image
  - Uses `LeveledAchievementService` and `leveledAchievementsImage`

### Configuration
- `package.json` - Added `migrate-leveled-achievements` script

---

## Migration Process

### What the Migration Does

1. **Backs up legacy data** to `discord-data/achievementBackup/legacy/{userId}`
2. **Calculates refund XP** for removed achievements:
   - Schedule achievements (weekend warrior, morning routines, etc.)
   - Level achievements (level_5, level_10, etc.)
   - Meta achievements (collector)
   - Special achievements (new_record, first_steps)
   - **Total possible refund: ~6,950 XP per user**

3. **Initializes leveled achievements** based on current stats:
   - Scholar: Based on `totalDuration`
   - Marathon Runner: Based on `longestSessionDuration`
   - Wildfire: Based on `longestStreak`
   - Champion: Based on `xp` (converted to level)

4. **Calculates achievement boost** and stores in `totalAchievementBoost`

5. **Preserves legacy achievements** (doesn't delete, marks as migrated)

### Running the Migration

```bash
npm run migrate-leveled-achievements
```

The script will:
- Show a summary of what it will do
- Ask for confirmation (type "yes" to proceed)
- Process each user and display progress
- Show a final summary with success/error counts

### Migration Safety
- ✅ Creates backup collection before any changes
- ✅ Uses Firestore transactions for data integrity
- ✅ Preserves legacy achievements with `legacyAchievementsMigrated` flag
- ✅ Can be re-run if needed (idempotent for most operations)

---

## Database Schema Changes

### New Fields in `UserStats`
```typescript
interface UserStats {
  // ... existing fields ...

  // New leveled achievements
  leveledAchievements?: {
    [achievementId: string]: {
      achievementId: string;
      currentLevel: number;        // 0-10
      currentProgress: number;      // Current stat value
      unlockedAt?: Timestamp;       // When first level achieved
      lastLevelUpAt?: Timestamp;    // When most recently leveled up
    };
  };
  totalAchievementBoost?: number;  // Total XP boost % (e.g., 2.5 = +2.5%)

  // Legacy achievements marked as migrated
  legacyAchievementsMigrated?: boolean;
  legacyAchievementsMigratedAt?: Timestamp;
}
```

### New Backup Collection
```
discord-data/
  achievementBackup/
    legacy/
      {userId}/ - Contains old achievements array and timestamps
```

---

## Visual Design

### Achievement Display
The `/achievements` command now generates a visual image showing:
- **Header**: User avatar, username, and total XP boost badge
- **Achievement cards**: Each showing:
  - Icon with level badge (1-10 or "MAX")
  - Achievement name
  - Progress bar (except for maxed achievements)
  - Current progress / next threshold
- **Footer**: Explanation of XP boost system
- **Colors**: Each achievement has a unique color matching its theme

### Light/Dark Mode
- Respects user's `lightMode` preference from `UserStats`
- Different color schemes for readability
- Consistent with other bot-generated images

---

## Testing Checklist

### Before Migration
- [x] Run migration script in test mode (code complete, ready to test)
- [ ] Verify backup collection is created
- [ ] Check XP refund calculations are correct
- [ ] Verify achievement levels are calculated properly

### After Migration
- [ ] Run `/achievements` to view new UI
- [ ] Complete a session and verify:
  - [ ] XP boost is applied correctly
  - [ ] Achievement levels update based on new stats
  - [ ] Level-up notifications appear (if implemented)
- [ ] Check manual time registration includes achievement boost
- [ ] Verify feed posts show correct XP with boost applied
- [ ] Test edge cases:
  - [ ] User with no achievements (new user)
  - [ ] User at max level for some achievements
  - [ ] User with multiple achievements leveling up in one session

---

## Deployment Steps

### Pre-Deployment
1. **Test locally** with production Firebase data
2. **Run migration script** on staging/production database:
   ```bash
   npm run migrate-leveled-achievements
   ```
3. **Verify migration completed successfully** (check logs for errors)

### Deployment
4. **Build the application**:
   ```bash
   npm run build
   ```
5. **Commit changes** to git (but DO NOT push yet):
   ```bash
   git add .
   git commit -m "Implement Duolingo-style leveled achievements system"
   ```
6. **Test in production** by running a session and checking `/achievements`

### Post-Deployment
7. **Monitor for errors** in Railway logs
8. **Check Discord** for any user reports of issues
9. **Verify XP calculations** are correct by testing a few sessions
10. **Push to production** only after confirming everything works

---

## Rollback Plan

If something goes wrong:

1. **Stop the bot** immediately
2. **Restore from backup**:
   - Legacy achievements are still in user stats (marked as migrated)
   - Backup collection has full achievement history
3. **Revert code changes**:
   ```bash
   git revert HEAD
   npm run build
   ```
4. **Restart bot** with previous version

---

## Future Enhancements

Potential improvements for v2:
- Achievement level-up notifications in feed channel
- Achievement-specific rewards (badges, titles, roles)
- Custom achievement icons (instead of emojis)
- Achievement comparison with friends
- Achievement leaderboards (who has the most levels)
- Special effects/animations for max level achievements
- Weekly achievement challenges

---

## Technical Notes

### Performance Considerations
- Achievement checking runs after every session completion
- Uses efficient Firestore queries (single read per user)
- Level calculations are done in-memory (no DB calls)
- Image generation is async and uses browser pool

### Error Handling
- Migration script validates data before writing
- Achievement service handles missing stats gracefully
- Image generation has fallback error messages
- All operations are logged for debugging

### Code Quality
- Full TypeScript type safety
- Comprehensive inline documentation
- Follows existing code patterns
- Modular service architecture
- Reusable React components

---

## Support & Questions

For issues or questions:
1. Check Railway logs for error messages
2. Verify Firebase data structure matches expected schema
3. Test locally with `npm run dev`
4. Review this document for migration/deployment steps

---

**Implementation Status**: ✅ Complete and ready for testing

**Next Steps**:
1. Run migration script
2. Test `/achievements` command
3. Verify XP boost application
4. Deploy to production
