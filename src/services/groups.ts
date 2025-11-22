/**
 * Group Service - Manages study groups and group memberships
 *
 * Handles creation, management, and tracking of study groups. Groups are collaborative
 * teams of up to 5 members who earn XP bonuses based on group level. Features include:
 * - Group creation with unique IDs (e.g., GP-A1B2)
 * - Member management (join, leave, kick)
 * - Group leveling based on collective study hours
 * - XP bonus modifiers for group members
 * - Public/private group visibility
 * - Group leaderboards and rankings
 *
 * @module services/groups
 */

import { Firestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Group record - represents a study group
 */
export interface Group {
  groupId: string;          // Unique group ID (e.g., 'GP-A1B2')
  name: string;             // Group name
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
   * Generates a unique group ID in format GP-XXXX
   *
   * @returns Random group ID (e.g., "GP-A1B2")
   * @private
   */
  private generateGroupId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'GP-';
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
   */
  async createGroup(
    name: string,
    ownerId: string,
    ownerUsername: string,
    serverId: string,
    options?: {
      isPublic?: boolean;
      maxMembers?: number;
    }
  ): Promise<Group> {
    try {
      // Generate unique group ID
      const groupId = this.generateGroupId();
      const now = Timestamp.now();

      const group: Group = {
        groupId,
        name,
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
        .doc(groupId)
        .set(group);

      // Create owner's membership
      const membership: GroupMembership = {
        userId: ownerId,
        username: ownerUsername,
        groupId,
        joinedAt: now,
        isOwner: true,
      };

      await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(ownerId)
        .set(membership);

      console.log(`[GROUP CREATE] Created group ${groupId} (${name}) by ${ownerUsername}`);

      return group;
    } catch (error) {
      console.error('[GROUP CREATE] Error creating group:', error);
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
      console.error('[GROUP GET] Error getting group:', error);
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
      console.error('[GROUP GET USER] Error getting user group:', error);
      return null;
    }
  }

  /**
   * Add a member to a group
   */
  async addMemberToGroup(
    groupId: string,
    userId: string,
    username: string
  ): Promise<void> {
    try {
      const group = await this.getGroup(groupId);

      if (!group) {
        throw new Error('Group not found');
      }

      // Check if group has space
      if (group.memberCount >= group.maxMembers) {
        throw new Error('Group is full');
      }

      // Check if user is already in a group
      const existingMembership = await this.getUserGroup(userId);
      if (existingMembership) {
        throw new Error('User is already in a group');
      }

      const now = Timestamp.now();

      // Create membership
      const membership: GroupMembership = {
        userId,
        username,
        groupId,
        joinedAt: now,
        isOwner: false,
      };

      await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(userId)
        .set(membership);

      // Update group member count
      await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .update({
          memberCount: group.memberCount + 1,
          updatedAt: now,
        });

      console.log(`[GROUP ADD MEMBER] Added ${username} to group ${groupId}`);
    } catch (error) {
      console.error('[GROUP ADD MEMBER] Error adding member:', error);
      throw error;
    }
  }

  /**
   * Remove a member from a group
   */
  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    try {
      const group = await this.getGroup(groupId);

      if (!group) {
        throw new Error('Group not found');
      }

      // Delete membership
      await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(userId)
        .delete();

      const now = Timestamp.now();

      // Update group member count
      await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .update({
          memberCount: group.memberCount - 1,
          updatedAt: now,
        });

      console.log(`[GROUP REMOVE MEMBER] Removed user ${userId} from group ${groupId}`);
    } catch (error) {
      console.error('[GROUP REMOVE MEMBER] Error removing member:', error);
      throw error;
    }
  }

  /**
   * Delete entire group and all memberships
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

      // Delete all memberships
      const deletePromises = membershipsSnapshot.docs.map((doc) =>
        doc.ref.delete()
      );
      await Promise.all(deletePromises);

      // Delete the group
      await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .delete();

      console.log(`[GROUP DELETE] Deleted group ${groupId} and ${membershipsSnapshot.size} memberships`);
    } catch (error) {
      console.error('[GROUP DELETE] Error deleting group:', error);
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
      console.error('[GROUP GET PUBLIC] Error getting public groups:', error);
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
        console.log(`[GROUP UPDATE STATS] No members found for group ${groupId}`);
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

      console.log(`[GROUP UPDATE STATS] Updated group ${groupId}: ${totalHours.toFixed(1)}h, level ${newLevel}`);
    } catch (error) {
      console.error('[GROUP UPDATE STATS] Error updating group stats:', error);
      throw error;
    }
  }

  /**
   * Transfer group ownership to another member
   */
  async transferOwnership(
    groupId: string,
    newOwnerId: string,
    newOwnerUsername: string
  ): Promise<void> {
    try {
      const group = await this.getGroup(groupId);

      if (!group) {
        throw new Error('Group not found');
      }

      // Verify new owner is a member of the group
      const newOwnerMembership = await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(newOwnerId)
        .get();

      if (!newOwnerMembership.exists || newOwnerMembership.data()?.groupId !== groupId) {
        throw new Error('New owner is not a member of this group');
      }

      const now = Timestamp.now();

      // Update old owner's membership
      await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(group.ownerId)
        .update({
          isOwner: false,
        });

      // Update new owner's membership
      await this.db
        .collection('discord-data')
        .doc('groupMembers')
        .collection('memberships')
        .doc(newOwnerId)
        .update({
          isOwner: true,
        });

      // Update group ownership
      await this.db
        .collection('discord-data')
        .doc('groups')
        .collection('active')
        .doc(groupId)
        .update({
          ownerId: newOwnerId,
          ownerUsername: newOwnerUsername,
          updatedAt: now,
        });

      console.log(`[GROUP TRANSFER] Transferred ownership of ${groupId} to ${newOwnerUsername}`);
    } catch (error) {
      console.error('[GROUP TRANSFER] Error transferring ownership:', error);
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
      console.error('[GROUP CHECK OWNER] Error checking ownership:', error);
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
      console.error('[GROUP CHECK SPACE] Error checking space:', error);
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
      console.error('[GROUP GET MEMBERS] Error getting group members:', error);
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
      console.error('[GROUP GET ALL SERVER] Error getting server groups:', error);
      return [];
    }
  }

  /**
   * Update group settings (name, public status, max members)
   * Only owner can update group settings
   */
  async updateGroupSettings(
    groupId: string,
    updates: {
      name?: string;
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

      console.log(`[GROUP UPDATE SETTINGS] Updated settings for group ${groupId}`);
    } catch (error) {
      console.error('[GROUP UPDATE SETTINGS] Error updating settings:', error);
      throw error;
    }
  }
}
