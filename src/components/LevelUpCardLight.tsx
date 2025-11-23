/**
 * Level Up Card Light Mode - Celebration card with light theme
 *
 * Light mode version of LevelUpCard with white background and vibrant purple accents.
 *
 * @module components/LevelUpCardLight
 */

import React from 'react';
import { Zap } from 'lucide-react';

interface LevelUpCardLightProps {
  username: string;
  avatarUrl: string;
  newLevel: number;
  hoursToNext: number;
}

export default function LevelUpCardLight({
  username,
  avatarUrl,
  newLevel,
  hoursToNext,
}: LevelUpCardLightProps) {
  return (
    <div className="w-[500px] h-[140px] bg-white flex items-center gap-5 px-8 py-6 relative overflow-hidden border-2 border-[#E5E5E5]">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#CE82FF] opacity-5 rounded-full blur-3xl" />

      {/* Avatar with purple glow */}
      <div className="relative flex-shrink-0 z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#CE82FF] to-[#9333ea] p-1">
          <img
            src={avatarUrl}
            alt={username}
            className="w-full h-full rounded-full object-cover border-2 border-white"
          />
        </div>
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-1 flex-1 z-10">
        <h2 className="text-[#3C3C3C] text-xl font-extrabold">
          {username.length > 10 ? username.substring(0, 10) + '...' : username}
        </h2>
        <div className="text-[#CE82FF] text-2xl font-extrabold">
          Level {newLevel}!
        </div>
        <p className="text-[#666666] text-base font-semibold">
          {hoursToNext} {hoursToNext === 1 ? 'hour' : 'hours'} to Level {newLevel + 1}
        </p>
      </div>

      {/* XP Icon decoration */}
      <div className="absolute bottom-4 right-6 opacity-20 z-0">
        <Zap className="w-16 h-16 text-[#CE82FF]" fill="#CE82FF" />
      </div>
    </div>
  );
}
