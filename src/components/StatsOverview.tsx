import React from 'react';
import { Flame, Clock, Zap, BookOpen, TrendingUp } from 'lucide-react';

interface StatsOverviewProps {
  username: string;
  avatarUrl?: string;
  metric: 'hours' | 'sessions' | 'xp';
  timeframe: 'today' | 'week' | 'month' | 'all-time';
  currentValue: number;
  previousValue: number;
  breakdown: { label: string; value: number }[];
  highlightIndex?: number; // Index of the current day/week to highlight in blue
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  username,
  avatarUrl,
  metric,
  timeframe,
  currentValue,
  previousValue,
  breakdown,
  highlightIndex,
}) => {
  const getMetricInfo = () => {
    switch (metric) {
      case 'hours':
        return {
          title: 'Total Hours',
          icon: Clock,
          color: 'from-[#1CB0F6] to-[#0088CC]',
          unit: 'h',
          emoji: '⏱️',
        };
      case 'sessions':
        return {
          title: 'Total Sessions',
          icon: BookOpen,
          color: 'from-[#58CC02] to-[#45A000]',
          unit: '',
          emoji: '📚',
        };
      case 'xp':
        return {
          title: 'Total XP',
          icon: Zap,
          color: 'from-[#FFD900] to-[#FFAA00]',
          unit: ' XP',
          emoji: '⚡',
        };
    }
  };

  const getTimeframeTitle = () => {
    switch (timeframe) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      case 'all-time':
        return 'All Time';
    }
  };

  const metricInfo = getMetricInfo();
  const Icon = metricInfo.icon;

  // Calculate percentage change
  const percentChange = previousValue > 0
    ? ((currentValue - previousValue) / previousValue) * 100
    : 0;
  const isPositive = percentChange >= 0;

  return (
    <div className="w-[700px] h-[700px] bg-[#131F24] flex flex-col p-10">
      {/* Header with user info and timeframe */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
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
          <div className="flex flex-col">
            <h2 className="text-[#EFEFEF] text-xl font-bold truncate max-w-[400px]">
              {username}
            </h2>
            <p className="text-[#AFAFAF] text-sm font-normal">
              Detailed Statistics
            </p>
          </div>
        </div>

        {/* Timeframe badge */}
        <div className="bg-[#1CB0F6] text-white px-5 py-2 rounded-xl text-base font-bold">
          {getTimeframeTitle()}
        </div>
      </div>

      {/* Breakdown Section - Full height */}
      <div className="flex-1">
        <h3 className="text-[#EFEFEF] text-lg font-bold mb-4">{metricInfo.emoji} {metricInfo.title}</h3>
        <div className="grid grid-cols-2 gap-4">
          {breakdown.map((item, index) => {
            const isHighlighted = highlightIndex !== undefined && index === highlightIndex;
            return (
              <div
                key={index}
                className={`rounded-xl p-5 border-2 flex flex-col ${
                  isHighlighted
                    ? 'bg-[#1A2A32] border-[#1CB0F6]'
                    : 'bg-[#1F2B31] border-[#2E3D44]'
                }`}
              >
                <div className={`text-sm font-semibold uppercase tracking-wide mb-2 ${
                  isHighlighted ? 'text-[#1CB0F6]' : 'text-[#AFAFAF]'
                }`}>
                  {item.label}
                </div>
                <div className={`text-4xl font-extrabold leading-none ${
                  isHighlighted ? 'text-[#EFEFEF]' : 'text-[#EFEFEF]'
                }`}>
                  {metric === 'xp' ? item.value.toLocaleString() : item.value}{metricInfo.unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
