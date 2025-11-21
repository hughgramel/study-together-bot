import React from 'react';
import { Flame } from 'lucide-react';

interface StreakCardProps {
  username: string;
  avatarUrl: string;
  streak: number;
  message: string;
}

/**
 * Streak milestone celebration card component
 * Compact modern design with dark mode
 */
export default function StreakCard({
  username,
  avatarUrl,
  streak,
  message,
}: StreakCardProps) {
  // Determine color based on streak milestone
  const getStreakColor = () => {
    if (streak >= 30) return { from: '#FF6B6B', to: '#FF4444' }; // Red for 30+
    if (streak >= 7) return { from: '#FF9600', to: '#FF7700' };  // Orange for 7+
    return { from: '#FFD900', to: '#FFAA00' }; // Yellow default
  };

  const colors = getStreakColor();

  return (
    <div className="w-[500px] h-[140px] bg-[#131F24] flex items-center gap-5 px-8 py-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div
        className="absolute top-0 right-0 w-40 h-40 opacity-10 rounded-full blur-3xl"
        style={{ background: colors.from }}
      />

      {/* Avatar with streak color glow */}
      <div className="relative flex-shrink-0 z-10">
        <div
          className="w-16 h-16 rounded-full p-1"
          style={{
            background: `linear-gradient(to bottom right, ${colors.from}, ${colors.to})`
          }}
        >
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
            {username.length > 10 ? username.substring(0, 10) + '...' : username}
          </h2>
          <Flame className="w-5 h-5" style={{ color: colors.from }} fill={colors.from} />
        </div>
        <p className="text-[#DBDEE1] text-base font-semibold leading-snug mt-1">
          {message}
        </p>
      </div>

      {/* Flame icon decoration */}
      <div className="absolute bottom-4 right-6 opacity-15 z-0">
        <Flame
          className="w-16 h-16"
          style={{ color: colors.from }}
          fill={colors.from}
        />
      </div>
    </div>
  );
}
