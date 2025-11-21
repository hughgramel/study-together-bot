import React from 'react';
import { TrendingUp, Calendar, Zap, Timer } from 'lucide-react';

export interface DataPoint {
  label: string;
  value: number;
}

interface StatsChartProps {
  username: string;
  avatarUrl?: string;
  metric: 'hours' | 'xp' | 'sessions' | 'totalHours';
  timeframe: 'week' | 'month' | 'year';
  data: DataPoint[];
  currentValue: number;
  previousValue: number;
}

export const StatsChart: React.FC<StatsChartProps> = ({
  username,
  avatarUrl,
  metric,
  timeframe,
  data,
  currentValue,
  previousValue,
}) => {
  // Calculate percentage change
  const change = previousValue > 0
    ? ((currentValue - previousValue) / previousValue) * 100
    : 0;
  const isPositive = change >= 0;

  // Get max value for scaling
  const maxValue = Math.max(...data.map(d => d.value), 1);

  // Get metric details
  const metricConfig = {
    hours: {
      label: 'Hours Studied',
      icon: Timer,
      color: '#1CB0F6',
      gradient: ['#1CB0F6', '#0088CC'],
      unit: 'h',
    },
    totalHours: {
      label: 'Total Hours',
      icon: Timer,
      color: '#CE82FF',
      gradient: ['#CE82FF', '#A855F7'],
      unit: 'h',
    },
    xp: {
      label: 'XP Earned',
      icon: Zap,
      color: '#FFD900',
      gradient: ['#FFD900', '#FFC800'],
      unit: 'XP',
    },
    sessions: {
      label: 'Sessions Completed',
      icon: Calendar,
      color: '#58CC02',
      gradient: ['#58CC02', '#4CAF00'],
      unit: '',
    },
  }[metric];

  const Icon = metricConfig.icon;

  // Get timeframe label
  const timeframeLabel = {
    week: 'Past 7 Days',
    month: 'Past 30 Days',
    year: 'Past 12 Months',
  }[timeframe];

  // Get current period label
  const currentPeriodLabel = {
    week: 'Today',
    month: 'This Week',
    year: 'This Month',
  }[timeframe];

  // Format value based on metric
  const formatValue = (value: number) => {
    if (metric === 'hours' || metric === 'totalHours') {
      return value.toFixed(1);
    }
    return Math.floor(value).toLocaleString();
  };

  return (
    <div className="w-[1200px] h-[700px] bg-[#131F24] flex flex-col p-8">
      {/* Header - All in one line, larger text */}
      <div className="flex items-center gap-6 mb-10">
        {/* Profile Picture - larger */}
        {avatarUrl ? (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] p-0.5 flex-shrink-0">
            <img
              src={avatarUrl}
              alt={username}
              className="w-full h-full rounded-full object-cover border-2 border-[#1F2B31]"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] flex items-center justify-center text-3xl border-2 border-[#1F2B31] flex-shrink-0">
            👤
          </div>
        )}

        {/* Username - larger text */}
        <span className="text-[#EFEFEF] text-3xl font-bold">{username}</span>

        {/* Separator - taller */}
        <div className="w-px h-10 bg-[#2E3D44]"></div>

        {/* Value only - larger text */}
        <span className="text-[#EFEFEF] text-3xl font-bold">
          {formatValue(currentValue)}{metricConfig.unit}
        </span>

        {/* Separator - taller */}
        <div className="w-px h-10 bg-[#2E3D44]"></div>

        {/* Timeframe - larger text */}
        <span className="text-[#EFEFEF] text-3xl font-bold">{timeframeLabel}</span>
      </div>

      {/* Bar Chart - takes up remaining space */}
      <div className="flex-1 flex items-end gap-4 pb-12">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between h-[420px] pr-4 mb-16" style={{ minWidth: '60px' }}>
          {[4, 3, 2, 1, 0].map((i) => {
            const value = (maxValue / 4) * i;
            return (
              <div key={i} className="flex items-center justify-end">
                <span className="text-[#EFEFEF] text-base font-semibold">
                  {formatValue(value)}{metricConfig.unit}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bars */}
        <div className="flex-1 flex items-end gap-4 px-6">
          {data.map((point, index) => {
            const heightPercent = (point.value / maxValue) * 100;
            const isHighlighted = index === data.length - 1;

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-3 group">
                {/* Value Label on Hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity h-6">
                  <span className="text-[#EFEFEF] text-lg font-bold">
                    {formatValue(point.value)}
                  </span>
                </div>

                {/* Bar Container */}
                <div className="w-full flex flex-col justify-end" style={{ height: '420px' }}>
                  <div
                    className={`w-full rounded-t-2xl transition-all ${
                      isHighlighted
                        ? 'opacity-100'
                        : 'opacity-50 group-hover:opacity-80'
                    }`}
                    style={{
                      height: `${heightPercent}%`,
                      background: `linear-gradient(180deg, ${metricConfig.gradient[0]}, ${metricConfig.gradient[1]})`,
                      minHeight: point.value > 0 ? '12px' : '0px',
                    }}
                  />
                </div>

                {/* Label - blue for current period, white for others */}
                <span className={`text-xl font-bold mb-4 ${
                  isHighlighted ? 'text-[#1CB0F6]' : 'text-[#EFEFEF]'
                }`}>
                  {isHighlighted ? currentPeriodLabel : point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
