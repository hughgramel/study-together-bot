import React from 'react';
import { Trophy } from 'lucide-react';
import { getIconForEmoji } from '../utils/emojiToIcon';

interface Achievement {
  emoji: string;
  name: string;
  description: string;
}

interface AchievementUnlockCardProps {
  username: string;
  avatarUrl: string;
  achievements: Achievement[];
  totalXP: number;
}

/**
 * Achievement unlock celebration card component
 * Modern design with dark mode and trophy theme
 * Dynamic height based on number of achievements
 */
export default function AchievementUnlockCard({
  username,
  avatarUrl,
  achievements,
  totalXP,
}: AchievementUnlockCardProps) {
  // Calculate dynamic height: header (90px) + achievements (50px each) + footer (40px)
  const cardHeight = 90 + (achievements.length * 50) + 40;

  return (
    <div className="w-[500px] bg-[#131F24] relative overflow-hidden" style={{ height: `${cardHeight}px` }}>
      {/* Decorative background glow - golden/yellow for achievements */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#FFD900] opacity-10 rounded-full blur-3xl" />

      {/* Header section with avatar and title */}
      <div className="flex items-center gap-4 px-6 pt-5 pb-3 z-10 relative">
        {/* Avatar with gold glow */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FFD900] to-[#FFA500] p-1">
            <img
              src={avatarUrl}
              alt={username}
              className="w-full h-full rounded-full object-cover border-2 border-[#1F2B31]"
            />
          </div>
        </div>

        {/* Title with Trophy icon */}
        <div className="flex items-center gap-2 flex-1">
          <Trophy className="w-6 h-6 text-[#FFD900]" fill="#FFD900" strokeWidth={2.5} />
          <h2 className="text-[#EFEFEF] text-xl font-extrabold">
            {username.length > 10 ? username.substring(0, 10) + '...' : username}
          </h2>
        </div>
      </div>

      {/* Achievement list */}
      <div className="px-6 pb-2 z-10 relative flex flex-col gap-1">
        {achievements.map((achievement, index) => {
          const IconComponent = getIconForEmoji(achievement.emoji);
          return (
            <div key={index} className="flex items-center gap-3 py-1">
              <div className="flex-shrink-0">
                <IconComponent className="w-7 h-7 text-[#FFD900]" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <div className="text-[#FFD900] text-base font-bold leading-tight">
                  {achievement.name}
                </div>
                <div className="text-[#AFAFAF] text-xs font-normal leading-tight">
                  {achievement.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with XP */}
      <div className="px-6 pb-4 z-10 relative">
        <div className="text-[#58CC02] text-sm font-bold">
          +{totalXP} bonus XP earned
        </div>
      </div>

      {/* Trophy Icon decoration */}
      <div className="absolute bottom-3 right-5 opacity-15 z-0">
        <Trophy className="w-20 h-20 text-[#FFD900]" fill="#FFD900" />
      </div>
    </div>
  );
}
