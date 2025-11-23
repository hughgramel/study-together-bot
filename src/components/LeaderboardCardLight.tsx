/**
 * Leaderboard Card Light Mode - Competitive ranking with Duolingo-inspired styling
 *
 * Light mode version with white backgrounds and vibrant accents.
 *
 * @module components/LeaderboardCardLight
 */

import React from 'react';
import { calculateLevel } from '../utils/xp';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string;
  xp: number;
  totalDuration: number;
  rank: number;
}

interface LeaderboardCardLightProps {
  timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time';
  entries: LeaderboardEntry[];
  currentUser?: LeaderboardEntry;
  currentUserId?: string;
}

export const LeaderboardCardLight: React.FC<LeaderboardCardLightProps> = ({
  timeframe,
  entries: originalEntries,
  currentUser: originalCurrentUser,
  currentUserId,
}) => {
  // TEMPORARY: Generate sample data for testing
  const sampleEntries: LeaderboardEntry[] = [
    { userId: '1', username: 'AlexStudy', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png', xp: 15420, totalDuration: 126000, rank: 1 },
    { userId: '2', username: 'SarahCodes', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png', xp: 14200, totalDuration: 115200, rank: 2 },
    { userId: '3', username: 'MikeLearn', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png', xp: 13100, totalDuration: 104400, rank: 3 },
    { userId: '4', username: 'EmilyFocus', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/3.png', xp: 11900, totalDuration: 93600, rank: 4 },
    { userId: '5', username: 'JohnGrind', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/4.png', xp: 10800, totalDuration: 82800, rank: 5 },
    { userId: '6', username: 'LisaWork', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png', xp: 9650, totalDuration: 72000, rank: 6 },
    { userId: '7', username: 'TomHustle', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png', xp: 8720, totalDuration: 61200, rank: 7 },
    { userId: '8', username: 'AnnaStudy', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png', xp: 7890, totalDuration: 50400, rank: 8 },
    { userId: '9', username: 'DavidCode', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/3.png', xp: 6950, totalDuration: 39600, rank: 9 },
    { userId: '10', username: 'RachelLearn', avatarUrl: 'https://cdn.discordapp.com/embed/avatars/4.png', xp: 6100, totalDuration: 28800, rank: 10 },
  ];

  const sampleCurrentUser: LeaderboardEntry = {
    userId: '11',
    username: 'YouUser',
    avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
    xp: 4200,
    totalDuration: 18000,
    rank: 11,
  };

  // Use sample data if no real data provided
  const entries = originalEntries.length > 0 ? originalEntries : sampleEntries;
  const currentUser = originalEntries.length > 0
    ? originalCurrentUser
    : (timeframe === 'daily' ? sampleCurrentUser : undefined);

  console.log('[LeaderboardCardLight] Rendering:', {
    originalEntriesLength: originalEntries.length,
    entriesLength: entries.length,
    originalCurrentUser: !!originalCurrentUser,
    currentUser: !!currentUser,
    currentUserRank: currentUser?.rank,
    timeframe
  });

  const timeframeLabels = {
    daily: 'Daily Leaderboard',
    weekly: 'Weekly Leaderboard',
    monthly: 'Monthly Leaderboard',
    'all-time': 'All-Time Leaderboard',
  };

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

  return (
    <div className="w-[700px] bg-white flex flex-col p-8 pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[#3C3C3C] text-3xl font-extrabold flex items-center gap-3">
          <Award className="w-9 h-9 text-[#FFD900]" fill="#FFD900" />
          {timeframeLabels[timeframe]}
        </h1>
      </div>

      {/* Leaderboard Entries */}
      <div className="space-y-2.5">
        {entries.map((entry) => {
          const level = calculateLevel(entry.xp);
          const hours = Math.floor(entry.totalDuration / 3600);
          const isCurrentUser = currentUserId && entry.userId === currentUserId;

          return (
            <div
              key={entry.userId}
              className={`rounded-xl p-3 border-2 flex items-center gap-3 ${
                isCurrentUser
                  ? 'bg-[#E6F7FF] border-[#1CB0F6]'
                  : 'bg-white border-[#E5E5E5]'
              }`}
            >
              {/* Rank */}
              <div className="w-10 flex items-center justify-center">
                {getRankIcon(entry.rank) || (
                  <span className="text-xl font-bold text-[#777777]">
                    {entry.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] p-0.5">
                <img
                  src={entry.avatarUrl}
                  alt={entry.username}
                  className="w-full h-full rounded-full object-cover border-2 border-white"
                />
              </div>

              {/* Username */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#3C3C3C]">
                  {entry.username}
                </h3>
                <p className="text-sm font-semibold text-[#777777]">Level {level}</p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5 mr-2">
                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#3C3C3C] flex items-center justify-end gap-1">
                    {entry.xp.toLocaleString()} <span className="text-[#A78BFA]">⚡</span>
                  </div>
                  <div className="text-sm font-semibold text-[#777777]">XP</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#3C3C3C]">
                    {hours}h
                  </div>
                  <div className="text-sm font-semibold text-[#777777]">Time</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Current User (if not in top 10) */}
        {currentUser && (
          <>
            <div className="bg-[#E6F7FF] rounded-xl p-3 border-2 border-[#1CB0F6] flex items-center gap-3">
              {/* Rank */}
              <div className="w-10 flex items-center justify-center">
                <span className="text-xl font-bold text-[#1CB0F6]">
                  {currentUser.rank}
                </span>
              </div>

              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1CB0F6] to-[#0088CC] p-0.5">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username}
                  className="w-full h-full rounded-full object-cover border-2 border-white"
                />
              </div>

              {/* Username */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#3C3C3C]">
                  {currentUser.username} (You)
                </h3>
                <p className="text-sm font-semibold text-[#777777]">
                  Level {calculateLevel(currentUser.xp)}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-5 mr-2">
                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#3C3C3C] flex items-center justify-end gap-1">
                    {currentUser.xp.toLocaleString()} <span className="text-[#A78BFA]">⚡</span>
                  </div>
                  <div className="text-sm font-semibold text-[#777777]">XP</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#3C3C3C]">
                    {Math.floor(currentUser.totalDuration / 3600)}h
                  </div>
                  <div className="text-sm font-semibold text-[#777777]">Time</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
