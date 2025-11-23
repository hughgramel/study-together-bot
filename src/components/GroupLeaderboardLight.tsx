/**
 * Group Leaderboard Light Mode - Ranked display with Duolingo-inspired styling
 *
 * Light mode version with white backgrounds and vibrant accents.
 *
 * @module components/GroupLeaderboardLight
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

interface GroupLeaderboardLightProps {
  groups: GroupLeaderboardEntry[];
}

export const GroupLeaderboardLight: React.FC<GroupLeaderboardLightProps> = ({ groups }) => {
  /**
   * Gets the appropriate trophy icon for top 3 ranks
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
   */
  const getShieldColor = (level: number) => {
    if (level <= 10) return '#CD7F32'; // Bronze
    if (level <= 20) return '#C0C0C0'; // Silver
    if (level <= 30) return '#FFD700'; // Gold
    if (level <= 40) return '#00CED1'; // Platinum
    return '#B9F2FF'; // Diamond
  };

  return (
    <div className="w-[700px] h-[650px] bg-white flex flex-col px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-[#FFD700]" fill="#FFD700" />
          <h1 className="text-[#3C3C3C] text-4xl font-extrabold">Group Leaderboard</h1>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.rank}
            className="rounded-xl p-4 border-2 bg-white border-[#E5E5E5] flex items-center gap-4"
          >
            {/* Rank */}
            <div className="w-12 flex items-center justify-center">
              {getRankIcon(group.rank) || (
                <span className="text-3xl font-bold text-[#777777]">
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
              <span className="text-2xl font-extrabold text-[#3C3C3C]">
                {group.groupLevel}
              </span>
            </div>

            {/* Group Name and ID */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[#3C3C3C] truncate max-w-[250px]">
                {group.groupName}
              </h3>
              <p className="text-xl text-[#666666] font-semibold">
                #{group.groupId}
              </p>
            </div>

            {/* Capacity */}
            <div className="flex items-center gap-2 mr-2">
              <Users className="w-5 h-5 text-[#666666]" />
              <span className="text-xl font-bold text-[#3C3C3C]">
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
