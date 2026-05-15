/**
 * Moderation Service
 *
 * Handles message audit logging and the /bs (slacking call-out) system.
 * Message logs are permanent and cannot be deleted through the bot.
 */

import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { createLogger } from '../utils/logger';

const logger = createLogger('ModerationService');

const BS_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes per target
const BS_DAILY_BASE = 2; // base tokens per day

export interface MessageLogEntry {
  messageId: string;
  channelId: string;
  channelName: string;
  guildId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  attachments: string[];
  createdAt: Timestamp;
  deletedAt: Timestamp | null;
  isDeleted: boolean;
  editHistory: Array<{
    oldContent: string;
    newContent: string;
    editedAt: Timestamp;
  }>;
}

export interface BsUserState {
  userId: string;
  dailyCount: number;
  extraTokens: number; // earned by getting correct calls
  lastResetDate: string; // 'YYYY-MM-DD'
}

export interface BsCooldown {
  targetUserId: string;
  lastBsAt: Timestamp;
}

export interface PendingBs {
  pendingId: string;
  bserId: string;
  bserUsername: string;
  targetId: string;
  targetUsername: string;
  guildId: string;
  channelId: string;
  messageId: string;
  createdAt: Timestamp;
  resolved: boolean;
  result: 'confirmed' | 'denied' | null;
}

export interface BsLeaderboardEntry {
  userId: string;
  username: string;
  guildId: string;
  bsPoints: number; // total correct calls ever
  xpMilestonesReached: number; // how many times they've earned the 20-point XP reward
}

export const BS_XP_MILESTONE = 20; // correct calls needed for XP reward
export const BS_XP_REWARD = 130; // XP awarded per milestone

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export class ModerationService {
  constructor(private db: Firestore) {}

  // ---- Message Audit Log ----

  async logMessage(
    entry: Omit<MessageLogEntry, 'deletedAt' | 'isDeleted' | 'editHistory'>
  ): Promise<void> {
    try {
      await this.db
        .collection('discord-data')
        .doc('messageLog')
        .collection('messages')
        .doc(entry.messageId)
        .set({
          ...entry,
          deletedAt: null,
          isDeleted: false,
          editHistory: [],
        });
    } catch (error) {
      logger.error('Failed to log message', error);
    }
  }

  async markMessageDeleted(messageId: string): Promise<void> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('messageLog')
        .collection('messages')
        .doc(messageId);

      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.update({
          isDeleted: true,
          deletedAt: Timestamp.now(),
        });
      }
    } catch (error) {
      logger.error('Failed to mark message deleted', error);
    }
  }

  async logMessageEdit(
    messageId: string,
    oldContent: string,
    newContent: string
  ): Promise<void> {
    try {
      const docRef = this.db
        .collection('discord-data')
        .doc('messageLog')
        .collection('messages')
        .doc(messageId);

      const doc = await docRef.get();
      if (doc.exists) {
        const existing = doc.data() as MessageLogEntry;
        const editHistory = existing.editHistory || [];
        editHistory.push({ oldContent, newContent, editedAt: Timestamp.now() });
        await docRef.update({ content: newContent, editHistory });
      }
    } catch (error) {
      logger.error('Failed to log message edit', error);
    }
  }

  async searchDeletedMessages(options: {
    guildId: string;
    authorId?: string;
    channelId?: string;
    keyword?: string;
    limit?: number;
  }): Promise<MessageLogEntry[]> {
    try {
      let query: FirebaseFirestore.Query = this.db
        .collection('discord-data')
        .doc('messageLog')
        .collection('messages')
        .where('guildId', '==', options.guildId)
        .where('isDeleted', '==', true);

      if (options.authorId) {
        query = query.where('authorId', '==', options.authorId);
      }
      if (options.channelId) {
        query = query.where('channelId', '==', options.channelId);
      }

      const snapshot = await query
        .orderBy('deletedAt', 'desc')
        .limit(options.limit ?? 10)
        .get();

      let entries = snapshot.docs.map((doc) => doc.data() as MessageLogEntry);

      // Firestore doesn't support full-text search — filter client-side
      if (options.keyword) {
        const kw = options.keyword.toLowerCase();
        entries = entries.filter((e) => e.content.toLowerCase().includes(kw));
      }

      return entries;
    } catch (error) {
      logger.error('Failed to search deleted messages', error);
      return [];
    }
  }

  async getRecentDeletedMessages(guildId: string, limit = 10): Promise<MessageLogEntry[]> {
    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('messageLog')
        .collection('messages')
        .where('guildId', '==', guildId)
        .where('isDeleted', '==', true)
        .orderBy('deletedAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => doc.data() as MessageLogEntry);
    } catch (error) {
      logger.error('Failed to get recent deleted messages', error);
      return [];
    }
  }

  // ---- /bs System ----

  async getBsUserState(userId: string): Promise<BsUserState> {
    const today = getTodayDate();
    const docRef = this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('userState')
      .doc(userId);

    const doc = await docRef.get();
    if (!doc.exists) {
      return { userId, dailyCount: 0, extraTokens: 0, lastResetDate: today };
    }

    const data = doc.data() as BsUserState;

    // Reset if it's a new calendar day
    if (data.lastResetDate !== today) {
      return { userId, dailyCount: 0, extraTokens: 0, lastResetDate: today };
    }

    return data;
  }

  async saveBsUserState(state: BsUserState): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('userState')
      .doc(state.userId)
      .set(state);
  }

  async incrementBsCount(userId: string): Promise<void> {
    const state = await this.getBsUserState(userId);
    await this.saveBsUserState({ ...state, dailyCount: state.dailyCount + 1 });
  }

  async addBsToken(userId: string): Promise<void> {
    const state = await this.getBsUserState(userId);
    await this.saveBsUserState({ ...state, extraTokens: state.extraTokens + 1 });
  }

  canUseBs(state: BsUserState): boolean {
    return state.dailyCount < BS_DAILY_BASE + state.extraTokens;
  }

  remainingBs(state: BsUserState): number {
    return Math.max(0, BS_DAILY_BASE + state.extraTokens - state.dailyCount);
  }

  async isTargetOnCooldown(targetUserId: string): Promise<boolean> {
    const doc = await this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('cooldowns')
      .doc(targetUserId)
      .get();

    if (!doc.exists) return false;

    const data = doc.data() as BsCooldown;
    return Date.now() - data.lastBsAt.toMillis() < BS_COOLDOWN_MS;
  }

  async getCooldownRemainingMs(targetUserId: string): Promise<number> {
    const doc = await this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('cooldowns')
      .doc(targetUserId)
      .get();

    if (!doc.exists) return 0;

    const data = doc.data() as BsCooldown;
    return Math.max(0, BS_COOLDOWN_MS - (Date.now() - data.lastBsAt.toMillis()));
  }

  async setTargetCooldown(targetUserId: string): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('cooldowns')
      .doc(targetUserId)
      .set({ targetUserId, lastBsAt: Timestamp.now() });
  }

  async createPendingBs(pending: PendingBs): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('pending')
      .doc(pending.pendingId)
      .set(pending);
  }

  async getPendingBs(pendingId: string): Promise<PendingBs | null> {
    const doc = await this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('pending')
      .doc(pendingId)
      .get();

    if (!doc.exists) return null;
    return doc.data() as PendingBs;
  }

  async resolvePendingBs(pendingId: string, result: 'confirmed' | 'denied'): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('pending')
      .doc(pendingId)
      .update({ resolved: true, result });
  }

  // ---- BS Leaderboard ----

  private leaderboardRef(guildId: string, userId: string) {
    return this.db
      .collection('discord-data')
      .doc('bsData')
      .collection('leaderboard')
      .doc(`${guildId}_${userId}`);
  }

  async getBsLeaderboardEntry(guildId: string, userId: string): Promise<BsLeaderboardEntry | null> {
    const doc = await this.leaderboardRef(guildId, userId).get();
    if (!doc.exists) return null;
    return doc.data() as BsLeaderboardEntry;
  }

  /**
   * Increment a user's BS points for a guild.
   * Returns the new point total and whether a 20-point XP milestone was just crossed.
   */
  async incrementBsPoints(
    guildId: string,
    userId: string,
    username: string
  ): Promise<{ newPoints: number; milestoneReached: boolean }> {
    const ref = this.leaderboardRef(guildId, userId);
    const doc = await ref.get();

    const existing: BsLeaderboardEntry = doc.exists
      ? (doc.data() as BsLeaderboardEntry)
      : { userId, username, guildId, bsPoints: 0, xpMilestonesReached: 0 };

    const newPoints = existing.bsPoints + 1;
    const newMilestones = Math.floor(newPoints / BS_XP_MILESTONE);
    const milestoneReached = newMilestones > existing.xpMilestonesReached;

    await ref.set({
      ...existing,
      username,
      bsPoints: newPoints,
      xpMilestonesReached: newMilestones,
    });

    return { newPoints, milestoneReached };
  }

  async getBsLeaderboard(guildId: string, limit = 10): Promise<BsLeaderboardEntry[]> {
    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('bsData')
        .collection('leaderboard')
        .where('guildId', '==', guildId)
        .orderBy('bsPoints', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => doc.data() as BsLeaderboardEntry);
    } catch (error) {
      logger.error('Failed to get BS leaderboard', error);
      return [];
    }
  }
}
