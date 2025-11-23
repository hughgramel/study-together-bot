/**
 * Group Leaderboard - Ranked display of top groups
 *
 * Displays the top groups ranked by level and activity. Shows group details including
 * rank, level with color-coded shields, member capacity, and XP modifiers. Rendered as
 * an image in Discord when users run the /group_leaderboard command.
 *
 * @module components/GroupLeaderboard
 *
 * @example
 * <GroupLeaderboard
 *   groups={[
 *     { rank: 1, groupName: "Elite Learners", groupId: "ABC123", currentMembers: 5, maxMembers: 5, groupLevel: 25 }
 *   ]}
 * />
 */

import React from 'react';
import { Trophy, Users, Shield, Zap } from 'lucide-react';

interface GroupLeaderboardEntry {
  rank: number;
  groupName: string;
  groupId: string;
  currentMembers: number;
  maxMembers: number;
  groupLevel: number;
}

interface GroupLeaderboardProps {
  groups: GroupLeaderboardEntry[];
}

/**
 * Renders the group leaderboard interface
 *
 * @param groups - Array of top-ranked groups to display
 * @returns Group leaderboard component
 */
export const GroupLeaderboard: React.FC<GroupLeaderboardProps> = ({ groups }) => {
  /**
   * Gets the appropriate trophy icon for top 3 ranks
   *
   * @param rank - Group's rank position (1-10)
   * @returns Trophy icon component or null for ranks 4+
   */
  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return <Trophy className="w-7 h-7 text-[#FFD700]" fill="#FFD700" />;
    } else if (rank === 2) {
      return <Trophy className="w-7 h-7 text-[#C0C0C0]" fill="#C0C0C0" />;
    } else if (rank === 3) {
      return <Trophy className="w-7 h-7 text-[#CD7F32]" fill="#CD7F32" />;
    }
    return null;
  };

  /**
   * Determines shield color based on group level tier
   *
   * @param level - Group level (1-50+)
   * @returns Hex color code for the shield (Bronze, Silver, Gold, Platinum, Diamond)
   */
  const getShieldColor = (level: number) => {
    if (level <= 10) return '#CD7F32'; // Bronze
    if (level <= 20) return '#C0C0C0'; // Silver
    if (level <= 30) return '#FFD700'; // Gold
    if (level <= 40) return '#00CED1'; // Platinum
    return '#B9F2FF'; // Diamond
  };

  return (
    <div className="w-[700px] h-[650px] bg-[#131F24] flex flex-col px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-[#FFD700]" fill="#FFD700" />
          <h1 className="text-[#EFEFEF] text-4xl font-extrabold">Group Leaderboard</h1>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.rank}
            className="rounded-xl p-4 border-2 bg-[#1F2B31] border-[#2E3D44] flex items-center gap-4"
          >
            {/* Rank */}
            <div className="w-12 flex items-center justify-center">
              {getRankIcon(group.rank) || (
                <span className="text-3xl font-bold text-[#AFAFAF]">
                  {group.rank}
                </span>
              )}
            </div>

            {/* Group Level with Shield */}
            <div className="flex items-center gap-2">
              <Shield
                className="w-8 h-8"
                fill={getShieldColor(group.groupLevel)}
                style={{ color: getShieldColor(group.groupLevel) }}
              />
              <span className="text-2xl font-extrabold text-[#EFEFEF]">
                {group.groupLevel}
              </span>
            </div>

            {/* Group Name and ID */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[#EFEFEF] truncate max-w-[250px]">
                {group.groupName}
              </h3>
              <p className="text-base text-[#AFAFAF] font-semibold">
                #{group.groupId}
              </p>
            </div>

            {/* Capacity */}
            <div className="flex items-center gap-2 mr-2">
              <Users className="w-5 h-5 text-[#AFAFAF]" />
              <span className="text-xl font-bold text-[#EFEFEF]">
                {group.currentMembers}/{group.maxMembers}
              </span>
            </div>

            {/* XP Modifier */}
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#A78BFA]" fill="#A78BFA" />
              <span className="text-lg font-bold text-[#A78BFA]">
                +{(group.groupLevel * 1).toFixed(1)}% XP
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
