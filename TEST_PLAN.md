# Test Plan: Start/Stop Command Redesign

## Overview
Testing plan for the major redesign of session management commands.

## Phase 1: Core Command Redesign

### `/start` Command Tests

#### Test Case 1.1: Open-ended session (no timer)
- **Command**: `/start`
- **Expected**:
  - Creates active session without activity field
  - Posts "You're live!" to feed (no activity shown)
  - Returns ephemeral confirmation
  - No timer set
- **Verify**:
  - Active session exists in DB
  - Feed post displays correctly
  - No activity field in session data

#### Test Case 1.2: Timed session with hours
- **Command**: `/start hours:2`
- **Expected**:
  - Creates active session
  - Posts timed session to feed showing "2 hours"
  - Sets timer for 2 hours
  - DM sent when timer completes
- **Verify**:
  - Timer scheduled correctly
  - Feed shows duration
  - Auto-post triggers after timer

#### Test Case 1.3: Timed session with minutes
- **Command**: `/start minutes:30`
- **Expected**:
  - Creates active session
  - Posts timed session showing "30 minutes"
  - Sets timer for 30 minutes
- **Verify**:
  - Duration converted correctly (1800 seconds)
  - Feed post accurate

#### Test Case 1.4: Fractional hours
- **Command**: `/start hours:1.5`
- **Expected**:
  - Creates 1.5 hour (90 min) session
  - Feed shows "1.5 hours"
- **Verify**:
  - Duration = 5400 seconds
  - Display formatting correct

#### Test Case 1.5: Cannot start multiple sessions
- **Setup**: User already has active session
- **Command**: `/start`
- **Expected**:
  - Error message
  - No new session created
- **Verify**:
  - Only one active session exists

#### Test Case 1.6: Cannot start if timer running
- **Setup**: User has active timer
- **Command**: `/start hours:1`
- **Expected**:
  - Error message
  - Suggests `/stop` first

### `/stop` Command Tests

#### Test Case 2.1: Stop with new activity field
- **Setup**: Active session exists
- **Command**: `/stop`
- **Expected**:
  - Modal shows with 4 fields:
    - Title
    - Description
    - Activity (NEW)
    - Intensity
- **Verify**:
  - Modal displays correctly
  - Activity field is present and required

#### Test Case 2.2: Complete session with activity
- **Setup**: Fill modal with all fields
- **Expected**:
  - Session saved with activity
  - Feed post shows activity
  - XP calculated correctly
- **Verify**:
  - CompletedSession has activity field
  - Feed image includes activity
  - Stats updated

#### Test Case 2.3: Stop without active session
- **Command**: `/stop`
- **Expected**:
  - Error message
  - No modal shown

### Feed Display Tests

#### Test Case 3.1: Open-ended session start
- **Verify**:
  - Shows username + "Live" indicator
  - No activity text shown
  - Green theme
  - Correct dimensions (500x140px)

#### Test Case 3.2: Timed session start
- **Verify**:
  - Shows username + duration
  - "started a X hours focus session"
  - Timer icon
  - Live indicator

#### Test Case 3.3: Completed session post
- **Verify**:
  - Shows activity prominently
  - Title and description visible
  - Duration, XP, intensity shown
  - Edit button appears for post creator only

## Phase 2: Edit Feature

### Edit Button Tests

#### Test Case 4.1: Edit button visibility
- **Verify**:
  - Button visible to post creator
  - Button NOT visible to other users
  - Button persists (doesn't disappear)

#### Test Case 4.2: Edit modal pre-fill
- **Action**: Click edit button
- **Expected**:
  - Modal opens with current values
  - All fields editable:
    - Title (pre-filled)
    - Description (pre-filled)
    - Activity (pre-filled)
    - Duration (pre-filled in hours format)
    - Intensity (pre-filled)
- **Verify**:
  - Values match current session data
  - Can modify all fields

#### Test Case 4.3: Edit session data
- **Setup**: Submit edit modal with changes
- **Expected**:
  - Session data updated in DB
  - Feed image regenerated
  - XP recalculated
  - Edit indicator added "(edited)"
- **Verify**:
  - Database updated
  - New image posted (replaces old)
  - XP delta calculated correctly
  - User stats adjusted

#### Test Case 4.4: Edit duration calculation
- **Original**: 2 hours (7200s) at intensity 3 = X XP
- **Edit to**: 3 hours (10800s) at intensity 4 = Y XP
- **Expected**:
  - XP difference = Y - X
  - User stats.xp += (Y - X)
  - User level recalculated if needed
- **Verify**:
  - XP math correct
  - No duplicate XP awards
  - Stats consistent

#### Test Case 4.5: Edit with group XP bonus
- **Setup**: User in group with level 10 (10% bonus)
- **Action**: Edit session duration
- **Expected**:
  - New XP calculated with current group bonus
  - Group stats updated
- **Verify**:
  - Bonus applied correctly
  - Group total hours updated

#### Test Case 4.6: Cannot edit others' sessions
- **Setup**: User A tries to edit User B's post
- **Expected**:
  - Edit button not visible
  - Direct modal call fails
- **Verify**:
  - Authorization check works

### Edge Cases

#### Test Case 5.1: Edit deleted session
- **Setup**: Session deleted from DB
- **Action**: Try to edit
- **Expected**:
  - Error message
  - No changes made

#### Test Case 5.2: Concurrent edits
- **Setup**: User edits twice rapidly
- **Expected**:
  - Second edit uses latest data
  - No race conditions
- **Verify**:
  - Final state is consistent

#### Test Case 5.3: Invalid duration edit
- **Setup**: Try to set duration to 0 or negative
- **Expected**:
  - Validation error
  - No changes saved

#### Test Case 5.4: Timer session edit
- **Setup**: Edit a session created via timer
- **Expected**:
  - Edit works normally
  - Timer metadata preserved

## Backward Compatibility Tests

#### Test Case 6.1: Existing active sessions
- **Setup**: Sessions created with old /start (have activity)
- **Action**: Run /stop
- **Expected**:
  - Stop works normally
  - Activity field optional or pre-filled
- **Verify**:
  - No crashes
  - Data migrated correctly

#### Test Case 6.2: Old completed sessions
- **Setup**: Sessions without activity field
- **Expected**:
  - Display correctly
  - Edit button works (activity optional)
- **Verify**:
  - No errors on missing fields

## Performance Tests

#### Test Case 7.1: Edit image regeneration speed
- **Expected**: < 3 seconds
- **Verify**: No timeout issues

#### Test Case 7.2: Multiple edits in succession
- **Action**: Edit same post 5 times quickly
- **Expected**: All process successfully
- **Verify**: No memory leaks

## Integration Tests

#### Test Case 8.1: Full user journey (open-ended)
1. `/start`
2. Wait 10 minutes
3. `/stop` with all fields
4. Click edit button
5. Modify duration and intensity
6. Verify final state

#### Test Case 8.2: Full user journey (timed)
1. `/start hours:1`
2. Wait for timer (or cancel)
3. Edit via DM button or /stop
4. Submit completion
5. Edit post
6. Verify final state

#### Test Case 8.3: Streak preservation
- **Setup**: User has 5-day streak
- **Action**: Complete session, edit duration to 0
- **Expected**: Streak not broken
- **Verify**: Streak logic handles edits

## Migration Tests

#### Test Case 9.1: Database schema compatibility
- **Verify**:
  - New activity field added to CompletedSession
  - Old sessions still readable
  - Indexes updated if needed

#### Test Case 9.2: Feed post format migration
- **Verify**:
  - Old posts display correctly
  - New posts use new format
  - No visual regressions

## Manual Test Checklist

- [ ] Test on mobile Discord app
- [ ] Test on desktop Discord app
- [ ] Test on web Discord
- [ ] Test with poor network connection
- [ ] Test with long usernames
- [ ] Test with special characters in fields
- [ ] Test with emoji in activity/description
- [ ] Test permissions (admin vs normal user)
- [ ] Test in multiple servers simultaneously
- [ ] Test DMs blocked (timer notifications)

## Rollback Plan

If critical issues found:
1. Revert /start command changes
2. Restore activity field requirement
3. Disable edit buttons
4. Deploy hotfix
5. Investigate issues in dev environment

## Success Criteria

- [ ] All automated tests pass
- [ ] Manual testing complete
- [ ] No data corruption
- [ ] Performance acceptable
- [ ] User feedback positive
- [ ] No critical bugs in 24h post-deploy
