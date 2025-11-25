/**
 * Group Overview Light Mode - Group stats with Duolingo-inspired styling
 *
 * Light mode version with white backgrounds and vibrant accents.
 *
 * @module components/GroupOverviewLight
 */

import React from 'react';
import { Trophy, Shield, Zap } from 'lucide-react';

interface GroupMember {
  username: string;
  avatarUrl: string;
  hours: number;
  rank: number;
}

interface GroupOverviewLightProps {
  groupRank: number;
  groupName: string;
  groupId: string;
  description?: string;
  currentMembers: number;
  maxMembers: number;
  groupLevel: number;
  totalXpModifier: number;
  currentLevelHours: number;
  nextLevelHours: number;
  nextLevelXpModifier: number;
  members: GroupMember[];
}

export const GroupOverviewLight: React.FC<GroupOverviewLightProps> = ({
  groupRank,
  groupName,
  groupId,
  description,
  currentMembers,
  maxMembers,
  groupLevel,
  totalXpModifier,
  currentLevelHours,
  nextLevelHours,
  nextLevelXpModifier,
  members,
}) => {
  /**
   * Gets the appropriate trophy icon for top 3 member ranks
   */
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

  /**
   * Determines shield color based on group level tier
   */
  const getShieldColor = () => {
    if (groupLevel <= 10) return 'text-[#CD7F32]'; // Bronze
    if (groupLevel <= 20) return 'text-[#C0C0C0]'; // Silver
    if (groupLevel <= 30) return 'text-[#FFD700]'; // Gold
    if (groupLevel <= 40) return 'text-[#00CED1]'; // Platinum
    return 'text-[#B9F2FF]'; // Diamond
  };

  /**
   * Formats hours for compact display
   */
  const formatHours = (hours: number) => {
    return hours >= 1 ? `${hours}hr` : `${Math.round(hours * 60)}m`;
  };

  // Calculate progress to next level
  const progressPercentage = (currentLevelHours / nextLevelHours) * 100;

  return (
    <div className="w-[700px] h-[700px] bg-white flex flex-col px-8 py-8 pb-1">
      {/* Header with group name, ID, and capacity */}
      <div className={description ? "mb-4 mt-2" : "mb-6 mt-2"}>
        <div className="flex items-baseline gap-3">
          <h1 className="text-[#3C3C3C] text-5xl font-extrabold">{groupName}</h1>
          <span className="text-[#666666] text-3xl font-bold">#{groupId}</span>
          <span className="text-[#666666] text-3xl font-bold ml-1">{currentMembers}/{maxMembers}</span>
        </div>
        {/* Description - appears right below the title */}
        {description && (
          <div className="mt-2">
            <p className="text-[#5A5A5A] text-2xl font-medium italic">{description}</p>
          </div>
        )}
      </div>

      {/* Group Leaderboard */}
      <div className="mb-0 mt-2">
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.rank}
              className="rounded-xl p-3 border-2 bg-white border-[#E5E5E5] flex items-center gap-4"
            >
              {/* Rank */}
              <div className="w-10 flex items-center justify-center">
                {getRankIcon(member.rank) || (
                  <span className="text-2xl font-bold text-[#777777]">
                    {member.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-[#E5E5E5]">
                <img
                  src={member.avatarUrl}
                  alt={member.username}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Username */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-[#3C3C3C] truncate max-w-[250px]">
                  {member.username}
                </h3>
              </div>

              {/* Hours */}
              <div className="text-right mr-2">
                <div className="text-2xl font-extrabold text-[#3C3C3C]">
                  {formatHours(member.hours)}
                </div>
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: maxMembers - members.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="rounded-xl p-3 border-2 border-dashed bg-[#F7F7F7] border-[#D7D7D7] flex items-center gap-4"
            >
              <div className="w-10 flex items-center justify-center">
                <span className="text-2xl font-bold text-[#777777]">
                  {members.length + i + 1}
                </span>
              </div>

              {/* Empty avatar placeholder */}
              <div className="w-12 h-12 rounded-lg border-2 border-dashed border-[#D7D7D7]"></div>

              {/* Empty username */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-[#888888] italic">
                  Empty slot
                </h3>
              </div>

              {/* Empty hours placeholder */}
              <div className="text-right mr-2">
                <div className="text-2xl font-extrabold text-transparent">
                  0hr
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Group Level and Progress Bar */}
      <div className="pt-4 mt-4">
        <div className="flex gap-6">
          {/* Group Level - Shield with number inside */}
          <div className="relative flex-shrink-0">
            <Shield className={`w-20 h-20 ${getShieldColor()}`} fill="currentColor" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-extrabold text-white mt-1">{groupLevel}</span>
            </div>
          </div>

          {/* XP Modifier and Progress Bar */}
          <div className="flex-1 flex flex-col justify-center gap-2">
            <div className="flex items-center justify-between">
              {/* XP Modifier */}
              <div className="flex items-center gap-2">
                <Zap className="w-8 h-8 text-[#A78BFA]" fill="#A78BFA" />
                <span className="text-2xl font-extrabold text-[#A78BFA]">+{(totalXpModifier * 100).toFixed(1)}% XP</span>
              </div>

              {/* Hours text */}
              <span className="text-2xl text-[#3C3C3C] font-extrabold">
                {Math.max(0, nextLevelHours - currentLevelHours)}h until Level {groupLevel + 1}
              </span>
            </div>

            {/* Progress bar background */}
            <div className="w-full h-6 bg-[#E5E5E5] rounded-lg border-2 border-[#D7D7D7] overflow-hidden">
              {/* Progress bar fill */}
              <div
                className="h-full bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] transition-all duration-300"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
