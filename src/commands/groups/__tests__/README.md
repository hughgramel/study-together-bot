# Group Commands Test Suite

Comprehensive test suite for all group-related Discord commands.

## Test Files

### Unit Tests

#### 1. `creategroup.test.ts`
Tests for the `/creategroup` command.

**Test Cases:**
- Successfully creates public group
- Successfully creates private group
- Defaults to public when isPublic not specified
- Fails if user already in a group
- Validates group name length (max 50 characters)
- Fails if not in a guild (DM usage)
- Creates unique group IDs (GP-XXXX format)
- Command has correct name
- Sets maxMembers to 5

**Run:** `npm run test:creategroup`

---

#### 2. `joingroup.test.ts`
Tests for the `/joingroup` command.

**Test Cases:**
- Successfully joins public group
- Fails to join private group
- Fails if group is full (at max capacity)
- Fails if user already in a group
- Fails if group doesn't exist
- Fails if not in a guild (DM usage)
- Fails if group belongs to different server
- Command has correct name
- Converts group ID to uppercase

**Run:** `npm run test:joingroup`

---

#### 3. `leavegroup.test.ts`
Tests for the `/leavegroup` command.

**Test Cases:**
- Non-owner successfully leaves group
- Owner fails to leave (must transfer ownership first)
- Group auto-deletes when last member leaves
- Fails if user not in a group
- Command has correct name
- Cleans up orphaned membership if group was deleted
- Multiple members can leave sequentially

**Run:** `npm run test:leavegroup`

---

#### 4. `groupadmin.test.ts`
Tests for the `/groupadmin` command (delete, kick, transfer subcommands).

**Test Cases:**

**DELETE subcommand:**
- Owner can initiate delete with confirmation
- Non-owner cannot delete group

**KICK subcommand:**
- Owner can kick member from group
- Owner cannot kick themselves
- Only owner can kick members

**TRANSFER subcommand:**
- Owner can transfer ownership to member
- Cannot transfer to non-member
- Cannot transfer to self
- Command has correct name and subcommands

**Run:** `npm run test:groupadmin`

---

#### 5. `group.test.ts`
Tests for the `/group` command (display group overview).

**Test Cases:**
- Displays group info for member
- Shows error if user not in group
- Fails if not in a guild (DM usage)
- Can view another user's group
- Calculates XP bonus correctly (1% per level, capped at 50%)
- Shows correct level based on total hours (25 hours per level)
- Command has correct name
- Handles missing group gracefully
- Calculates group rank based on level

**Run:** `npm run test:group`

---

### Integration Tests

#### `groups.integration.test.ts`
Full workflow tests that span multiple commands and operations.

**Workflows:**

1. **Create → Join → Complete Session → Verify XP Bonus**
   - Create group
   - User joins
   - Members complete sessions
   - Group stats update
   - XP bonus calculated correctly

2. **Create → Leave → Verify Cleanup**
   - Create group with 3 members
   - Non-owners leave
   - Last member leaves
   - Group auto-deletes
   - All memberships cleaned up

3. **Create → Transfer Ownership → Original Owner Leaves**
   - Create group with 2 members
   - Transfer ownership
   - Original owner leaves as member
   - Group persists with new owner

4. **Full Group Lifecycle**
   - Create group with max 3 members
   - Fill to capacity
   - Attempt to add 4th member (fails)
   - Members leave one by one
   - Group auto-deletes when empty

5. **Group Deletion (Batch)**
   - Create group with 5 members
   - Delete group
   - All memberships deleted in batch

6. **Public Group Discovery**
   - Create multiple public and private groups
   - Fetch public groups only
   - Results sorted by level (desc)

7. **Level Progression & XP Scaling**
   - Test level calculation at various hour thresholds
   - Verify XP bonus scaling
   - Test XP cap at 50%

**Run:** `npm run test:groups:integration`

---

## Running Tests

### Run All Group Tests
```bash
npm run test:groups:all
```

### Run Unit Tests Only
```bash
npm run test:groups
```

### Run Integration Tests Only
```bash
npm run test:groups:integration
```

### Run Individual Test Files
```bash
npm run test:creategroup
npm run test:joingroup
npm run test:leavegroup
npm run test:groupadmin
npm run test:group
```

## Test Coverage

### Commands Tested
- `/creategroup` - Create a new study group
- `/joingroup` - Join an existing public group
- `/leavegroup` - Leave current group
- `/groupadmin delete` - Delete group (owner only)
- `/groupadmin kick` - Kick member (owner only)
- `/groupadmin transfer` - Transfer ownership
- `/group` - View group overview

### Services Tested
- `GroupService.createGroup()`
- `GroupService.addMemberToGroup()`
- `GroupService.removeMemberFromGroup()`
- `GroupService.deleteGroup()`
- `GroupService.transferOwnership()`
- `GroupService.getUserGroup()`
- `GroupService.getGroup()`
- `GroupService.updateGroupStats()`
- `GroupService.getPublicGroups()`
- `GroupService.hasSpaceAvailable()`
- `GroupService.calculateGroupLevel()`
- `GroupService.calculateXpModifier()`

### Edge Cases Tested
- User already in group
- Group at max capacity
- Private vs public groups
- Cross-server group access
- Orphaned memberships
- Auto-deletion when empty
- Concurrent operations (transactions)
- Batch operations (500+ members)
- ID collision detection
- Case sensitivity (group IDs)

## Test Statistics

| Test File | Test Cases | Lines of Code |
|-----------|-----------|---------------|
| creategroup.test.ts | 9 | ~430 |
| joingroup.test.ts | 9 | ~540 |
| leavegroup.test.ts | 7 | ~460 |
| groupadmin.test.ts | 9 | ~690 |
| group.test.ts | 9 | ~560 |
| groups.integration.test.ts | 7 workflows | ~730 |
| **TOTAL** | **50+** | **~3,410** |

## Architecture

### Mock Firestore
All tests use a custom `MockFirestore` class that simulates Firestore operations:
- Document reads/writes
- Transactions (atomic operations)
- Batched operations
- Queries with filters and ordering
- Subcollections

### Mock Interactions
Tests use mock Discord interactions that simulate:
- User information
- Command options
- Guild context
- Reply/edit operations
- Components (buttons)

## Key Formulas Tested

### Group Level Calculation
```typescript
level = Math.floor(totalHours / 25) + 1
```

### XP Modifier Calculation
```typescript
xpModifier = Math.min(0.5, groupLevel * 0.01)
// 1% per level, capped at 50%
```

## Future Enhancements

Potential additions to the test suite:
- Performance benchmarks
- Stress tests (1000+ groups)
- Concurrent user operations
- Database migration tests
- Backup/restore tests
- API rate limiting tests
