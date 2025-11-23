/**
 * Profile Card Light Mode - User profile with Duolingo-inspired styling
 *
 * Light mode version of ProfileCard with white backgrounds, soft borders,
 * and vibrant gradient accents. Features the same 2x3 grid layout.
 *
 * @module components/ProfileCardLight
 */

import React from 'react';
import { xpForLevel, levelProgress } from '../utils/xp';
import { Flame, Zap, Award, BookOpen, Timer, User, Shield } from 'lucide-react';

interface ProfileCardLightProps {
  username: string;
  avatarUrl?: string;
  streak: number;
  xp: number;
  level: number;
  totalSessions: number;
  achievementCount: number;
  longestStreak: number;
  totalHours: number;
  groupName?: string;
  groupId?: string;
  groupLevel?: number;
}

export const ProfileCardLight: React.FC<ProfileCardLightProps> = ({
  username,
  avatarUrl,
  streak,
  xp,
  level,
  totalSessions,
  achievementCount,
  longestStreak,
  totalHours,
  groupName,
  groupId,
  groupLevel,
}) => {
  // Calculate XP progress for the level bar
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercent = levelProgress(xp);

  /**
   * Determines shield color based on group level tier
   */
  const getShieldColor = () => {
    if (!groupLevel) return 'text-[#CD7F32]'; // Default bronze
    if (groupLevel <= 10) return 'text-[#CD7F32]'; // Bronze
    if (groupLevel <= 20) return 'text-[#C0C0C0]'; // Silver
    if (groupLevel <= 30) return 'text-[#FFD700]'; // Gold
    if (groupLevel <= 40) return 'text-[#00CED1]'; // Platinum
    return 'text-[#B9F2FF]'; // Diamond
  };

  // Calculate user level XP bonus (0.1% per level)
  const userLevelBonus = level * 0.1;

  /**
   * Determines shield color based on user level tier
   */
  const getUserShieldColor = () => {
    if (level <= 20) return 'text-[#CD7F32]'; // Bronze
    if (level <= 40) return 'text-[#C0C0C0]'; // Silver
    if (level <= 60) return 'text-[#FFD700]'; // Gold
    if (level <= 80) return 'text-[#00CED1]'; // Platinum
    return 'text-[#B9F2FF]'; // Diamond
  };

  return (
    <div className="w-[700px] h-[650px] bg-white flex flex-col p-10 pb-6 relative">
      {/* Level Shield and XP Boost - Top Left of Progress Bar */}
      <div className="absolute top-11 right-16 w-80">
        <div className="flex items-center gap-3 mb-2">
          {/* Level Shield */}
          <div className="relative flex-shrink-0">
            <Shield className={`w-12 h-12 ${getUserShieldColor()}`} fill="currentColor" />
            <span className="absolute inset-0 flex items-center justify-center text-black text-lg font-extrabold" style={{ paddingTop: '2px' }}>
              {level}
            </span>
          </div>
          {/* XP Boost */}
          <div className="flex items-center gap-1.5">
            <Zap className="w-5 h-5 text-[#CE82FF]" fill="#CE82FF" />
            <span className="text-[#CE82FF] text-xl font-bold">+{userLevelBonus.toFixed(1)}%</span>
          </div>
          {/* XP Progress - pushed to the right */}
          <span className="text-[#555555] text-xl font-semibold ml-auto">{Math.floor(xpInCurrentLevel)} / {xpNeededForNextLevel} XP</span>
        </div>
        <div className="h-5 bg-[#E5E5E5] rounded-full overflow-hidden border-2 border-[#D7D7D7]">
          <div
            className="h-full bg-gradient-to-r from-[#FFD900] to-[#FFAA00] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Profile Section */}
      <div className="flex items-center gap-6 mb-6">
        {avatarUrl ? (
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] p-1">
              <img
                src={avatarUrl}
                alt={username}
                className="w-full h-full rounded-full object-cover border-4 border-white"
              />
            </div>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] flex items-center justify-center border-4 border-white">
            <User className="w-14 h-14 text-white" />
          </div>
        )}
        <div className="flex flex-col">
          <h2 className="text-[#3C3C3C] text-3xl font-extrabold">
            {username.length > 10 ? username.substring(0, 10) + '...' : username}
          </h2>
          {groupName && (
            <div className="mt-2">
              <span className="text-[#666666] text-lg font-semibold">
                {groupName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid - 3 rows x 2 cols */}
      <div className="grid grid-cols-2 gap-4">
        {/* Row 1 Left: Total XP Card */}
        <div className="bg-white rounded-2xl p-6 border-2 border-[#E5E5E5]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#CE82FF] to-[#A855F7] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#3C3C3C] leading-none mb-2">{xp.toLocaleString()}</div>
              <div className="text-xl font-semibold text-[#666666]">Total XP</div>
            </div>
          </div>
        </div>

        {/* Row 1 Right: Total Time Card */}
        <div className="bg-white rounded-2xl p-6 border-2 border-[#E5E5E5]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1CB0F6] to-[#0088CC] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Timer className="w-9 h-9 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#3C3C3C] leading-none mb-2">{totalHours}h</div>
              <div className="text-xl font-semibold text-[#666666]">Total time</div>
            </div>
          </div>
        </div>

        {/* Row 2 Left: Sessions Card */}
        <div className="bg-white rounded-2xl p-6 border-2 border-[#E5E5E5]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#58CC02] to-[#45A000] rounded-2xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-9 h-9 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#3C3C3C] leading-none mb-2">{totalSessions}</div>
              <div className="text-xl font-semibold text-[#666666]">Sessions</div>
            </div>
          </div>
        </div>

        {/* Row 2 Right: Achievements Card */}
        <div className="bg-white rounded-2xl p-6 border-2 border-[#E5E5E5]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FFD900] to-[#FFAA00] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Award className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#3C3C3C] leading-none mb-2">{achievementCount}</div>
              <div className="text-xl font-semibold text-[#666666]">Achievements</div>
            </div>
          </div>
        </div>

        {/* Row 3 Left: Day Streak Card */}
        <div className="bg-white rounded-2xl p-6 border-2 border-[#E5E5E5]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF9600] to-[#FF6B00] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Flame className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#3C3C3C] leading-none mb-2">{streak}</div>
              <div className="text-xl font-semibold text-[#666666]">Day streak</div>
            </div>
          </div>
        </div>

        {/* Row 3 Right: Best Streak Card */}
        <div className="bg-white rounded-2xl p-6 border-2 border-[#E5E5E5]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Flame className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#3C3C3C] leading-none mb-2">{longestStreak}</div>
              <div className="text-xl font-semibold text-[#666666]">Best streak</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
