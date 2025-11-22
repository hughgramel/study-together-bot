/**
 * Unit tests for Group Button Handlers
 *
 * Tests button interactions for group deletion (confirm/cancel).
 * These tests verify:
 * - Confirm button deletes group and notifies members
 * - Cancel button cancels deletion
 * - Only the original user can confirm or cancel
 * - Handles non-existent groups gracefully
 * - Handles invalid button IDs
 *
 * Run with: npm test -- groupButtons.test.ts
 */

import { handleGroupButtons } from '../groupButtons';
import { GroupService } from '../../../services/groups';
import { ButtonInteraction, Client, Guild, GuildMember } from 'discord.js';
import { Firestore, Timestamp } from 'firebase-admin/firestore';

// Mock dependencies
jest.mock('../../../services/groups');
jest.mock('../../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('handleGroupButtons', () => {
  let mockInteraction: Partial<ButtonInteraction>;
  let mockDb: Partial<Firestore>;
  let mockClient: Partial<Client>;
  let mockGroupService: jest.Mocked<GroupService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Firestore
    mockDb = {} as Partial<Firestore>;

    // Mock Client
    mockClient = {
      users: {
        fetch: jest.fn(),
      } as any,
      guilds: {
        fetch: jest.fn(),
      } as any,
    };

    // Mock GroupService
    mockGroupService = {
      getGroup: jest.fn(),
      deleteGroup: jest.fn(),
      getGroupMembers: jest.fn(),
    } as any;

    (GroupService as jest.Mock).mockImplementation(() => mockGroupService);

    // Mock interaction base
    mockInteraction = {
      customId: '',
      user: {
        id: 'user123',
        username: 'testuser',
      } as any,
      reply: jest.fn().mockResolvedValue(undefined),
      deferUpdate: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      guildId: 'guild123',
    } as unknown as Partial<ButtonInteraction>;
  });

  describe('Group Deletion Confirmation', () => {
    it('should delete group and notify members when confirmed by original user', async () => {
      const groupId = 'GP-TEST';
      const originalUserId = 'user123';

      mockInteraction.customId = `groupadmin_delete_confirm:${groupId}:${originalUserId}`;

      // Mock group data
      const mockGroup = {
        groupId,
        name: 'Test Group',
        memberCount: 3,
        ownerId: originalUserId,
      };

      // Mock members data
      const mockMembers = [
        {
          membership: { userId: 'user123', username: 'owner', groupId, joinedAt: Timestamp.now(), isOwner: true },
          totalHours: 10,
          totalSessions: 5,
          currentStreak: 3,
        },
        {
          membership: { userId: 'user456', username: 'member1', groupId, joinedAt: Timestamp.now(), isOwner: false },
          totalHours: 8,
          totalSessions: 4,
          currentStreak: 2,
        },
        {
          membership: { userId: 'user789', username: 'member2', groupId, joinedAt: Timestamp.now(), isOwner: false },
          totalHours: 6,
          totalSessions: 3,
          currentStreak: 1,
        },
      ];

      mockGroupService.getGroup.mockResolvedValue(mockGroup as any);
      mockGroupService.getGroupMembers.mockResolvedValue(mockMembers as any);
      mockGroupService.deleteGroup.mockResolvedValue(undefined);

      // Mock users - only non-owner members should receive DMs
      const mockUser1 = {
        send: jest.fn().mockResolvedValue(undefined),
      };
      const mockUser2 = {
        send: jest.fn().mockResolvedValue(undefined),
      };

      // Mock client.users.fetch to return appropriate users
      (mockClient.users!.fetch as jest.Mock).mockImplementation((userId: string) => {
        if (userId === 'user456') return Promise.resolve(mockUser1);
        if (userId === 'user789') return Promise.resolve(mockUser2);
        return Promise.reject(new Error('User not found'));
      });

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      // Verify deferUpdate was called
      expect(mockInteraction.deferUpdate).toHaveBeenCalled();

      // Verify group was fetched and deleted
      expect(mockGroupService.getGroup).toHaveBeenCalledWith(groupId);
      expect(mockGroupService.deleteGroup).toHaveBeenCalledWith(groupId);

      // Verify success message
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Test Group'),
        components: [],
      });

      // Verify members were notified (excluding owner user123)
      // Only user456 and user789 should get DMs
      expect(mockUser1.send).toHaveBeenCalledWith(
        expect.stringContaining('Test Group')
      );
      expect(mockUser2.send).toHaveBeenCalledWith(
        expect.stringContaining('Test Group')
      );
    });

    it('should reject confirmation from non-original user', async () => {
      const groupId = 'GP-TEST';
      const originalUserId = 'user456'; // Different from interaction user

      mockInteraction.customId = `groupadmin_delete_confirm:${groupId}:${originalUserId}`;

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      // Verify error message
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Only the user who initiated the deletion'),
        ephemeral: true,
      });

      // Verify group was not deleted
      expect(mockGroupService.deleteGroup).not.toHaveBeenCalled();
    });

    it('should handle non-existent group gracefully', async () => {
      const groupId = 'GP-GONE';
      const originalUserId = 'user123';

      mockInteraction.customId = `groupadmin_delete_confirm:${groupId}:${originalUserId}`;

      // Mock group not found
      mockGroupService.getGroup.mockResolvedValue(null);

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      expect(mockInteraction.deferUpdate).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Group not found'),
        components: [],
      });

      // Verify deleteGroup was not called
      expect(mockGroupService.deleteGroup).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const groupId = 'GP-TEST';
      const originalUserId = 'user123';

      mockInteraction.customId = `groupadmin_delete_confirm:${groupId}:${originalUserId}`;

      const mockGroup = {
        groupId,
        name: 'Test Group',
        memberCount: 1,
      };

      mockGroupService.getGroup.mockResolvedValue(mockGroup as any);
      mockGroupService.getGroupMembers.mockResolvedValue([]);
      mockGroupService.deleteGroup.mockRejectedValue(new Error('Database error'));

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Failed to delete group'),
        components: [],
      });
    });

    it('should handle DM failures gracefully', async () => {
      const groupId = 'GP-TEST';
      const originalUserId = 'user123';

      mockInteraction.customId = `groupadmin_delete_confirm:${groupId}:${originalUserId}`;

      const mockGroup = {
        groupId,
        name: 'Test Group',
        memberCount: 2,
        ownerId: originalUserId,
      };

      const mockMembers = [
        {
          membership: { userId: 'user123', username: 'owner', groupId, joinedAt: Timestamp.now(), isOwner: true },
          totalHours: 10,
          totalSessions: 5,
          currentStreak: 3,
        },
        {
          membership: { userId: 'user456', username: 'member1', groupId, joinedAt: Timestamp.now(), isOwner: false },
          totalHours: 8,
          totalSessions: 4,
          currentStreak: 2,
        },
      ];

      mockGroupService.getGroup.mockResolvedValue(mockGroup as any);
      mockGroupService.getGroupMembers.mockResolvedValue(mockMembers as any);
      mockGroupService.deleteGroup.mockResolvedValue(undefined);

      // Mock member that can't receive DMs
      const mockMember = {
        send: jest.fn().mockRejectedValue(new Error('Cannot send DM')),
      };

      const mockGuild = {
        members: {
          fetch: jest.fn().mockResolvedValue(mockMember),
        },
      };

      (mockClient.guilds!.fetch as jest.Mock).mockResolvedValue(mockGuild);

      // Should not throw
      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      // Verify deletion still completed
      expect(mockGroupService.deleteGroup).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('permanently deleted'),
        components: [],
      });
    });
  });

  describe('Group Deletion Cancellation', () => {
    it('should cancel deletion when requested by original user', async () => {
      const groupId = 'GP-TEST';
      const originalUserId = 'user123';

      mockInteraction.customId = `groupadmin_delete_cancel:${groupId}:${originalUserId}`;

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      expect(mockInteraction.update).toHaveBeenCalledWith({
        content: expect.stringContaining('cancelled'),
        components: [],
      });

      // Verify no deletion occurred
      expect(mockGroupService.deleteGroup).not.toHaveBeenCalled();
    });

    it('should reject cancellation from non-original user', async () => {
      const groupId = 'GP-TEST';
      const originalUserId = 'user456'; // Different from interaction user

      mockInteraction.customId = `groupadmin_delete_cancel:${groupId}:${originalUserId}`;

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Only the user who initiated the deletion'),
        ephemeral: true,
      });

      // Verify update was not called
      expect(mockInteraction.update).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Button IDs', () => {
    it('should handle malformed confirm button ID', async () => {
      mockInteraction.customId = 'groupadmin_delete_confirm:INVALID';

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      // Should not crash - the function will return early due to user ID mismatch
      expect(mockInteraction.deferUpdate).not.toHaveBeenCalled();
    });

    it('should handle malformed cancel button ID', async () => {
      mockInteraction.customId = 'groupadmin_delete_cancel:INVALID';

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      // Should not crash - the function will return early due to user ID mismatch
      expect(mockInteraction.update).not.toHaveBeenCalled();
    });

    it('should do nothing for unrecognized button IDs', async () => {
      mockInteraction.customId = 'some_other_button';

      await handleGroupButtons(
        mockInteraction as ButtonInteraction,
        mockDb as Firestore,
        mockClient as Client
      );

      // No interactions should occur
      expect(mockInteraction.reply).not.toHaveBeenCalled();
      expect(mockInteraction.deferUpdate).not.toHaveBeenCalled();
      expect(mockInteraction.update).not.toHaveBeenCalled();
      expect(mockGroupService.deleteGroup).not.toHaveBeenCalled();
    });
  });
});
