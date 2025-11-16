import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { SessionPost } from '../types';

/**
 * Post Service - Manages session post tracking for social features
 *
 * This service handles:
 * - Creating session post records when sessions are posted to feed
 * - Tracking reactions on session posts
 * - Managing cheers/kudos on session posts
 */
export class PostService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Create a session post record when a session is posted to the feed
   *
   * @param messageId - Discord message ID (used as document ID)
   * @param userId - User who completed the session
   * @param username - Discord username
   * @param guildId - Discord server ID
   * @param channelId - Feed channel ID
   * @param sessionId - Reference to completed session
   * @param duration - Session duration in seconds
   * @param xpGained - XP awarded for this session
   * @param levelGained - New level if leveled up (optional)
   * @param achievementsUnlocked - Achievement IDs unlocked in this session (optional)
   */
  async createSessionPost(
    messageId: string,
    userId: string,
    username: string,
    guildId: string,
    channelId: string,
    sessionId: string,
    duration: number,
    xpGained: number,
    levelGained?: number,
    achievementsUnlocked?: string[]
  ): Promise<void> {
    const postData: SessionPost = {
      messageId,
      userId,
      username,
      guildId,
      channelId,
      sessionId,
      duration,
      xpGained,
      postedAt: Timestamp.now(),
      reactions: {},
      cheers: []
    };

    // Only include optional fields if they have values
    if (levelGained !== undefined) {
      postData.levelGained = levelGained;
    }
    if (achievementsUnlocked !== undefined) {
      postData.achievementsUnlocked = achievementsUnlocked;
    }

    await this.db
      .collection('discord-data')
      .doc('sessionPosts')
      .collection('posts')
      .doc(messageId)
      .set(postData);

    console.log(`[POST] Created session post ${messageId} for user ${userId}`);
  }

  /**
   * Get a session post by message ID
   *
   * @param messageId - Discord message ID
   * @returns SessionPost or null if not found
   */
  async getSessionPost(messageId: string): Promise<SessionPost | null> {
    const doc = await this.db
      .collection('discord-data')
      .doc('sessionPosts')
      .collection('posts')
      .doc(messageId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as SessionPost;
  }

  /**
   * Get the most recent session post for a user
   *
   * @param userId - Discord user ID
   * @returns SessionPost or null if not found
   */
  async getMostRecentPostByUser(userId: string): Promise<SessionPost | null> {
    const snapshot = await this.db
      .collection('discord-data')
      .doc('sessionPosts')
      .collection('posts')
      .where('userId', '==', userId)
      .orderBy('postedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as SessionPost;
  }


  /**
   * Add a cheer/kudos to a session post
   *
   * @param messageId - Discord message ID
   * @param userId - User ID giving the cheer
   * @param username - Username giving the cheer
   * @param message - Cheer message
   */
  async addCheer(
    messageId: string,
    userId: string,
    username: string,
    message: string
  ): Promise<void> {
    const postRef = this.db
      .collection('discord-data')
      .doc('sessionPosts')
      .collection('posts')
      .doc(messageId);

    const cheerData = {
      userId,
      username,
      message,
      timestamp: Timestamp.now()
    };

    await postRef.update({
      cheers: FieldValue.arrayUnion(cheerData)
    });

    console.log(`[POST] Added cheer from ${userId} to post ${messageId}`);
  }


  /**
   * Get all cheers for a specific post
   *
   * @param messageId - Discord message ID
   * @returns Array of cheers or null if post not found
   */
  async getCheers(messageId: string): Promise<Array<{
    userId: string;
    username: string;
    message: string;
    timestamp: Timestamp;
  }> | null> {
    const post = await this.getSessionPost(messageId);
    return post ? post.cheers : null;
  }
}
