import React from 'react';
import { Trophy, Shield, Zap } from 'lucide-react';

interface GroupMember {
  username: string;
  avatarUrl: string;
  hours: number;
  rank: number;
}

interface GroupOverviewProps {
  groupRank: number;
  groupName: string;
  groupId: string;
  currentMembers: number;
  maxMembers: number;
  groupLevel: number;
  totalXpModifier: number;
  currentLevelHours: number;
  nextLevelHours: number;
  nextLevelXpModifier: number;
  members: GroupMember[];
}

export const GroupOverview: React.FC<GroupOverviewProps> = ({
  groupRank,
  groupName,
  groupId,
  currentMembers,
  maxMembers,
  groupLevel,
  totalXpModifier,
  currentLevelHours,
  nextLevelHours,
  nextLevelXpModifier,
  members,
}) => {
  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return <Trophy className="w-6 h-6 text-[#FFD700]" fill="#FFD700" />;
    } else if (rank === 2) {
      return <Trophy className="w-6 h-6 text-[#C0C0C0]" fill="#C0C0C0" />;
    } else if (rank === 3) {
      return <Trophy className="w-6 h-6 text-[#CD7F32]" fill="#CD7F32" />;
    }
    return null;
  };

  const getShieldColor = () => {
    if (groupLevel <= 10) return 'text-[#CD7F32]'; // Bronze
    if (groupLevel <= 20) return 'text-[#C0C0C0]'; // Silver
    if (groupLevel <= 30) return 'text-[#FFD700]'; // Gold
    if (groupLevel <= 40) return 'text-[#00CED1]'; // Platinum
    return 'text-[#B9F2FF]'; // Diamond
  };

  const formatHours = (hours: number) => {
    return hours >= 1 ? `${hours}hr` : `${Math.round(hours * 60)}m`;
  };

  // Calculate progress to next level
  const progressPercentage = (currentLevelHours / nextLevelHours) * 100;

  return (
    <div className="w-[700px] h-[700px] bg-[#131F24] flex flex-col p-8">
      {/* Header with group name, ID, and capacity (no rank) */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[#EFEFEF] text-3xl font-extrabold">{groupName}</h1>
          <span className="text-[#AFAFAF] text-xl font-semibold">#{groupId}</span>
          <span className="text-[#AFAFAF] text-xl font-semibold ml-1">{currentMembers}/{maxMembers}</span>
        </div>
      </div>

      {/* Group Leaderboard */}
      <div className="mb-2">
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.rank}
              className="rounded-xl p-3 border-2 bg-[#1F2B31] border-[#2E3D44] flex items-center gap-4"
            >
              {/* Rank */}
              <div className="w-10 flex items-center justify-center">
                {getRankIcon(member.rank) || (
                  <span className="text-2xl font-bold text-[#AFAFAF]">
                    {member.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] p-0.5">
                <img
                  src={member.avatarUrl}
                  alt={member.username}
                  className="w-full h-full rounded-full object-cover border-2 border-[#1F2B31]"
                />
              </div>

              {/* Username */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-[#EFEFEF] truncate max-w-[250px]">
                  {member.username}
                </h3>
              </div>

              {/* Hours */}
              <div className="text-right mr-2">
                <div className="text-2xl font-extrabold text-[#EFEFEF]">
                  {formatHours(member.hours)}
                </div>
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: maxMembers - members.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded-xl p-3 border-2 border-dashed bg-[#0F1A1E] border-[#2E3D44] flex items-center gap-4 opacity-40"
            >
              <div className="w-10 flex items-center justify-center">
                <span className="text-2xl font-bold text-[#AFAFAF]">
                  {members.length + i + 1}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#AFAFAF] italic">
                  (empty slot)
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Group Level and Progress Bar */}
      <div className="pt-6 mt-6">
        <div className="flex items-start gap-8">
          {/* Group Level - Shield with number inside */}
          <div className="relative flex-shrink-0">
            <Shield className={`w-20 h-20 ${getShieldColor()}`} fill="currentColor" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-extrabold text-[#131F24] mt-1">{groupLevel}</span>
            </div>
          </div>

          {/* Progress Bar to Next Level */}
          <div className="flex-1 pt-2">
            {/* XP Modifier above bar */}
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-6 h-6 text-[#A78BFA]" fill="#A78BFA" />
              <span className="text-lg font-bold text-[#A78BFA]">+{(totalXpModifier * 100).toFixed(1)}% XP</span>
            </div>

            {/* Progress bar background */}
            <div className="w-full h-8 bg-[#1F2B31] rounded-full border-2 border-[#2E3D44] overflow-hidden">
              {/* Progress bar fill */}
              <div
                className="h-full bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>

            {/* Hours text below bar */}
            <div className="mt-3 text-center">
              <span className="text-base text-[#AFAFAF] font-semibold">
                {Math.max(0, nextLevelHours - currentLevelHours)}h until Level {groupLevel + 1}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
