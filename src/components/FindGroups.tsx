/**
 * Find Groups - Group discovery and browsing interface
 *
 * Displays a paginated list of available groups that users can browse and join.
 * Shows group details including level, member count, capacity, and XP modifiers.
 * Rendered as an image in Discord when users run the /find_groups command.
 *
 * @module components/FindGroups
 *
 * @example
 * <FindGroups
 *   groups={groupsData}
 *   currentPage={1}
 *   totalPages={5}
 * />
 */

import React from 'react';
import { Search, Users, Shield, Zap } from 'lucide-react';

interface FindGroupsEntry {
  groupId: string;
  groupName: string;
  groupLevel: number;
  currentMembers: number;
  maxMembers: number;
  xpModifier: number;
}

interface FindGroupsProps {
  groups: FindGroupsEntry[];
  currentPage: number;
  totalPages: number;
}

/**
 * Renders the group discovery interface
 *
 * @param groups - Array of available groups to display
 * @param currentPage - Current page number for pagination
 * @param totalPages - Total number of pages available
 * @returns Find groups interface component
 */
export const FindGroups: React.FC<FindGroupsProps> = ({ groups, currentPage, totalPages }) => {
  /**
   * Determines shield color based on group level
   *
   * @param level - Group level (1-50+)
   * @returns Hex color code for the shield
   */
  const getShieldColor = (level: number) => {
    if (level <= 10) return '#CD7F32'; // Bronze
    if (level <= 20) return '#C0C0C0'; // Silver
    if (level <= 30) return '#FFD700'; // Gold
    if (level <= 40) return '#00CED1'; // Platinum
    return '#B9F2FF'; // Diamond
  };

  return (
    <div className="w-[700px] h-[650px] bg-[#131F24] flex flex-col px-8 py-8">
      {/* Header */}
      <div className="mb-6 mt-2">
        <div className="flex items-center gap-3">
          <Search className="w-10 h-10 text-[#0080FF]" />
          <h1 className="text-[#EFEFEF] text-4xl font-extrabold">Find Groups</h1>
        </div>
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.groupId}
            className="rounded-xl p-4 border-2 bg-[#1F2B31] border-[#2E3D44] flex items-center gap-4"
          >
            {/* Group Level with Shield */}
            <div className="relative flex-shrink-0">
              <Shield
                className="w-12 h-12"
                fill={getShieldColor(group.groupLevel)}
                style={{ color: getShieldColor(group.groupLevel) }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-extrabold text-[#1a1a1a] mt-0.5">{group.groupLevel}</span>
              </div>
            </div>

            {/* Group Name and ID */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[#EFEFEF] truncate max-w-[250px]">
                {group.groupName}
              </h3>
              <p className="text-xl text-[#AFAFAF] font-semibold">
                #{group.groupId}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3">
              {/* Members */}
              <div className="flex items-center gap-2 mr-2">
                <Users className="w-5 h-5 text-[#AFAFAF]" />
                <span className="text-xl font-bold text-[#EFEFEF]">
                  {group.currentMembers}/{group.maxMembers}
                </span>
              </div>

              {/* XP Modifier */}
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#A78BFA]" fill="#A78BFA" />
                <span className="text-lg font-extrabold text-[#A78BFA]">
                  +{(group.xpModifier * 100).toFixed(1)}% XP
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
