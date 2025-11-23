# Group ID Migration Guide

## Overview

This migration removes the redundant "GP-" prefix from all group IDs in the database.

**Before:** `GP-A1B2`
**After:** `A1B2`

## What Gets Updated

1. **Group documents** (`discord-data/groups/active/{groupId}`)
   - The document ID changes from `GP-XXXX` to `XXXX`
   - The `groupId` field is updated to the new format

2. **Group membership documents** (`discord-data/groupMembers/memberships/{userId}`)
   - The `groupId` field is updated to match the new group ID

## Running the Migration

### Prerequisites

- Node.js 18+ installed
- Firebase service account credentials configured
- Database backup (recommended)

### Steps

1. **Backup your database** (highly recommended)
   ```bash
   # Use Firebase Console or gcloud CLI to create a backup
   ```

2. **Set environment variables**
   ```bash
   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   ```

   Or place your `service-account.json` in the project root.

3. **Run the migration**
   ```bash
   npm run migrate-group-ids
   ```

4. **Verify the migration**
   - Check the console output for success/error messages
   - Verify groups in Firebase Console
   - Test group commands in Discord (`/group`, `/joingroup`, etc.)

## Migration Process

The script performs these operations **for each group**:

1. ✅ Fetch all groups with `GP-` prefix
2. ✅ Create new group document with updated ID
3. ✅ Update all memberships pointing to this group
4. ✅ Delete old group document
5. ✅ Log progress and errors

## Safety Features

- **Idempotent**: Safe to run multiple times (skips already-migrated groups)
- **Batched operations**: Handles large datasets efficiently
- **Error handling**: Continues on errors and reports them at the end
- **Detailed logging**: Shows progress for each group

## Example Output

```
🔄 Starting group ID migration...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Fetching all groups...
Found 3 groups to migrate

🔧 Migrating group: GP-A1B2 -> A1B2
  📝 Updating memberships for GP-A1B2...
    Found 5 memberships
    💾 Committed final batch of 5 memberships
  ✅ Deleted old group document: GP-A1B2

🔧 Migrating group: GP-X9Y4 -> X9Y4
  📝 Updating memberships for GP-X9Y4...
    Found 3 memberships
    💾 Committed final batch of 3 memberships
  ✅ Deleted old group document: GP-X9Y4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Migration complete!

📊 Stats:
  Groups updated: 2
  Memberships updated: 8
  Errors: 0

✅ Migration script completed
```

## Rollback

If you need to rollback:

1. Restore from your database backup
2. Revert code changes to use `GP-` prefix again

## Post-Migration

After successful migration:

1. ✅ New groups will be created with 4-character IDs (e.g., `A1B2`)
2. ✅ All existing groups will have updated IDs
3. ✅ All commands will work with the new ID format
4. ✅ User experience remains the same (they see the same group IDs, just shorter)

## Troubleshooting

### "Migration failed" errors
- Check Firebase credentials are valid
- Verify network connection to Firebase
- Check console output for specific error messages

### Partial migration
- The script is idempotent - you can safely re-run it
- Already-migrated groups will be skipped

### Test data
- If you have test groups with old IDs, re-run the migration script
- Or manually delete them from Firebase Console

## Support

For issues or questions:
1. Check the console output for error details
2. Verify Firebase Console shows updated documents
3. Test commands in Discord to ensure everything works
