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
   * Updates a completed session with XP gained
   */
  async updateCompletedSessionXP(sessionId: string, xpGained: number): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .doc(sessionId)
      .update({ xpGained });
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
   * If serverId provided: Only counts sessions FROM that specific server
   * If no serverId: Counts all sessions globally
   */
  async getTopUsers(
    since: Timestamp,
    limit: number = 10,
    serverId?: string
  ): Promise<Array<{ userId: string; username: string; totalDuration: number; sessionCount: number }>> {
    console.log(`[GET TOP USERS] Fetching sessions since ${since.toDate().toISOString()}, limit: ${limit}, serverId: ${serverId || 'all'}`);

    // Build query - filter by server if provided (much more efficient!)
    let query = this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('createdAt', '>=', since);

    if (serverId) {
      query = query.where('serverId', '==', serverId);
    }

    const snapshot = await query.get();

    console.log(`[GET TOP USERS] Found ${snapshot.size} sessions${serverId ? ` in server ${serverId}` : ' across all servers'}`);

    if (snapshot.empty) {
      console.log(`[GET TOP USERS] No sessions found`);
      return [];
    }

    // Aggregate sessions by user
    const userMap = new Map<string, { username: string; totalDuration: number; sessionCount: number }>();

    snapshot.docs.forEach((doc) => {
      const session = doc.data() as CompletedSession;

      const existing = userMap.get(session.userId);

      if (existing) {
        existing.totalDuration += session.duration;
        existing.sessionCount += 1;
      } else {
        userMap.set(session.userId, {
          username: session.username,
          totalDuration: session.duration,
          sessionCount: 1,
        });
      }
    });

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
