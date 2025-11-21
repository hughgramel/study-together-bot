import React from 'react';
import { Trophy, Zap, Target, Clock } from 'lucide-react';

interface SessionPostProps {
  username: string;
  avatarUrl?: string;
  duration: string;
  xpGained: number;
  activity: string;
  intensity: number;
  title?: string;
  description?: string;
  date?: string; // Format: "November 10 at 3:13 PM"
}

export const SessionPost: React.FC<SessionPostProps> = ({
  username,
  avatarUrl,
  duration,
  xpGained,
  activity,
  intensity,
  title,
  description,
  date,
}) => {
  // Always use red for intensity/challenge (matching ProfileCard)
  const getIntensityColor = () => {
    return 'from-[#FF4444] to-[#CC0000]'; // Red for challenge/intensity
  };

  return (
    <div className="w-[700px] h-[700px] bg-[#131F24] flex flex-col justify-center p-10 overflow-hidden">
      {/* Content wrapper with flex-shrink to prevent overflow */}
      <div className="flex flex-col min-h-0 flex-shrink">
        {/* Header with user info */}
        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          {avatarUrl ? (
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#2E3D44]">
              <img
                src={avatarUrl}
                alt={username}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#1F2B31] border-2 border-[#2E3D44] flex items-center justify-center text-2xl">
              👤
            </div>
          )}
          <div className="flex flex-col overflow-hidden">
            <h2 className="text-[#EFEFEF] text-xl font-bold truncate max-w-[600px]">
              {username}
            </h2>
            {date && (
              <p className="text-[#AFAFAF] text-base font-normal truncate max-w-[600px]">
                {date}
              </p>
            )}
          </div>
        </div>

        {/* Title */}
        {title && (
          <h1 className="text-[#EFEFEF] text-3xl font-extrabold mb-3 leading-tight flex-shrink-0">
            {title}
          </h1>
        )}

        {/* Description with line clamping */}
        {description && (
          <p className="text-[#DBDEE1] text-2xl font-normal mb-6 leading-relaxed overflow-hidden" style={{
            display: '-webkit-box',
            WebkitLineClamp: 8,
            WebkitBoxOrient: 'vertical',
            textOverflow: 'ellipsis'
          }}>
            {description}
          </p>
        )}

        {/* Stats grid - 2x2 */}
        <div className="grid grid-cols-2 gap-4 flex-shrink-0">
        {/* Duration card */}
        <div className="bg-[#1F2B31] rounded-xl p-4 border-2 border-[#2E3D44]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#1CB0F6] to-[#0088CC] rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            <div className="text-2xl font-extrabold text-[#EFEFEF] leading-none">
              {duration}
            </div>
          </div>
        </div>

        {/* Activity card */}
        <div className="bg-[#1F2B31] rounded-xl p-4 border-2 border-[#2E3D44]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#58CC02] to-[#45A000] rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            <div className="text-xl font-extrabold text-[#EFEFEF] leading-none">
              {activity}
            </div>
          </div>
        </div>

        {/* XP gained card */}
        <div className="bg-[#1F2B31] rounded-xl p-4 border-2 border-[#2E3D44]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#FFD900] to-[#FFAA00] rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-7 h-7 text-white" fill="white" strokeWidth={2.5} />
            </div>
            <div className="text-2xl font-extrabold text-[#EFEFEF] leading-none">
              +{xpGained} XP
            </div>
          </div>
        </div>

        {/* Intensity card */}
        <div className="bg-[#1F2B31] rounded-xl p-4 border-2 border-[#2E3D44]">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-gradient-to-br ${getIntensityColor()} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Trophy className="w-7 h-7 text-white" fill="white" strokeWidth={2.5} />
            </div>
            <div className="text-2xl font-extrabold text-[#EFEFEF] leading-none font-mono">
              {'▰'.repeat(intensity)}{'▱'.repeat(5 - intensity)}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
