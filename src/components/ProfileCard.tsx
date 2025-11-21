import React from 'react';
import { xpForLevel, levelProgress } from '../utils/xp';
import { Flame, Zap, Award, BookOpen, Timer } from 'lucide-react';

interface ProfileCardProps {
  username: string;
  avatarUrl?: string;
  streak: number;
  xp: number;
  level: number;
  totalSessions: number;
  achievementCount: number;
  longestStreak: number;
  totalHours: number;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  username,
  avatarUrl,
  streak,
  xp,
  level,
  totalSessions,
  achievementCount,
  longestStreak,
  totalHours,
}) => {
  // Calculate XP progress for the level bar
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercent = levelProgress(xp);

  return (
    <div className="w-[700px] h-[650px] bg-[#131F24] flex flex-col p-10 pb-6 relative">
      {/* Level Progress Bar - Top Right */}
      <div className="absolute top-11 right-16 w-80">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[#EFEFEF] text-xl font-bold">Level {level}</span>
          <span className="text-[#AFAFAF] text-base font-normal">{Math.floor(xpInCurrentLevel)} / {xpNeededForNextLevel} XP</span>
        </div>
        <div className="h-5 bg-[#1F2B31] rounded-full overflow-hidden border border-[#2E3D44]">
          <div
            className="h-full bg-[#ffd900] rounded-full transition-all duration-300"
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
                className="w-full h-full rounded-full object-cover border-4 border-[#1F2B31]"
              />
            </div>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] flex items-center justify-center text-5xl border-4 border-[#1F2B31]">
            👤
          </div>
        )}
        <div className="flex flex-col">
          <h2 className="text-[#EFEFEF] text-3xl font-extrabold">
            {username}
          </h2>
        </div>
      </div>

      {/* Stats Grid - 3 rows x 2 cols */}
      <div className="grid grid-cols-2 gap-4">
        {/* Row 1 Left: Total XP Card */}
        <div className="bg-[#1F2B31] rounded-2xl p-6 border-2 border-[#2E3D44]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FFD900] to-[#FFAA00] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#EFEFEF] leading-none mb-2">{xp.toLocaleString()}</div>
              <div className="text-lg font-normal text-[#AFAFAF]">Total XP</div>
            </div>
          </div>
        </div>

        {/* Row 1 Right: Total Time Card */}
        <div className="bg-[#1F2B31] rounded-2xl p-6 border-2 border-[#2E3D44]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1CB0F6] to-[#0088CC] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Timer className="w-9 h-9 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#EFEFEF] leading-none mb-2">{totalHours}h</div>
              <div className="text-lg font-normal text-[#AFAFAF]">Total time</div>
            </div>
          </div>
        </div>

        {/* Row 2 Left: Sessions Card */}
        <div className="bg-[#1F2B31] rounded-2xl p-6 border-2 border-[#2E3D44]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#58CC02] to-[#45A000] rounded-2xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-9 h-9 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#EFEFEF] leading-none mb-2">{totalSessions}</div>
              <div className="text-lg font-normal text-[#AFAFAF]">Sessions</div>
            </div>
          </div>
        </div>

        {/* Row 2 Right: Achievements Card */}
        <div className="bg-[#1F2B31] rounded-2xl p-6 border-2 border-[#2E3D44]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#CE82FF] to-[#A855F7] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Award className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#EFEFEF] leading-none mb-2">{achievementCount}</div>
              <div className="text-lg font-normal text-[#AFAFAF]">Achievements</div>
            </div>
          </div>
        </div>

        {/* Row 3 Left: Day Streak Card */}
        <div className="bg-[#1F2B31] rounded-2xl p-6 border-2 border-[#2E3D44]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF9600] to-[#FF6B00] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Flame className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#EFEFEF] leading-none mb-2">{streak}</div>
              <div className="text-lg font-normal text-[#AFAFAF]">Day streak</div>
            </div>
          </div>
        </div>

        {/* Row 3 Right: Best Streak Card */}
        <div className="bg-[#1F2B31] rounded-2xl p-6 border-2 border-[#2E3D44]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF6B6B] to-[#EE5A6F] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Flame className="w-9 h-9 text-white" fill="white" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-5xl font-extrabold text-[#EFEFEF] leading-none mb-2">{longestStreak}</div>
              <div className="text-lg font-normal text-[#AFAFAF]">Best streak</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
