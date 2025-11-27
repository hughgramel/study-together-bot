/**
 * Level Roles Service
 *
 * Manages automatic role assignment based on user levels. Handles configuration,
 * role syncing, and automatic role updates when users level up.
 */

import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { Client, Guild, GuildMember, Role } from 'discord.js';
import { ServerConfig, LevelRoleConfig } from '../types';
import { createLogger } from '../utils/logger';
import { calculateLevel } from '../utils/xp';

const logger = createLogger('LevelRoles');

/**
 * Get level role configuration for a server
 */
export async function getLevelRoleConfig(
  db: Firestore,
  serverId: string
): Promise<LevelRoleConfig[]> {
  const configDoc = await db
    .collection('discord-data')
    .doc('serverConfig')
    .collection('configs')
    .doc(serverId)
    .get();

  const config = configDoc.data() as ServerConfig | undefined;
  return config?.levelRoles || [];
}

/**
 * Set level role configuration for a server
 */
export async function setLevelRoleConfig(
  db: Firestore,
  serverId: string,
  setupBy: string,
  levelRoles: LevelRoleConfig[]
): Promise<void> {
  // Sort by level descending so higher levels are checked first
  const sortedRoles = [...levelRoles].sort((a, b) => b.level - a.level);

  await db
    .collection('discord-data')
    .doc('serverConfig')
    .collection('configs')
    .doc(serverId)
    .set(
      {
        levelRoles: sortedRoles,
        setupAt: Timestamp.now(),
        setupBy,
      },
      { merge: true }
    );

  logger.info(
    `Level role config updated for server ${serverId}: ${sortedRoles.length} roles`
  );
}

/**
 * Get the appropriate role for a user's level
 * Returns the highest level role the user qualifies for
 */
export function getRoleForLevel(
  level: number,
  levelRoles: LevelRoleConfig[]
): LevelRoleConfig | null {
  // levelRoles should already be sorted by level descending
  for (const roleConfig of levelRoles) {
    if (level >= roleConfig.level) {
      return roleConfig;
    }
  }
  return null;
}

/**
 * Sync roles for a single user based on their current level
 */
export async function syncUserRoles(
  db: Firestore,
  client: Client,
  serverId: string,
  userId: string,
  userXp: number,
  dryRun: boolean = false
): Promise<{ added?: string; removed: string[] }> {
  const guild = await client.guilds.fetch(serverId);
  if (!guild) {
    throw new Error('Guild not found');
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    logger.warn(`User ${userId} not found in guild ${serverId}`);
    return { removed: [] };
  }

  const levelRoles = await getLevelRoleConfig(db, serverId);
  if (levelRoles.length === 0) {
    return { removed: [] };
  }

  const userLevel = calculateLevel(userXp);
  const targetRole = getRoleForLevel(userLevel, levelRoles);

  const changes = { added: undefined as string | undefined, removed: [] as string[] };

  // Remove all level-based roles
  const roleIdsToRemove = levelRoles.map((r) => r.roleId);
  for (const roleId of roleIdsToRemove) {
    if (member.roles.cache.has(roleId)) {
      if (!dryRun) {
        await member.roles.remove(roleId).catch((err) => {
          logger.error(`Failed to remove role ${roleId} from user ${userId}`, err);
        });
      }
      changes.removed.push(roleId);
    }
  }

  // Add the appropriate role for their level
  if (targetRole) {
    if (!dryRun) {
      await member.roles.add(targetRole.roleId).catch((err) => {
        logger.error(
          `Failed to add role ${targetRole.roleId} to user ${userId}`,
          err
        );
      });
    }
    changes.added = targetRole.roleId;
    // Remove from removed list if it was there
    changes.removed = changes.removed.filter((id) => id !== targetRole.roleId);
  }

  return changes;
}

/**
 * Sync roles for all users in a server
 */
export async function syncAllRoles(
  db: Firestore,
  client: Client,
  serverId: string,
  onProgress?: (current: number, total: number, username: string) => void,
  dryRun: boolean = false
): Promise<{
  total: number;
  synced: number;
  errors: number;
  details: Array<{ userId: string; username: string; error?: string }>;
  changes?: Array<{
    userId: string;
    username: string;
    roleAdded?: string;
    rolesRemoved: string[];
  }>;
}> {
  const guild = await client.guilds.fetch(serverId);
  if (!guild) {
    throw new Error('Guild not found');
  }

  const levelRoles = await getLevelRoleConfig(db, serverId);
  if (levelRoles.length === 0) {
    throw new Error('No level roles configured. Use /setup-level-roles first.');
  }

  // Fetch all members from Discord
  await guild.members.fetch();
  const members = Array.from(guild.members.cache.values());

  // Fetch all user stats from Firebase
  const statsSnapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .get();

  const userStatsMap = new Map<string, number>();
  statsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    userStatsMap.set(doc.id, data.xp || 0);
  });

  const results = {
    total: members.length,
    synced: 0,
    errors: 0,
    details: [] as Array<{ userId: string; username: string; error?: string }>,
    changes: [] as Array<{
      userId: string;
      username: string;
      roleAdded?: string;
      rolesRemoved: string[];
    }>,
  };

  for (let i = 0; i < members.length; i++) {
    const member = members[i];

    if (onProgress) {
      onProgress(i + 1, members.length, member.user.username);
    }

    // Skip bots
    if (member.user.bot) {
      continue;
    }

    try {
      const userXp = userStatsMap.get(member.id) || 0;
      const roleChanges = await syncUserRoles(db, client, serverId, member.id, userXp, dryRun);
      results.synced++;
      results.details.push({
        userId: member.id,
        username: member.user.username,
      });

      // Track changes for dry-run preview
      if (dryRun && (roleChanges.added || roleChanges.removed.length > 0)) {
        results.changes.push({
          userId: member.id,
          username: member.user.username,
          roleAdded: roleChanges.added,
          rolesRemoved: roleChanges.removed,
        });
      }
    } catch (error) {
      results.errors++;
      results.details.push({
        userId: member.id,
        username: member.user.username,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      logger.error(`Failed to sync roles for user ${member.id}`, error);
    }
  }

  logger.info(
    `Role sync${dryRun ? ' (DRY RUN)' : ''} completed: ${results.synced} synced, ${results.errors} errors`
  );

  return results;
}

/**
 * Check and update roles when a user levels up
 * Called after XP is awarded and level changes
 */
export async function checkLevelUpRoles(
  db: Firestore,
  client: Client,
  serverId: string,
  userId: string,
  oldLevel: number,
  newLevel: number,
  newXp: number
): Promise<{ roleAdded?: string; rolesRemoved: string[] }> {
  if (oldLevel === newLevel) {
    return { rolesRemoved: [] };
  }

  logger.info(`User ${userId} leveled up: ${oldLevel} -> ${newLevel}`);

  try {
    const changes = await syncUserRoles(db, client, serverId, userId, newXp);
    return { roleAdded: changes.added, rolesRemoved: changes.removed };
  } catch (error) {
    logger.error(`Failed to update roles for user ${userId} level up`, error);
    return { rolesRemoved: [] };
  }
}
