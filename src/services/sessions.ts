import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ActiveSession, CompletedSession } from '../types';

export class SessionService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Gets the active session for a user
   */
  async getActiveSession(userId: string): Promise<ActiveSession | null> {
    const doc = await this.db
      .collection('discord-data')
      .doc('activeSessions')
      .collection('sessions')
      .doc(userId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as ActiveSession;
  }

  /**
   * Gets all active sessions
   */
  async getAllActiveSessions(): Promise<ActiveSession[]> {
    const snapshot = await this.db
      .collection('discord-data')
      .doc('activeSessions')
      .collection('sessions')
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => doc.data() as ActiveSession);
  }

  /**
   * Gets all active sessions for a specific server
   */
  async getActiveSessionsByServer(serverId: string): Promise<ActiveSession[]> {
    const snapshot = await this.db
      .collection('discord-data')
      .doc('activeSessions')
      .collection('sessions')
      .where('serverId', '==', serverId)
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => doc.data() as ActiveSession);
  }

  /**
   * Creates a new active session for a user
   */
  async createActiveSession(
    userId: string,
    username: string,
    serverId: string,
    activity: string
  ): Promise<void> {
    const session: ActiveSession = {
      userId,
      username,
      serverId,
      activity,
      startTime: Timestamp.now(),
      isPaused: false,
      pausedDuration: 0,
    };

    await this.db
      .collection('discord-data')
      .doc('activeSessions')
      .collection('sessions')
      .doc(userId)
      .set(session);
  }

  /**
   * Updates an active session
   */
  async updateActiveSession(
    userId: string,
    updates: Partial<ActiveSession>
  ): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('activeSessions')
      .collection('sessions')
      .doc(userId)
      .update(updates);
  }

  /**
   * Deletes an active session
   */
  async deleteActiveSession(userId: string): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('activeSessions')
      .collection('sessions')
      .doc(userId)
      .delete();
  }

  /**
   * Creates a completed session record
   */
  async createCompletedSession(
    session: Omit<CompletedSession, 'createdAt'>
  ): Promise<string> {
    const completedSession: CompletedSession = {
      ...session,
      createdAt: Timestamp.now(),
    };

    // Log session creation for debugging
    console.log(`[SESSION CREATE] User: ${session.username} (${session.userId})`);
    console.log(`[SESSION CREATE] Duration: ${session.duration}s (${(session.duration / 3600).toFixed(2)}h)`);
    console.log(`[SESSION CREATE] Activity: ${session.activity}`);
    console.log(`[SESSION CREATE] Start: ${session.startTime.toDate().toISOString()}`);
    console.log(`[SESSION CREATE] End: ${session.endTime.toDate().toISOString()}`);
    console.log(`[SESSION CREATE] Title: ${session.title}`);

    const docRef = await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .add(completedSession);

    console.log(`[SESSION CREATE] Created session ${docRef.id}`);

    return docRef.id;
  }

  /**
   * Gets completed sessions for a user within a timeframe
   */
  async getCompletedSessions(
    userId: string,
    since?: Timestamp
  ): Promise<CompletedSession[]> {
    let query = this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('userId', '==', userId);

    if (since) {
      query = query.where('createdAt', '>=', since);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map((doc) => doc.data() as CompletedSession);
  }

  /**
   * Gets top users by total duration within a timeframe
   * Returns array of { userId, username, totalDuration, sessionCount }
   *
   * If serverId is provided, only includes users who have at least one session
   * in that server, but counts ALL their sessions across all servers.
   */
  async getTopUsers(
    since: Timestamp,
    limit: number = 10,
    serverId?: string
  ): Promise<Array<{ userId: string; username: string; totalDuration: number; sessionCount: number }>> {
    console.log(`[GET TOP USERS] Fetching sessions since ${since.toDate().toISOString()}, limit: ${limit}, serverId: ${serverId || 'all'}`);

    // Get all sessions since the timeframe
    const allSessionsSnapshot = await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('createdAt', '>=', since)
      .get();

    console.log(`[GET TOP USERS] Found ${allSessionsSnapshot.size} total sessions across all servers`);

    if (allSessionsSnapshot.empty) {
      console.log(`[GET TOP USERS] No sessions found`);
      return [];
    }

    // If serverId is provided, find users who have sessions in that server
    let eligibleUserIds: Set<string> | null = null;

    if (serverId) {
      eligibleUserIds = new Set<string>();
      allSessionsSnapshot.docs.forEach(doc => {
        const session = doc.data() as CompletedSession;
        if (session.serverId === serverId) {
          eligibleUserIds!.add(session.userId);
        }
      });
      console.log(`[GET TOP USERS] Found ${eligibleUserIds.size} users with sessions in server ${serverId}`);
    }

    // Log all sessions for debugging
    const allSessions = allSessionsSnapshot.docs.map(doc => {
      const session = doc.data() as CompletedSession;
      return {
        id: doc.id,
        userId: session.userId,
        username: session.username,
        duration: session.duration,
        hours: (session.duration / 3600).toFixed(2),
        createdAt: session.createdAt.toDate().toISOString(),
        activity: session.activity,
        serverId: session.serverId,
      };
    });
    console.log(`[GET TOP USERS] All sessions:`, allSessions);

    // Aggregate sessions by user (including ALL their sessions across servers)
    const userMap = new Map<string, { username: string; totalDuration: number; sessionCount: number; sessionIds: string[] }>();

    allSessionsSnapshot.docs.forEach((doc) => {
      const session = doc.data() as CompletedSession;

      // Skip users not in the eligible set (if serverId filter is active)
      if (eligibleUserIds && !eligibleUserIds.has(session.userId)) {
        return;
      }

      const existing = userMap.get(session.userId);

      if (existing) {
        existing.totalDuration += session.duration;
        existing.sessionCount += 1;
        existing.sessionIds.push(doc.id);
        console.log(`[GET TOP USERS] Aggregating for ${session.username}: adding ${session.duration}s, total now ${existing.totalDuration}s`);
      } else {
        userMap.set(session.userId, {
          username: session.username,
          totalDuration: session.duration,
          sessionCount: 1,
          sessionIds: [doc.id],
        });
        console.log(`[GET TOP USERS] First session for ${session.username}: ${session.duration}s`);
      }
    });

    // Log aggregated data
    console.log(`[GET TOP USERS] Aggregated by user:`, Array.from(userMap.entries()).map(([userId, data]) => ({
      userId,
      username: data.username,
      totalDuration: data.totalDuration,
      hours: (data.totalDuration / 3600).toFixed(2),
      sessionCount: data.sessionCount,
      sessionIds: data.sessionIds,
    })));

    // Convert to array and sort by total duration
    const users = Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        username: data.username,
        totalDuration: data.totalDuration,
        sessionCount: data.sessionCount,
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit);

    console.log(`[GET TOP USERS] Returning top ${users.length} users`);
    return users;
  }
}
