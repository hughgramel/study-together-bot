/**
 * Stats Overview - Detailed breakdown of user statistics
 *
 * Displays a comprehensive breakdown of user statistics in a grid layout. Shows metrics
 * for different time periods (today, week, month, all-time) with optional highlighting
 * of the current period. Supports hours, sessions, and XP metrics. Rendered as an image
 * in Discord when users request detailed statistics.
 *
 * @module components/StatsOverview
 *
 * @example
 * <StatsOverview
 *   username="JohnDoe"
 *   avatarUrl="https://cdn.discordapp.com/avatars/..."
 *   metric="hours"
 *   timeframe="week"
 *   currentValue={35}
 *   previousValue={28}
 *   breakdown={[
 *     { label: "MON", value: 5 },
 *     { label: "TUE", value: 6 }
 *   ]}
 *   highlightIndex={1}
 * />
 */

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

/**
 * Renders a stats overview with metric breakdown
 *
 * @param username - User's display name
 * @param avatarUrl - URL to user's Discord avatar (optional)
 * @param metric - Type of metric to display (hours, sessions, xp)
 * @param timeframe - Time period for stats (today, week, month, all-time)
 * @param currentValue - Current period's value
 * @param previousValue - Previous period's value (for comparison)
 * @param breakdown - Array of labeled values for the grid breakdown
 * @param highlightIndex - Index of current period to highlight in blue (optional)
 * @returns Stats overview component
 */
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
  /**
   * Gets configuration for the selected metric including icon, color, and unit
   *
   * @returns Metric configuration object
   */
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

  /**
   * Gets the display title for the selected timeframe
   *
   * @returns Timeframe title string
   */
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
          </div>
        </div>

        {/* Timeframe badge */}
        <div className="bg-[#1CB0F6] text-white px-6 py-3 rounded-xl text-xl font-bold">
          {getTimeframeTitle()}
        </div>
      </div>

      {/* Breakdown Section - Full height */}
      <div className="flex-1">
        <h3 className="text-[#EFEFEF] text-2xl font-bold mb-4">{metricInfo.title}</h3>
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
                <div className={`text-base font-bold uppercase tracking-wide mb-2 ${
                  isHighlighted ? 'text-[#1CB0F6]' : 'text-[#DBDEE1]'
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
