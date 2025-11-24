/**
 * Leveled Achievements List - Full list of user's achievement progress
 *
 * Displays all 4 core achievements in a vertical list with progress indicators.
 * Designed for image generation to be embedded in Discord.
 * Matches ProfileCard theme.
 *
 * @module components/LeveledAchievementsList
 */

import React from 'react';
import LeveledAchievementCard from './LeveledAchievementCard';
import { User, Zap } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: number;
  currentLevel: number;
  maxLevel: number;
  currentProgress: number;
  nextThreshold: number | null;
  unit: string;
}

interface LeveledAchievementsListProps {
  username: string;
  avatarUrl: string;
  achievements: Achievement[];
  totalBoost: number;
  lightMode?: boolean;
}

export default function LeveledAchievementsList({
  username,
  avatarUrl,
  achievements,
  totalBoost,
  lightMode = false,
}: LeveledAchievementsListProps) {
  const bgColor = lightMode ? '#F3F4F6' : '#131F24';
  const textColor = lightMode ? '#1F2937' : '#EFEFEF';
  const secondaryTextColor = lightMode ? '#6B7280' : '#AFAFAF';

  // Make it square: 700x700
  const cardSize = 700;

  return (
    <div
      className="w-[700px] p-8"
      style={{ height: `${cardSize}px`, backgroundColor: bgColor }}
    >
      {/* Header with avatar, username, unlock text, and total boost */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] p-[3px]">
              <img
                src={avatarUrl}
                alt={username}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
          )}
          <div>
            <h2
              className="text-3xl font-extrabold mb-1.5"
              style={{ color: textColor }}
            >
              {username.length > 15 ? username.substring(0, 15) + '...' : username}
            </h2>
            <p
              className="text-lg font-bold"
              style={{ color: secondaryTextColor }}
            >
              Unlock achievements to earn XP boosts
            </p>
          </div>
        </div>

        {/* Total XP Boost with icon */}
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6" style={{ color: '#A78BFA' }} fill="#A78BFA" />
          <span
            className="text-3xl font-extrabold"
            style={{ color: '#A78BFA' }}
          >
            +{totalBoost.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Achievement Cards */}
      <div className="flex flex-col gap-8">
        {achievements.map((achievement) => (
          <LeveledAchievementCard
            key={achievement.id}
            achievementId={achievement.id}
            name={achievement.name}
            description={achievement.description}
            currentLevel={achievement.currentLevel}
            maxLevel={achievement.maxLevel}
            currentProgress={achievement.currentProgress}
            nextThreshold={achievement.nextThreshold}
            color={achievement.color}
            lightMode={lightMode}
            unit={achievement.unit}
          />
        ))}
      </div>
    </div>
  );
}
