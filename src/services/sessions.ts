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

    const docRef = await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .add(completedSession);

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
   */
  async getTopUsers(
    since: Timestamp,
    limit: number = 10
  ): Promise<Array<{ userId: string; username: string; totalDuration: number; sessionCount: number }>> {
    // Get all sessions since the timeframe
    const snapshot = await this.db
      .collection('discord-data')
      .doc('sessions')
      .collection('completed')
      .where('createdAt', '>=', since)
      .get();

    if (snapshot.empty) {
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

    return users;
  }
}
