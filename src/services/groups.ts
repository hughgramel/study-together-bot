/**
 * Group Service - Manages study groups and group memberships
 *
 * Handles creation, management, and tracking of study groups. Groups are collaborative
 * teams of up to 5 members who earn XP bonuses based on group level. Features include:
 * - Group creation with unique IDs (e.g., A1B2)
 * - Member management (join, leave, kick)
 * - Group leveling based on collective study hours
 * - XP bonus modifiers for group members
 * - Public/private group visibility
 * - Group leaderboards and rankings
 *
 * @module services/groups
 */

import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { createLogger } from '../utils/logger';

const logger = createLogger('GroupService');

/**
 * Group record - represents a study group
 */
export interface Group {
  groupId: string;          // Unique group ID (e.g., 'A1B2')
  name: string;             // Group name
  description?: string;     // Optional group description
  ownerId: string;          // Discord user ID of group owner
  ownerUsername: string;    // Discord username of owner
  serverId: string;         // Discord server ID
  isPublic: boolean;        // Whether group is publicly visible/joinable
  maxMembers: number;       // Maximum number of members (default: 5)
  memberCount: number;      // Current number of members
  totalHours: number;       // Total study hours across all members
  level: number;            // Group level (calculated from total hours)
  createdAt: Timestamp;     // When group was created
  updatedAt: Timestamp;     // Last stats update
}

/**
 * Group membership record - tracks user's group membership
 */
export interface GroupMembership {
  userId: string;           // Discord user ID
  username: string;         // Discord username
  groupId: string;          // Group ID user belongs to
  joinedAt: Timestamp;      // When user joined the group
  isOwner: boolean;         // Whether user is the group owner
}

/**
 * Service for managing study groups and memberships
 */
export class GroupService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Generates a unique group ID in format XXXX
   *
   * @returns Random group ID (e.g., "A1B2")
   * @private
   */
  private generateGroupId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 4; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Calculates group level from total hours
   *
   * Groups level up every 25 hours of collective study time.
   * Formula: level = floor(totalHours / 25) + 1
   *
   * @param totalHours - Total study hours across all group members
   * @returns Group level (minimum 1)
   */
  calculateGroupLevel(totalHours: number): number {
    return Math.floor(totalHours / 25) + 1;
  }

  /**
   * Calculates XP modifier (bonus percentage) based on group level
   *
   * Group members receive bonus XP based on their group's level.
   * Formula: 1% bonus per group level (e.g., level 10 = +10% XP)
   *
   * @param level - Group level
   * @returns XP modifier as decimal (e.g., 0.10 for +10%)
   * Formula: min(0.5, groupLevel * 0.01) = 1% per level, capped at 50%
   */
  calculateXpModifier(groupLevel: number): number {
    return Math.min(0.5, groupLevel * 0.01);
  }

  /**
   * Create a new group with auto-generated ID
   * Returns the created group
   *
   * @remarks
   * Uses collision detection to ensure unique group IDs. Retries up to 10 times
   * if an ID collision is detected.
   */
  async createGroup(
    name: string,
    ownerId: string,
    ownerUsername: string,
    serverId: string,
    options?: {
      isPublic?: boolean;
      maxMembers?: number;
      description?: string;
    }
  ): Promise<Group> {
    try {
      // Generate unique group ID with collision detection
      let groupId: string;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        groupId = this.generateGroupId();
        const existingGroup = await this.getGroup(groupId);

        if (!existingGroup) {
          // Found a unique ID
          break;
        }

        attempts++;
        logger.info(`ID collision detected (${groupId}), retry ${attempts}/${maxAttempts}`);
      }

      if (attempts === maxAttempts) {
        throw new Error('Failed to generate unique group ID after 10 attempts');
      }

      const now = Timestamp.now();

      const group: Group = {
        groupId: groupId!,
        name,
        description: options?.description,
        ownerId,
        ownerUsername,
        serverId,
        isPublic: options?.isPublic ?? true,
        maxMembers: options?.maxMembers ?? 5,
        memberCount: 1, // Owner is the first member
        totalHours: 0,
        level: 1,
        createdAt: now,
        updatedAt: now,
      };

      // Create group document
      await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId!)
        .set(group);

      // Create owner's membership
      const membership: GroupMembership = {
        userId: ownerId,
        username: ownerUsername,
        groupId: groupId!,
        joinedAt: now,
        isOwner: true,
      };

      await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(ownerId)
        .set(membership);

      logger.info(`Created group ${groupId!} (${name}) by ${ownerUsername}`);

      return group;
    } catch (error) {
      logger.error('Error creating group:', error);
      throw new Error('Failed to create group');
    }
  }

  /**
   * Get a group by ID
   */
  async getGroup(groupId: string): Promise<Group | null> {
    try {
      const doc = await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as Group;
    } catch (error) {
      logger.error('Error getting group:', error);
      return null;
    }
  }

  /**
   * Get user's current group membership
   * Returns null if user is not in any group
   */
  async getUserGroup(userId: string): Promise<{ membership: GroupMembership; group: Group } | null> {
    try {
      const membershipDoc = await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(userId)
        .get();

      if (!membershipDoc.exists) {
        return null;
      }

      const membership = membershipDoc.data() as GroupMembership;

      // Fetch the actual group data
      const group = await this.getGroup(membership.groupId);

      if (!group) {
        // Group was deleted but membership still exists - clean up
        await this.db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .doc(userId)
          .delete();
        return null;
      }

      return { membership, group };
    } catch (error) {
      logger.error('Error getting user group:', error);
      return null;
    }
  }

  /**
   * Add a member to a group
   *
   * @remarks
   * Uses Firestore transaction to atomically check capacity and add member.
   * This prevents race conditions where multiple users could join simultaneously
   * and exceed the group's max capacity.
   */
  async addMemberToGroup(
    groupId: string,
    userId: string,
    username: string
  ): Promise<void> {
    try {
      // Check if user is already in a group (outside transaction)
      const existingMembership = await this.getUserGroup(userId);
      if (existingMembership) {
        throw new Error('User is already in a group');
      }

      const now = Timestamp.now();

      await this.db.runTransaction(async (transaction) => {
        // Read phase: Get current group state
        const groupRef = this.db
          .collection('discord-data')
          .doc('groups')
          .collection('active')
          .doc(groupId);

        const groupSnap = await transaction.get(groupRef);

        // Validation phase
        if (!groupSnap.exists) {
          throw new Error('Group not found');
        }

        const group = groupSnap.data() as Group;

        // Check if group has space
        if (group.memberCount >= group.maxMembers) {
          throw new Error('Group is full');
        }

        // Write phase: Create membership and update group count atomically
        const membershipRef = this.db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .doc(userId);

        const membership: GroupMembership = {
          userId,
          username,
          groupId,
          joinedAt: now,
          isOwner: false,
        };

        transaction.set(membershipRef, membership);
        transaction.update(groupRef, {
          memberCount: group.memberCount + 1,
          updatedAt: now,
        });
      });

      logger.info(`Added ${username} to group ${groupId}`);
    } catch (error) {
      logger.error('Error adding member:', error);
      throw error;
    }
  }

  /**
   * Remove a member from a group
   *
   * @remarks
   * Uses Firestore transaction to atomically delete membership and update count.
   * This prevents race conditions where concurrent removals could result in
   * incorrect member counts.
   *
   * Automatically deletes the group if this was the last member (memberCount becomes 0).
   * This prevents orphaned groups from remaining in the database.
   *
   * After removing the member, recalculates group stats (total hours and level) to
   * reflect the change in membership.
   */
  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    try {
      const now = Timestamp.now();
      let groupName = '';
      let wasAutoDeleted = false;

      await this.db.runTransaction(async (transaction) => {
        // Read phase: Get current group state
        const groupRef = this.db
          .collection('discord-data')
          .doc('groups')
          .collection('active')
          .doc(groupId);

        const groupSnap = await transaction.get(groupRef);

        // Validation phase
        if (!groupSnap.exists) {
          throw new Error('Group not found');
        }

        const group = groupSnap.data() as Group;
        groupName = group.name;

        // Calculate updated member count
        const updatedMemberCount = group.memberCount - 1;

        // Write phase: Delete membership and update/delete group atomically
        const membershipRef = this.db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .doc(userId);

        transaction.delete(membershipRef);

        // Check if this was the last member
        if (updatedMemberCount === 0) {
          // Auto-delete empty group
          transaction.delete(groupRef);
          wasAutoDeleted = true;
        } else {
          // Update group member count
          transaction.update(groupRef, {
            memberCount: updatedMemberCount,
            updatedAt: now,
          });
        }
      });

      logger.info(`Removed user ${userId} from group ${groupId}`);

      if (wasAutoDeleted) {
        logger.info(`Deleted group ${groupId} (${groupName}) - no members remaining`);
      } else {
        // Recalculate group stats (total hours and level) now that member is removed
        await this.updateGroupStats(groupId);
        logger.info(`Recalculated stats for group ${groupId} after member removal`);
      }
    } catch (error) {
      logger.error('Error removing member:', error);
      throw error;
    }
  }

  /**
   * Delete entire group and all memberships
   *
   * @remarks
   * Uses Firestore batched writes to atomically delete the group and all memberships.
   * This ensures that if the operation fails, no partial state is left in the database.
   * Processes deletions in batches of 500 (Firestore's batch size limit).
   */
  async deleteGroup(groupId: string): Promise<void> {
    try {
      // Get all memberships for this group
      const membershipsSnapshot = await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .where('groupId', '==', groupId)
        .get();

      const groupRef = this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId);

      // Firestore batches can handle up to 500 operations
      const batchSize = 500;
      const membershipDocs = membershipsSnapshot.docs;

      // Process deletions in batches
      for (let i = 0; i < membershipDocs.length; i += batchSize) {
        const batch = this.db.batch();
        const batchDocs = membershipDocs.slice(i, i + batchSize);

        // Add membership deletions to batch
        batchDocs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Add group deletion to the last batch
        if (i + batchSize >= membershipDocs.length) {
          batch.delete(groupRef);
        }

        await batch.commit();
      }

      // If there were no memberships, delete the group separately
      if (membershipDocs.length === 0) {
        await groupRef.delete();
      }

      logger.info(`Deleted group ${groupId} and ${membershipsSnapshot.size} memberships`);
    } catch (error) {
      logger.error('Error deleting group:', error);
      throw new Error('Failed to delete group');
    }
  }

  /**
   * Get public groups available to join in a server
   * Returns up to `limit` groups sorted by level (highest first)
   */
  async getPublicGroups(serverId: string, limit: number = 10): Promise<Group[]> {
    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .where('serverId', '==', serverId)
        .where('isPublic', '==', true)
        .orderBy('level', 'desc')
        .limit(limit)
        .get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map((doc) => doc.data() as Group);
    } catch (error) {
      logger.error('Error getting public groups:', error);
      return [];
    }
  }

  /**
   * Update group stats by recalculating from member data
   * Aggregates total hours from all members and updates level
   */
  async updateGroupStats(groupId: string): Promise<void> {
    try {
      const group = await this.getGroup(groupId);

      if (!group) {
        throw new Error('Group not found');
      }

      // Get all memberships for this group
      const membershipsSnapshot = await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .where('groupId', '==', groupId)
        .get();

      if (membershipsSnapshot.empty) {
        logger.info(`No members found for group ${groupId}`);
        return;
      }

      // Get user stats for all members
      const userIds = membershipsSnapshot.docs.map((doc) => doc.data().userId);
      const statsPromises = userIds.map((userId) =>
        this.db
          .collection('discord-data')
          .doc('userStats')
          .collection('stats')
          .doc(userId)
          .get()
      );

      const statsDocs = await Promise.all(statsPromises);

      // Calculate total hours
      let totalHours = 0;
      statsDocs.forEach((doc) => {
        if (doc.exists) {
          const stats = doc.data();
          const userHours = (stats?.totalDuration || 0) / 3600;
          totalHours += userHours;
        }
      });

      // Calculate new level
      const newLevel = this.calculateGroupLevel(totalHours);

      // Update group
      await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .update({
          totalHours,
          level: newLevel,
          updatedAt: Timestamp.now(),
        });

      logger.info(`Updated group ${groupId}: ${totalHours.toFixed(1)}h, level ${newLevel}`);
    } catch (error) {
      logger.error('Error updating group stats:', error);
      throw error;
    }
  }

  /**
   * Transfer group ownership to another member
   *
   * @remarks
   * Uses Firestore transaction to atomically update ownership across group and both memberships.
   * This prevents race conditions where ownership could be left in an inconsistent state if
   * the operation partially fails.
   */
  async transferOwnership(
    groupId: string,
    newOwnerId: string,
    newOwnerUsername: string
  ): Promise<void> {
    try {
      const now = Timestamp.now();

      await this.db.runTransaction(async (transaction) => {
        // Read phase: Get group and verify new owner membership
        const groupRef = this.db
          .collection('discord-data')
          .doc('groups')
          .collection('active')
          .doc(groupId);

        const newOwnerMembershipRef = this.db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .doc(newOwnerId);

        const [groupSnap, newOwnerMembershipSnap] = await Promise.all([
          transaction.get(groupRef),
          transaction.get(newOwnerMembershipRef),
        ]);

        // Validation phase
        if (!groupSnap.exists) {
          throw new Error('Group not found');
        }

        if (!newOwnerMembershipSnap.exists || newOwnerMembershipSnap.data()?.groupId !== groupId) {
          throw new Error('New owner is not a member of this group');
        }

        const group = groupSnap.data() as Group;

        // Write phase: Update both memberships and group atomically
        const oldOwnerMembershipRef = this.db
          .collection('discord-data')
          .doc('groupMembers')
          .collection('memberships')
          .doc(group.ownerId);

        transaction.update(oldOwnerMembershipRef, {
          isOwner: false,
        });

        transaction.update(newOwnerMembershipRef, {
          isOwner: true,
        });

        transaction.update(groupRef, {
          ownerId: newOwnerId,
          ownerUsername: newOwnerUsername,
          updatedAt: now,
        });
      });

      logger.info(`Transferred ownership of ${groupId} to ${newOwnerUsername}`);
    } catch (error) {
      logger.error('Error transferring ownership:', error);
      throw error;
    }
  }

  /**
   * Check if user is the owner of a group
   */
  async isGroupOwner(groupId: string, userId: string): Promise<boolean> {
    try {
      const group = await this.getGroup(groupId);
      return group?.ownerId === userId;
    } catch (error) {
      logger.error('Error checking ownership:', error);
      return false;
    }
  }

  /**
   * Check if group has space for new members
   */
  async hasSpaceAvailable(groupId: string): Promise<boolean> {
    try {
      const group = await this.getGroup(groupId);

      if (!group) {
        return false;
      }

      return group.memberCount < group.maxMembers;
    } catch (error) {
      logger.error('Error checking space:', error);
      return false;
    }
  }

  /**
   * Get all members of a group
   * Returns array of memberships with user stats
   */
  async getGroupMembers(groupId: string): Promise<Array<{
    membership: GroupMembership;
    totalHours: number;
    totalSessions: number;
    currentStreak: number;
  }>> {
    try {
      const membershipsSnapshot = await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .where('groupId', '==', groupId)
        .get();

      if (membershipsSnapshot.empty) {
        return [];
      }

      // Fetch user stats for all members
      const memberDataPromises = membershipsSnapshot.docs.map(async (doc) => {
        const membership = doc.data() as GroupMembership;

        const statsDoc = await this.db
          .collection('discord-data')
          .doc('userStats')
          .collection('stats')
          .doc(membership.userId)
          .get();

        let totalHours = 0;
        let totalSessions = 0;
        let currentStreak = 0;

        if (statsDoc.exists) {
          const stats = statsDoc.data();
          totalHours = (stats?.totalDuration || 0) / 3600;
          totalSessions = stats?.totalSessions || 0;
          currentStreak = stats?.currentStreak || 0;
        }

        return {
          membership,
          totalHours,
          totalSessions,
          currentStreak,
        };
      });

      const members = await Promise.all(memberDataPromises);

      // Sort by total hours descending
      return members.sort((a, b) => b.totalHours - a.totalHours);
    } catch (error) {
      logger.error('Error getting group members:', error);
      return [];
    }
  }

  /**
   * Get all groups in a server (including private)
   * Useful for admin/moderation purposes
   */
  async getAllServerGroups(serverId: string): Promise<Group[]> {
    try {
      const snapshot = await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .where('serverId', '==', serverId)
        .orderBy('level', 'desc')
        .get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map((doc) => doc.data() as Group);
    } catch (error) {
      logger.error('Error getting server groups:', error);
      return [];
    }
  }

  /**
   * Update group settings (name, description, public status, max members)
   * Only owner can update group settings
   */
  async updateGroupSettings(
    groupId: string,
    updates: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      maxMembers?: number;
    }
  ): Promise<void> {
    try {
      const group = await this.getGroup(groupId);

      if (!group) {
        throw new Error('Group not found');
      }

      // If reducing max members, ensure current member count doesn't exceed new limit
      if (updates.maxMembers !== undefined && updates.maxMembers < group.memberCount) {
        throw new Error(`Cannot reduce max members below current member count (${group.memberCount})`);
      }

      const updateData: any = {
        updatedAt: Timestamp.now(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name;
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }

      if (updates.isPublic !== undefined) {
        updateData.isPublic = updates.isPublic;
      }

      if (updates.maxMembers !== undefined) {
        updateData.maxMembers = updates.maxMembers;
      }

      await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .update(updateData);

      logger.info(`Updated settings for group ${groupId}`);
    } catch (error) {
      logger.error('Error updating settings:', error);
      throw error;
    }
  }
}
