/**
 * Timed Session Card - Timer session start notification
 *
 * Displays a notification when a user starts a timed/countdown session.
 * Similar to SessionStartCard but includes the timer duration.
 * Features a green gradient theme with a live indicator and timer icon.
 *
 * @module components/TimedSessionCard
 *
 * @example
 * <TimedSessionCard
 *   username="JohnDoe"
 *   avatarUrl="https://cdn.discordapp.com/avatars/..."
 *   activity="Evening Study Session"
 *   durationText="2 hours"
 * />
 */

import React from 'react';
import { Timer } from 'lucide-react';

interface TimedSessionCardProps {
  username: string;
  avatarUrl: string;
  activity: string;
  durationText: string;
}

/**
 * Renders a timed session start notification card
 *
 * @param username - User's display name (truncated to 8 chars if longer)
 * @param avatarUrl - URL to user's Discord avatar
 * @param activity - Activity description for the session
 * @param durationText - Duration of the timer (e.g., "2 hours", "30 minutes")
 * @returns Timed session card component
 */
export default function TimedSessionCard({
  username,
  avatarUrl,
  activity,
  durationText,
}: TimedSessionCardProps) {
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
            {username.length > 8 ? username.substring(0, 8) + '...' : username}
          </h2>
          <div className="w-2 h-2 bg-[#58CC02] rounded-full animate-pulse" />
          <span className="text-[#58CC02] text-sm font-bold tracking-wide">
            Live
          </span>
        </div>
        <p className="text-[#DBDEE1] text-sm font-semibold">
          started a <span className="text-[#58CC02]">{durationText}</span> focus session
        </p>
        <p className="text-[#999999] text-xs font-medium">
          {activity}
        </p>
      </div>

      {/* Timer icon decoration */}
      <div className="absolute bottom-3 right-6 opacity-15 z-0">
        <Timer className="w-12 h-12 text-[#58CC02]" />
      </div>
    </div>
  );
}
