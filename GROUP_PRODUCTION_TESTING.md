# Group Feature Production Testing Checklist

**Last Updated**: 2025-11-22
**Target Branch**: `groups`
**Pre-Deployment Status**: ⏳ PENDING VALIDATION

## Overview

This document provides a comprehensive testing checklist to validate all 6 critical group fixes before production deployment. All items must be checked off before pushing to production.

---

## 1. Pre-Deployment Checks

- [ ] All 6 critical fixes implemented and verified in code
  - [ ] Fix #1: Collision-resistant Group IDs (generateGroupId with retry logic)
  - [ ] Fix #2: Transaction-based join/leave operations
  - [ ] Fix #3: Transfer ownership type validation
  - [ ] Fix #4: Auto-cleanup when last member leaves
  - [ ] Fix #5: Group type exported from types.ts
  - [ ] Fix #6: Proper error handling in all group operations
- [ ] Build passes with 0 errors (`npm run build`)
- [ ] TypeScript types validate with strict mode
- [ ] No TODO/FIXME comments in group code
- [ ] All environment variables configured (Firebase credentials)
- [ ] Firebase indexes deployed (`firestore.indexes.json`)
- [ ] No fake/mock data in production code

---

## 2. Unit Testing (Manual)

### 2.1 Collision Detection

**Objective**: Verify the 6-character group ID system prevents collisions

- [ ] **Test 1**: Create 5 groups rapidly in succession
  - Expected: All groups receive unique IDs (GP-XXXXXX format)
  - Command sequence:
    ```
    /creategroup name:Test Group 1 public:true
    /creategroup name:Test Group 2 public:true
    /creategroup name:Test Group 3 public:true
    /creategroup name:Test Group 4 public:true
    /creategroup name:Test Group 5 public:true
    ```
  - Verify: All 5 IDs are different
  - Actual Result: _______________

- [ ] **Test 2**: Check server logs for collision retry attempts
  - Expected: No retry logs unless collision actually occurred
  - Look for: "Group ID collision detected, retrying..."
  - Actual Result: _______________

- [ ] **Test 3**: Create 20 groups and verify no duplicates
  - Expected: All 20 groups have unique IDs
  - Use script or manual creation
  - Actual Result: _______________

### 2.2 Transaction Safety

**Objective**: Verify Firestore transactions prevent race conditions

- [ ] **Test 1**: Two users join group with 1 slot remaining
  - Setup: Create group with maxMembers:5, add 4 members
  - Action: Have 2 users run `/joingroup` simultaneously
  - Expected: Only 1 user succeeds, other gets "Group is full" error
  - Actual Result: _______________

- [ ] **Test 2**: Join group while owner deletes it
  - Setup: Create group, have User A ready to join
  - Action: Owner runs `/deletegroup`, User A runs `/joingroup` immediately after
  - Expected: User A gets "Group not found" error, no orphaned membership
  - Actual Result: _______________

- [ ] **Test 3**: Kick member while they're leaving
  - Setup: Group with owner and 1 member
  - Action: Owner runs `/groupadmin kick @member`, member runs `/leavegroup` simultaneously
  - Expected: No errors, member removed cleanly, no duplicate operations
  - Actual Result: _______________

- [ ] **Test 4**: Two members leave simultaneously
  - Setup: Group with 3 members (owner + 2 others)
  - Action: Both non-owner members run `/leavegroup` at same time
  - Expected: Both leave successfully, memberCount decrements correctly to 1
  - Actual Result: _______________

### 2.3 Transfer Ownership

**Objective**: Verify ownership transfer works correctly with type safety

- [ ] **Test 1**: Owner transfers to existing member
  - Setup: Group with owner and 2 members
  - Action: `/groupadmin transfer @member1`
  - Expected:
    - member1 becomes owner (role: 'owner')
    - Original owner becomes member (role: 'member')
    - Both users' memberships update in Firestore
  - Verify in database: Check both membership documents
  - Actual Result: _______________

- [ ] **Test 2**: Try to transfer to non-member
  - Setup: Group with owner and 1 member
  - Action: `/groupadmin transfer @randomUser` (not in group)
  - Expected: Error message "User is not a member of this group"
  - Actual Result: _______________

- [ ] **Test 3**: Non-owner tries to transfer ownership
  - Setup: Group with owner and 2 members
  - Action: Member (not owner) runs `/groupadmin transfer @otherMember`
  - Expected: Error message "Only the group owner can transfer ownership"
  - Actual Result: _______________

- [ ] **Test 4**: After transfer, old owner can leave group
  - Setup: Complete Test 1 above
  - Action: Old owner runs `/leavegroup`
  - Expected: Old owner successfully leaves, new owner remains
  - Actual Result: _______________

- [ ] **Test 5**: Transfer ownership back and forth
  - Setup: Group with 2 members
  - Action:
    1. Owner A transfers to Member B
    2. New Owner B transfers back to Member A
  - Expected: Both transfers succeed, final state matches initial state
  - Actual Result: _______________

### 2.4 Auto-Cleanup

**Objective**: Verify groups are automatically deleted when last member leaves

- [ ] **Test 1**: Owner leaves group with only 1 member (themselves)
  - Setup: Create group, don't add anyone
  - Action: Owner runs `/leavegroup`
  - Expected:
    - Group document deleted from Firestore
    - Membership document deleted from Firestore
    - No orphaned data
  - Verify in Firebase Console: Check groups/{groupId} and groupMemberships/{userId}
  - Actual Result: _______________

- [ ] **Test 2**: Last remaining member (non-owner) leaves
  - Setup: Group with 2 members, owner leaves first (transfers ownership)
  - Action: Final member runs `/leavegroup`
  - Expected: Group and membership both deleted
  - Actual Result: _______________

- [ ] **Test 3**: Verify no orphaned memberships
  - Setup: Create group, add 3 members, all leave
  - Action: Check Firestore after all leave
  - Expected: Zero documents in groupMemberships subcollection for this group
  - Query: `groups/{groupId}/groupMemberships`
  - Actual Result: _______________

- [ ] **Test 4**: Verify group leaderboard updates
  - Setup: Create group, complete sessions for XP, then all members leave
  - Action: Run `/group_leaderboard`
  - Expected: Deleted group no longer appears in leaderboard
  - Actual Result: _______________

### 2.5 Type Safety

**Objective**: Verify TypeScript types are properly exported and used

- [ ] **Test 1**: Import Group type in new file
  - Action: Create test file with `import { Group } from './types'`
  - Expected: No TypeScript errors, autocomplete works
  - Actual Result: _______________

- [ ] **Test 2**: No type errors in group commands
  - Action: Run `npm run build` or check IDE
  - Expected: Zero TypeScript errors in src/commands/group*.ts
  - Actual Result: _______________

- [ ] **Test 3**: IDE autocomplete for Group fields
  - Action: Type `group.` in VSCode/IDE
  - Expected: Autocomplete shows all Group interface fields
  - Fields should include: id, name, description, isPublic, ownerId, memberCount, etc.
  - Actual Result: _______________

- [ ] **Test 4**: Type checking prevents invalid data
  - Action: Try to assign wrong type to Group field (e.g., `group.memberCount = "5"`)
  - Expected: TypeScript error before runtime
  - Actual Result: _______________

---

## 3. Integration Testing

### 3.1 End-to-End Flows

- [ ] **Flow 1**: Complete group lifecycle with XP bonus
  1. User A: `/creategroup name:Study Squad public:true`
  2. User B: `/joingroup group_id:GP-XXXXXX`
  3. User A: `/start`
  4. Wait 5 minutes
  5. User A: `/stop`
  6. Expected: XP bonus applied (check with `/stats`)
  - Actual Result: _______________

- [ ] **Flow 2**: Create, join, leave, cleanup
  1. User A: `/creategroup name:Temp Group public:true`
  2. User B: `/joingroup group_id:GP-XXXXXX`
  3. User B: `/leavegroup`
  4. User A: `/leavegroup`
  5. Expected: Group deleted, both memberships removed
  - Actual Result: _______________

- [ ] **Flow 3**: Join full group (should fail)
  1. Create group with maxMembers:2
  2. Add 2nd member
  3. User C tries to join
  4. Expected: Error "This group is full (2/2 members)"
  - Actual Result: _______________

- [ ] **Flow 4**: Join private group (should fail)
  1. User A: `/creategroup name:Private Group public:false`
  2. User B: `/joingroup group_id:GP-XXXXXX`
  3. Expected: Error "This group is private. Ask the owner to invite you."
  - Actual Result: _______________

- [ ] **Flow 5**: Owner deletes group with members
  1. Create group with 3 members
  2. Owner: `/deletegroup`
  3. Expected:
    - All 3 memberships deleted
    - Group document deleted
    - Other members see group removed from `/group`
  - Actual Result: _______________

### 3.2 Edge Cases

- [ ] **Edge 1**: Create 100 groups sequentially
  - Action: Script or manual creation of 100 groups
  - Expected: All groups get unique IDs, no collisions
  - Check: Query Firestore for duplicate IDs
  - Actual Result: _______________

- [ ] **Edge 2**: Group at exactly max capacity (5/5 members)
  - Setup: Create group, add 4 members (5 total with owner)
  - Action: Try to join as 6th member
  - Expected: Clear error message about group being full
  - Actual Result: _______________

- [ ] **Edge 3**: Rapid join/leave cycles
  - Setup: Create group
  - Action: User joins, leaves, joins, leaves (repeat 5 times)
  - Expected: No errors, memberCount always accurate
  - Actual Result: _______________

- [ ] **Edge 4**: Group with special characters in name
  - Action: `/creategroup name:Test!@#$%^&*() public:true`
  - Expected: Group created successfully, name displayed correctly
  - Actual Result: _______________

- [ ] **Edge 5**: Very long group descriptions
  - Action: Create group with 500+ character description
  - Expected: Truncation or validation error with helpful message
  - Actual Result: _______________

---

## 4. Performance Testing

- [ ] **Perf 1**: Group creation speed
  - Action: Create single group, measure time
  - Expected: < 2 seconds from command to success message
  - Actual: _______ seconds

- [ ] **Perf 2**: Join group speed
  - Action: Join existing group, measure time
  - Expected: < 1 second from command to confirmation
  - Actual: _______ seconds

- [ ] **Perf 3**: Group leaderboard with 50 groups
  - Setup: Create 50 groups with varying XP
  - Action: Run `/group_leaderboard`
  - Expected: < 3 seconds to display leaderboard
  - Actual: _______ seconds

- [ ] **Perf 4**: No timeout errors under normal load
  - Action: Execute 10 group commands in rapid succession
  - Expected: All commands complete without Discord timeout (3s limit)
  - Actual Result: _______________

- [ ] **Perf 5**: Database query optimization
  - Action: Check Firebase Console for query counts
  - Expected: Each command uses minimal reads (< 5 per operation)
  - Actual: _______ reads per operation

---

## 5. Error Handling

- [ ] **Error 1**: User-friendly messages (no stack traces)
  - Action: Trigger various errors (full group, not found, etc.)
  - Expected: Clean error messages, no technical details exposed
  - Actual Result: _______________

- [ ] **Error 2**: Errors logged properly
  - Action: Check server logs after triggering errors
  - Expected: Full stack traces in logs, helpful context
  - Actual Result: _______________

- [ ] **Error 3**: Graceful degradation - Firebase connection issue
  - Action: Temporarily disable Firebase credentials
  - Expected: User sees "Database temporarily unavailable" message
  - Actual Result: _______________

- [ ] **Error 4**: Invalid group ID format
  - Action: `/joingroup group_id:INVALID`
  - Expected: Clear error about invalid format or group not found
  - Actual Result: _______________

- [ ] **Error 5**: Discord API errors (rate limiting)
  - Action: Trigger rate limit (many rapid commands)
  - Expected: Bot queues requests or shows "Please wait" message
  - Actual Result: _______________

---

## 6. Data Integrity

- [ ] **Integrity 1**: No orphaned groups in database
  - Action: After all tests, query Firestore for groups with 0 members
  - Expected: Zero groups with memberCount:0 (except newly created)
  - Query: `groups where memberCount == 0`
  - Actual Result: _______________

- [ ] **Integrity 2**: No orphaned memberships
  - Action: Check for memberships pointing to deleted groups
  - Expected: All groupMemberships have valid parent group
  - Actual Result: _______________

- [ ] **Integrity 3**: memberCount matches actual members
  - Action: For 10 random groups, count memberships and compare to memberCount
  - Expected: 100% match rate
  - Sample groups:
    1. Group 1: memberCount=___ vs actual=___
    2. Group 2: memberCount=___ vs actual=___
    3. Group 3: memberCount=___ vs actual=___
  - Actual Result: _______________

- [ ] **Integrity 4**: totalHours matches sum of member hours
  - Action: Pick group with completed sessions, verify totalHours calculation
  - Expected: totalHours = sum of all member contributions
  - Actual Result: _______________

- [ ] **Integrity 5**: Only one owner per group
  - Action: Query all groups and check membership roles
  - Expected: Each group has exactly 1 member with role:'owner'
  - Actual Result: _______________

---

## 7. Command Test Scenarios

### 7.1 Create Group Command

```bash
# Basic creation
/creategroup name:Study Squad description:Daily study sessions public:true

# Private group
/creategroup name:Private Club description:Invite only public:false

# With custom max members
/creategroup name:Small Group description:Just us public:true max_members:3

# Edge case - minimal info
/creategroup name:Test public:true
```

**Expected Results**:
- Unique group ID generated (GP-XXXXXX)
- Owner automatically added as member
- memberCount starts at 1
- Confirmation message with group ID

### 7.2 Join Group Command

```bash
# Join public group
/joingroup group_id:GP-ABC123

# Try join full group
/joingroup group_id:GP-FULL01

# Try join private group
/joingroup group_id:GP-PRVT01

# Try join non-existent group
/joingroup group_id:GP-FAKE00
```

**Expected Results**:
- Public join succeeds, memberCount increments
- Full group shows clear error
- Private group shows permission error
- Non-existent shows not found error

### 7.3 Group Overview Command

```bash
# View your group
/group

# When not in a group
/group
```

**Expected Results**:
- Shows group info, members, stats
- Not in group: "You're not in a group yet"

### 7.4 Group Admin Command

```bash
# Transfer ownership
/groupadmin transfer @newowner

# Kick member
/groupadmin kick @badmember

# Non-owner tries admin command
/groupadmin transfer @someone  # (run as non-owner)
```

**Expected Results**:
- Transfer updates both memberships
- Kick removes member, decrements count
- Non-owner gets permission error

### 7.5 Leave Group Command

```bash
# Regular member leaves
/leavegroup

# Owner leaves (with other members) - should transfer first
/leavegroup

# Last member leaves (auto-cleanup)
/leavegroup
```

**Expected Results**:
- Member removed, count decrements
- Owner can't leave without transferring if others present
- Last member triggers group deletion

### 7.6 Group Leaderboard Command

```bash
# View leaderboard
/group_leaderboard

# After groups have XP/hours
/group_leaderboard
```

**Expected Results**:
- Shows ranked list of groups
- Displays member count, total hours, XP
- Updates in real-time as groups change

---

## 8. Production Deployment Checklist

**CRITICAL: Complete ALL items before pushing to production**

- [ ] All tests in sections 1-7 passed
- [ ] Code reviewed by team member (if applicable)
- [ ] Firebase indexes deployed and active
- [ ] Environment variables verified in production environment
- [ ] Railway build succeeds without warnings
- [ ] Database backup created (export Firestore data)
- [ ] Rollback plan documented
- [ ] Monitoring/alerting configured (Firebase Console, Railway logs)
- [ ] User communication prepared (if downtime expected)
- [ ] **Explicit user confirmation obtained for deployment**

---

## 9. Post-Deployment Validation

**Run immediately after production deployment:**

- [ ] Bot comes online successfully
- [ ] Create test group in production server
- [ ] Join/leave operations work
- [ ] No errors in Railway logs
- [ ] Firebase quota usage normal
- [ ] Discord slash commands registered correctly
- [ ] Monitor for 24 hours for unexpected issues

---

## 10. Known Issues & Workarounds

Document any issues discovered during testing:

| Issue | Severity | Workaround | Fix ETA |
|-------|----------|------------|---------|
| Example: Slow leaderboard with 100+ groups | Low | Pagination planned | TBD |
|  |  |  |  |
|  |  |  |  |

---

## 11. Test Results Summary

**Testing Date**: _______________
**Tested By**: _______________
**Total Tests**: 80+
**Tests Passed**: ___ / 80+
**Tests Failed**: ___
**Blockers**: _______________

**Ready for Production?** ⬜ YES / ⬜ NO

**Sign-off**:
- Developer: _______________ (Date: _______)
- Reviewer: _______________ (Date: _______)

---

## Appendix A: Quick Test Script

For rapid validation, run these commands in sequence:

```bash
# 1. Create group
/creategroup name:QA Test Group public:true

# 2. Note group ID, then join with second user
/joingroup group_id:GP-XXXXXX

# 3. Check group overview
/group

# 4. Transfer ownership
/groupadmin transfer @seconduser

# 5. First user leaves
/leavegroup

# 6. Second user leaves (triggers cleanup)
/leavegroup

# 7. Verify group deleted
/group  # Should show "not in a group"
```

**Expected**: All operations succeed with no errors.

---

## Appendix B: Firebase Queries for Validation

```javascript
// Check for orphaned groups (0 members)
db.collection('groups')
  .where('memberCount', '==', 0)
  .get()

// Check for duplicate group IDs
db.collection('groups')
  .get()
  .then(snapshot => {
    const ids = snapshot.docs.map(doc => doc.data().id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    console.log('Duplicates:', duplicates);
  })

// Count total groups
db.collection('groups').get().then(s => console.log('Total groups:', s.size))

// Count total memberships
db.collectionGroup('groupMemberships').get().then(s => console.log('Total memberships:', s.size))
```

---

## Appendix C: Rollback Procedure

If critical issues found in production:

1. Immediately revert to previous working commit: `git revert HEAD`
2. Push revert: `git push origin main`
3. Railway auto-deploys previous version
4. Verify bot stability
5. Document issue in Known Issues section
6. Fix in development branch, re-test completely

---

**END OF CHECKLIST**
