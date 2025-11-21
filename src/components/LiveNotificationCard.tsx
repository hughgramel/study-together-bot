import React from 'react';
import { Radio, Pause, Circle } from 'lucide-react';

interface LiveUser {
  username: string;
  avatarUrl: string;
  activity: string;
  duration: string;
  isPaused: boolean;
}

interface LiveNotificationCardProps {
  users: LiveUser[];
  totalCount: number;
}

/**
 * Live session notification card component
 * Compact modern design with dark mode
 * Shows up to 10 users with "and n more" footer if needed
 */
export default function LiveNotificationCard({
  users,
  totalCount,
}: LiveNotificationCardProps) {
  const displayUsers = users.slice(0, 10);
  const remainingCount = totalCount - displayUsers.length;

  // Calculate dynamic height based on number of users
  const baseHeight = 100;
  const userItemHeight = 58;
  const footerHeight = remainingCount > 0 ? 40 : 0;
  const totalHeight = baseHeight + (displayUsers.length * userItemHeight) + footerHeight;

  return (
    <div
      className="w-[500px] bg-[#131F24] px-8 py-6 relative overflow-hidden"
      style={{ height: `${totalHeight}px` }}
    >
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#58CC02] opacity-10 rounded-full blur-3xl" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5 z-10 relative">
        <div className="w-3 h-3 bg-[#58CC02] rounded-full animate-pulse" />
        <h1 className="text-[#EFEFEF] text-2xl font-extrabold">
          {totalCount} {totalCount === 1 ? 'person is' : 'people are'} studying
        </h1>
        <Radio className="w-6 h-6 text-[#58CC02]" />
      </div>

      {/* User list */}
      <div className="flex flex-col gap-3.5 z-10 relative">
        {displayUsers.map((user, index) => (
          <div key={index} className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#58CC02] to-[#3D9B00] p-0.5 flex-shrink-0">
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-full h-full rounded-full object-cover border border-[#1F2B31]"
              />
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[#EFEFEF] text-base font-bold truncate">
                    {user.username.length > 10 ? user.username.substring(0, 10) + '...' : user.username}
                  </span>
                  {user.isPaused ? (
                    <Pause className="w-3 h-3 text-[#FFA500] flex-shrink-0" fill="#FFA500" />
                  ) : (
                    <Circle className="w-3 h-3 text-[#58CC02] flex-shrink-0" fill="#58CC02" />
                  )}
                </div>
                <p className="text-[#DBDEE1] text-sm font-bold truncate mt-0.5">
                  {user.activity}
                </p>
              </div>

              {/* Duration on the right */}
              <div className="text-[#8B9DAA] text-base font-bold flex-shrink-0">
                {user.duration}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer - "and n more" */}
      {remainingCount > 0 && (
        <div className="mt-5 pt-4 border-t border-[#2A3B43] z-10 relative">
          <p className="text-[#8B9DAA] text-sm font-bold text-center">
            and {remainingCount} more {remainingCount === 1 ? 'person' : 'people'}
          </p>
        </div>
      )}
    </div>
  );
}
