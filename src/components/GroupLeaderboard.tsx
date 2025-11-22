import React from 'react';
import { Trophy, Users } from 'lucide-react';

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

export const GroupLeaderboard: React.FC<GroupLeaderboardProps> = ({ groups }) => {
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

  const getShieldColor = (level: number) => {
    if (level <= 10) return '#CD7F32'; // Bronze
    if (level <= 20) return '#C0C0C0'; // Silver
    if (level <= 30) return '#FFD700'; // Gold
    if (level <= 40) return '#00CED1'; // Platinum
    return '#B9F2FF'; // Diamond
  };

  return (
    <div className="w-[700px] h-[700px] bg-[#131F24] flex flex-col p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-[#FFD700]" fill="#FFD700" />
          <h1 className="text-[#EFEFEF] text-4xl font-extrabold">Group Leaderboard</h1>
        </div>
        <p className="text-[#AFAFAF] text-lg mt-2">Top groups ranked by level</p>
      </div>

      {/* Leaderboard */}
      <div className="flex-1 space-y-3">
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

            {/* Group Level Badge */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-2xl text-white"
              style={{
                backgroundColor: getShieldColor(group.groupLevel),
                boxShadow: `0 0 20px ${getShieldColor(group.groupLevel)}40`
              }}
            >
              {group.groupLevel}
            </div>

            {/* Group Name */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[#EFEFEF] truncate max-w-[280px]">
                {group.groupName}
              </h3>
            </div>

            {/* Capacity */}
            <div className="flex items-center gap-2 mr-2">
              <Users className="w-5 h-5 text-[#AFAFAF]" />
              <span className="text-xl font-bold text-[#EFEFEF]">
                {group.currentMembers}/{group.maxMembers}
              </span>
            </div>

            {/* Group ID */}
            <div className="text-right">
              <span className="text-xl font-semibold text-[#AFAFAF]">
                #{group.groupId}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
