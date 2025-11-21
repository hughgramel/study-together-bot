import React from 'react';
import { Radio } from 'lucide-react';

interface SessionStartCardProps {
  username: string;
  avatarUrl: string;
  activity: string;
}

/**
 * Session start notification card component (single user)
 * Compact modern design with dark mode
 * Matches dimensions of LevelUpCard and StreakCard (500x140px)
 */
export default function SessionStartCard({
  username,
  avatarUrl,
  activity,
}: SessionStartCardProps) {
  return (
    <div className="w-[500px] h-[140px] bg-[#131F24] flex items-center gap-5 px-8 py-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#58CC02] opacity-10 rounded-full blur-3xl" />

      {/* Avatar with green glow */}
      <div className="relative flex-shrink-0 z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#58CC02] to-[#3D9B00] p-1">
          <img
            src={avatarUrl}
            alt={username}
            className="w-full h-full rounded-full object-cover border-2 border-[#1F2B31]"
          />
        </div>
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-1 flex-1 z-10">
        <div className="flex items-center gap-2">
          <h2 className="text-[#EFEFEF] text-xl font-extrabold">
            {username}
          </h2>
          <div className="w-2 h-2 bg-[#58CC02] rounded-full animate-pulse" />
          <span className="text-[#58CC02] text-sm font-bold tracking-wide">
            Live
          </span>
        </div>
        <p className="text-[#DBDEE1] text-base font-semibold">
          {activity}
        </p>
      </div>

      {/* Radio waves icon decoration */}
      <div className="absolute bottom-3 right-6 opacity-15 z-0">
        <Radio className="w-12 h-12 text-[#58CC02]" />
      </div>
    </div>
  );
}
