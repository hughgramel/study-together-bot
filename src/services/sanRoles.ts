/**
 * San Roles Service
 *
 * Manages the "san-level" role hierarchy — 17 Discord roles whose names and
 * colours are relative to the current top-XP user ("san").
 *
 * Tier order (highest → lowest XP threshold):
 *   san+   > san  > 1/2 san > 1/3 san > … > 1/16 san
 *
 * Colors: OKLCH L=0.4, H evenly spaced across 360°.
 * Chroma: 0.10 for hues near sRGB primaries (red ≈29°, green ≈142°, blue ≈264°,
 *         within 35°) to avoid gamut clipping; 0.15 everywhere else.
 */

import { Client, Guild } from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { ServerConfig, SanRoleConfig } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('SanRoles');

// ─── Tier definitions ─────────────────────────────────────────────────────────

export interface SanTier {
  name: string;       // Display name / role name
  /** Minimum ratio of san's XP required. 0 = always applies as fallback. */
  minRatio: number;
  hue: number;        // OKLCH hue in degrees
}

const HUE_STEP = 360 / 17;

/**
 * 17 tiers, ordered highest → lowest threshold.
 * Hues are evenly distributed so every tier has a unique colour.
 */
export const SAN_TIERS: SanTier[] = [
  { name: 'san+',     minRatio: 1.0001, hue: HUE_STEP * 0  },  // strictly greater than san
  { name: 'san',      minRatio: 1.0,    hue: HUE_STEP * 1  },  // at or above san's XP
  { name: '1/2 san',  minRatio: 1 / 2,  hue: HUE_STEP * 2  },
  { name: '1/3 san',  minRatio: 1 / 3,  hue: HUE_STEP * 3  },
  { name: '1/4 san',  minRatio: 1 / 4,  hue: HUE_STEP * 4  },
  { name: '1/5 san',  minRatio: 1 / 5,  hue: HUE_STEP * 5  },
  { name: '1/6 san',  minRatio: 1 / 6,  hue: HUE_STEP * 6  },
  { name: '1/7 san',  minRatio: 1 / 7,  hue: HUE_STEP * 7  },
  { name: '1/8 san',  minRatio: 1 / 8,  hue: HUE_STEP * 8  },
  { name: '1/9 san',  minRatio: 1 / 9,  hue: HUE_STEP * 9  },
  { name: '1/10 san', minRatio: 1 / 10, hue: HUE_STEP * 10 },
  { name: '1/11 san', minRatio: 1 / 11, hue: HUE_STEP * 11 },
  { name: '1/12 san', minRatio: 1 / 12, hue: HUE_STEP * 12 },
  { name: '1/13 san', minRatio: 1 / 13, hue: HUE_STEP * 13 },
  { name: '1/14 san', minRatio: 1 / 14, hue: HUE_STEP * 14 },
  { name: '1/15 san', minRatio: 1 / 15, hue: HUE_STEP * 15 },
  { name: '1/16 san', minRatio: 1 / 16, hue: HUE_STEP * 16 },
];

// ─── OKLCH → Discord integer colour ──────────────────────────────────────────

/**
 * Convert OKLCH(L, C, H°) to a Discord role colour integer (0xRRGGBB).
 * Uses the standard OKLAB/OKLCH → linear-sRGB → gamma-sRGB pipeline.
 */
export function oklchToDiscordColor(L: number, C: number, H: number): number {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  // OKLAB → LMS (non-linear)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS → linear sRGB
  const r_lin =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  // Gamma-encode (linear → sRGB 0-255)
  function encode(x: number): number {
    const c = Math.max(0, Math.min(1, x));
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(v * 255);
  }

  const R = encode(r_lin);
  const G = encode(g_lin);
  const B = encode(b_lin);

  return (R << 16) | (G << 8) | B;
}

/**
 * Returns the appropriate OKLCH chroma for a given hue.
 * Hues within 35° of an sRGB primary (red ≈29°, green ≈142°, blue ≈264°)
 * use C=0.10 to stay safely inside the sRGB gamut.
 * All other hues use C=0.15 for more vivid colour.
 */
export function getChromaForHue(hue: number): number {
  function angDist(h1: number, h2: number): number {
    const d = Math.abs(h1 - h2) % 360;
    return Math.min(d, 360 - d);
  }
  const nearPrimary =
    angDist(hue, 29)  <= 35 ||   // near red
    angDist(hue, 142) <= 35 ||   // near green
    angDist(hue, 264) <= 35;     // near blue
  return nearPrimary ? 0.10 : 0.15;
}

// Pre-compute Discord colours for all tiers once at module load
// L=0.4, chroma varies per hue (see getChromaForHue)
export const SAN_TIER_COLORS: number[] = SAN_TIERS.map(t =>
  oklchToDiscordColor(0.4, getChromaForHue(t.hue), t.hue)
);

// ─── Tier determination ───────────────────────────────────────────────────────

/**
 * Determine which san tier a user belongs to.
 * Returns the SanTier or null if below 1/16 san threshold.
 */
export function getSanTier(userXp: number, sanXp: number): SanTier | null {
  if (sanXp <= 0) return null;
  const ratio = userXp / sanXp;
  for (const tier of SAN_TIERS) {
    if (ratio >= tier.minRatio) return tier;
  }
  return null;
}

// ─── Firebase helpers ─────────────────────────────────────────────────────────

async function getSanConfig(
  db: Firestore,
  guildId: string
): Promise<SanRoleConfig | null> {
  const doc = await db
    .collection('discord-data')
    .doc('serverConfig')
    .collection('configs')
    .doc(guildId)
    .get();

  if (!doc.exists) return null;
  const config = doc.data() as ServerConfig;
  return config.sanRoleConfig || null;
}

async function saveSanConfig(
  db: Firestore,
  guildId: string,
  sanConfig: SanRoleConfig
): Promise<void> {
  await db
    .collection('discord-data')
    .doc('serverConfig')
    .collection('configs')
    .doc(guildId)
    .set({ sanRoleConfig: sanConfig }, { merge: true });
}

// ─── Role creation / sync ─────────────────────────────────────────────────────

/**
 * Position all san roles in the guild hierarchy.
 * Places them as a block immediately below `belowRoleId` (e.g. "study monarch").
 * san+ ends up closest to the top, 1/16 san furthest down.
 */
export async function positionSanRoles(
  guild: Guild,
  roleMap: { [tierName: string]: string },
  belowRoleId: string
): Promise<void> {
  await guild.roles.fetch();
  const anchor = guild.roles.cache.get(belowRoleId);
  if (!anchor) {
    logger.warn(`Anchor role ${belowRoleId} not found — skipping position update`);
    return;
  }

  // Build position list: san+ gets anchorPos-1, san gets anchorPos-2, …
  const positionUpdates = SAN_TIERS
    .map((tier, i) => {
      const roleId = roleMap[tier.name];
      if (!roleId) return null;
      return { role: roleId, position: Math.max(1, anchor.position - 1 - i) };
    })
    .filter(Boolean) as { role: string; position: number }[];

  try {
    await guild.roles.setPositions(positionUpdates);
    logger.info(`Positioned ${positionUpdates.length} san roles below "${anchor.name}"`);
  } catch (err) {
    logger.error('Failed to set san role positions', err);
  }
}

/**
 * Create (or update) all 17 san-level roles in the guild.
 * Returns a map of tier name → role ID.
 */
export async function createSanRoles(
  guild: Guild,
  existingRoles?: { [tierName: string]: string }
): Promise<{ [tierName: string]: string }> {
  const roleMap: { [tierName: string]: string } = {};

  for (let i = 0; i < SAN_TIERS.length; i++) {
    const tier = SAN_TIERS[i];
    const color = SAN_TIER_COLORS[i];
    const existingId = existingRoles?.[tier.name];

    try {
      if (existingId) {
        // Try to fetch and update the existing role
        const existing = await guild.roles.fetch(existingId).catch(() => null);
        if (existing) {
          await existing.edit({ name: tier.name, color });
          roleMap[tier.name] = existing.id;
          logger.info(`Updated san role "${tier.name}" (${existingId})`);
          continue;
        }
      }

      // Create a new role
      const created = await guild.roles.create({
        name: tier.name,
        color,
        hoist: false,
        mentionable: false,
        reason: 'San-level role system setup',
      });
      roleMap[tier.name] = created.id;
      logger.info(`Created san role "${tier.name}" → ${created.id}`);
    } catch (err) {
      logger.error(`Failed to create/update san role "${tier.name}"`, err);
    }
  }

  return roleMap;
}

/**
 * Sync a single user's san-level role.
 * Removes all other san-level roles, then assigns the correct one.
 */
export async function syncUserSanRole(
  db: Firestore,
  client: Client,
  guildId: string,
  userId: string,
  userXp: number
): Promise<void> {
  const sanConfig = await getSanConfig(db, guildId);
  if (!sanConfig || Object.keys(sanConfig.roles).length === 0) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const allSanRoleIds = Object.values(sanConfig.roles);
  const targetTier = getSanTier(userXp, sanConfig.sanXp);
  const targetRoleId = targetTier ? sanConfig.roles[targetTier.name] : null;

  // Remove all san roles the user currently has
  for (const roleId of allSanRoleIds) {
    if (roleId !== targetRoleId && member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(err =>
        logger.error(`Failed to remove san role ${roleId} from ${userId}`, err)
      );
    }
  }

  // Add the target role if the user doesn't already have it
  if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
    await member.roles.add(targetRoleId).catch(err =>
      logger.error(`Failed to add san role ${targetRoleId} to ${userId}`, err)
    );
    logger.info(`Assigned "${targetTier!.name}" san role to ${userId}`);
  }
}

/**
 * Sync all guild members' san-level roles.
 * Also updates the stored sanXp to the current max.
 */
export async function syncAllSanRoles(
  db: Firestore,
  client: Client,
  guildId: string,
  onProgress?: (current: number, total: number, username: string) => void
): Promise<{ synced: number; errors: number; newSanXp: number }> {
  const sanConfig = await getSanConfig(db, guildId);
  if (!sanConfig || Object.keys(sanConfig.roles).length === 0) {
    throw new Error('San roles not configured. Run /setup-san-roles first.');
  }

  // Fetch all user stats to find current max XP
  const statsSnapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .get();

  let maxXp = sanConfig.sanXp;
  let sanUserId = sanConfig.sanUserId;
  const userXpMap = new Map<string, number>();

  for (const doc of statsSnapshot.docs) {
    const xp = (doc.data().xp as number) || 0;
    userXpMap.set(doc.id, xp);
    if (xp > maxXp) {
      maxXp = xp;
      sanUserId = doc.id;
    }
  }

  // Persist updated sanXp
  if (maxXp !== sanConfig.sanXp) {
    const updated: SanRoleConfig = { ...sanConfig, sanXp: maxXp, sanUserId, updatedAt: Timestamp.now() };
    await saveSanConfig(db, guildId, updated);
    sanConfig.sanXp = maxXp;
  }

  const guild = await client.guilds.fetch(guildId);
  await guild.members.fetch();
  const members = Array.from(guild.members.cache.values()).filter(m => !m.user.bot);

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (onProgress) onProgress(i + 1, members.length, member.user.username);

    try {
      const userXp = userXpMap.get(member.id) || 0;
      await syncUserSanRole(db, client, guildId, member.id, userXp);
      synced++;
    } catch (err) {
      errors++;
      logger.error(`Failed to sync san role for ${member.id}`, err);
    }
  }

  return { synced, errors, newSanXp: maxXp };
}

/**
 * Get current max XP across all users (lightweight — just reads stats).
 */
export async function getCurrentSanXp(db: Firestore): Promise<{ xp: number; userId?: string }> {
  const snapshot = await db
    .collection('discord-data')
    .doc('userStats')
    .collection('stats')
    .orderBy('xp', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) return { xp: 0 };

  const doc = snapshot.docs[0];
  return { xp: (doc.data().xp as number) || 0, userId: doc.id };
}
