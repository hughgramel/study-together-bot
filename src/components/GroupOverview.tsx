/**
 * Group Overview - Detailed view of a group's stats and members
 *
 * Displays comprehensive information about a specific group including member leaderboard,
 * group level with progress bar, XP modifier, and capacity. Shows ranked members with
 * their contribution hours and empty slots for available positions. Rendered as an image
 * in Discord when users run the /group command.
 *
 * @module components/GroupOverview
 *
 * @example
 * <GroupOverview
 *   groupRank={1}
 *   groupName="Elite Learners"
 *   groupId="ABC123"
 *   currentMembers={3}
 *   maxMembers={5}
 *   groupLevel={15}
 *   totalXpModifier={0.15}
 *   currentLevelHours={45}
 *   nextLevelHours={50}
 *   nextLevelXpModifier={0.16}
 *   members={memberData}
 * />
 */

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

/**
 * Renders the group overview interface with member leaderboard and stats
 *
 * @param groupRank - Group's position in global leaderboard
 * @param groupName - Name of the group
 * @param groupId - Unique identifier for the group
 * @param currentMembers - Current number of members in the group
 * @param maxMembers - Maximum capacity of the group
 * @param groupLevel - Current level of the group
 * @param totalXpModifier - Current XP bonus multiplier (e.g., 0.15 = +15% XP)
 * @param currentLevelHours - Hours accumulated at current level
 * @param nextLevelHours - Hours required to reach next level
 * @param nextLevelXpModifier - XP modifier at next level
 * @param members - Array of group members with their stats
 * @returns Group overview component
 */
export const GroupOverview: React.FC<GroupOverviewProps> = ({
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
   *
   * @param rank - Member's rank within the group
   * @returns Trophy icon component or null for ranks 4+
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
   * Determines shield color CSS class based on group level tier
   *
   * @returns Tailwind CSS class for shield color (Bronze, Silver, Gold, Platinum, Diamond)
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
   *
   * @param hours - Number of hours to format
   * @returns Formatted string (e.g., "2hr" or "45m")
   */
  const formatHours = (hours: number) => {
    return hours >= 1 ? `${hours}hr` : `${Math.round(hours * 60)}m`;
  };

  // Calculate progress to next level
  const progressPercentage = (currentLevelHours / nextLevelHours) * 100;

  return (
    <div className="w-[700px] h-[700px] bg-[#131F24] flex flex-col px-8 py-8 pb-1">
      {/* Header with group name, ID, and capacity (no rank) */}
      <div className={description ? "mb-4 mt-2" : "mb-6 mt-2"}>
        <div className="flex items-baseline gap-3">
          <h1 className="text-[#EFEFEF] text-5xl font-extrabold">{groupName}</h1>
          <span className="text-[#AFAFAF] text-2xl font-bold">#{groupId}</span>
          <span className="text-[#AFAFAF] text-2xl font-bold ml-1">{currentMembers}/{maxMembers}</span>
        </div>
        {/* Description - appears right below the title */}
        {description && (
          <div className="mt-2">
            <p className="text-[#B8B8B8] text-2xl font-medium italic">{description}</p>
          </div>
        )}
      </div>

      {/* Group Leaderboard */}
      <div className="mb-0 mt-2">
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
              <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-[#2E3D44]">
                <img
                  src={member.avatarUrl}
                  alt={member.username}
                  className="w-full h-full object-cover"
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

              {/* Empty avatar placeholder */}
              <div className="w-12 h-12 rounded-lg border-2 border-dashed border-[#2E3D44]"></div>

              {/* Empty username */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-[#AFAFAF] italic">
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
              <span className="text-3xl font-extrabold text-[#131F24] mt-1">{groupLevel}</span>
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
              <span className="text-2xl text-[#EFEFEF] font-extrabold">
                {Math.max(0, nextLevelHours - currentLevelHours)}h until Level {groupLevel + 1}
              </span>
            </div>

            {/* Progress bar background */}
            <div className="w-full h-6 bg-[#1F2B31] rounded-lg border-2 border-[#2E3D44] overflow-hidden">
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
