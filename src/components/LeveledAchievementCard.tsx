/**
 * Leveled Achievement Card - Clean achievement display
 *
 * Displays a single achievement with solid color icon, name, level, progress bar,
 * and goal description.
 *
 * @module components/LeveledAchievementCard
 */

import React from 'react';
import { BookOpen, Zap as ZapIcon, Flame, Trophy } from 'lucide-react';

interface LeveledAchievementCardProps {
  achievementId: string;
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  currentProgress: number;
  nextThreshold: number | null;
  color: number;
  lightMode?: boolean;
  unit: string;
}

/**
 * Get descriptive text explaining what the achievement tracks
 */
function getAchievementDescription(
  achievementId: string,
  isComplete: boolean
): string {
  if (isComplete) {
    return 'Achievement completed!';
  }

  switch (achievementId) {
    case 'scholar':
      return 'Total hours studied';
    case 'marathon_runner':
      return 'Longest single session';
    case 'wildfire':
      return 'Current streak';
    case 'champion':
      return 'Reach higher levels';
    default:
      return '';
  }
}

/**
 * Format progress text based on unit type
 */
function formatProgress(progress: number, unit: string): string {
  if (unit === 'hours') {
    return `${progress.toLocaleString()}`;
  } else if (unit === 'days') {
    return `${progress}`;
  } else if (unit === 'level') {
    return `${progress}`;
  } else {
    return `${progress}`;
  }
}

/**
 * Get icon component for achievement
 */
function getAchievementIcon(achievementId: string) {
  switch (achievementId) {
    case 'scholar':
      return BookOpen;
    case 'marathon_runner':
      return ZapIcon;
    case 'wildfire':
      return Flame;
    case 'champion':
      return Trophy;
    default:
      return BookOpen;
  }
}

/**
 * Convert hex to CSS color string
 */
function hexToColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export default function LeveledAchievementCard({
  achievementId,
  name,
  description,
  currentLevel,
  maxLevel,
  currentProgress,
  nextThreshold,
  color,
  lightMode = false,
  unit,
}: LeveledAchievementCardProps) {
  const textColor = lightMode ? '#1F2937' : '#EFEFEF';
  const secondaryTextColor = lightMode ? '#6B7280' : '#9CA3AF';
  const progressBg = lightMode ? '#E5E7EB' : 'rgba(46, 61, 68, 0.5)';

  // Calculate progress percentage for the progress bar
  let progressPercentage = 0;
  if (currentLevel === maxLevel) {
    progressPercentage = 100;
  } else if (nextThreshold !== null) {
    // Get previous threshold (level thresholds, not cumulative)
    const levelThresholds = {
      scholar: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      marathon_runner: [1, 2, 4, 6, 8, 10, 12, 15, 18, 24],
      wildfire: [1, 7, 14, 30, 60, 90, 180, 365, 500, 1000],
      champion: [1, 5, 10, 25, 35, 50, 75, 90, 100, 125],
    };

    const thresholds = levelThresholds[achievementId as keyof typeof levelThresholds] || [];
    const previousThreshold = currentLevel > 0 ? thresholds[currentLevel - 1] : 0;
    const range = nextThreshold - previousThreshold;
    const achieved = currentProgress - previousThreshold;
    progressPercentage = Math.min(100, Math.max(0, (achieved / range) * 100));
  }

  const isComplete = currentLevel === maxLevel;
  const IconComponent = getAchievementIcon(achievementId);
  const colorStr = hexToColor(color);

  // Calculate XP boost for this achievement
  const xpBoost = currentLevel * 0.1;

  return (
    <div className="w-full flex items-center gap-6">
      {/* Achievement Icon - larger */}
      <div className="flex-shrink-0">
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center"
          style={{
            backgroundColor: colorStr,
          }}
        >
          <IconComponent className="w-12 h-12 text-white" fill="white" strokeWidth={2.5} />
        </div>
      </div>

      {/* Achievement Info */}
      <div className="flex-1 min-w-0">
        {/* Name and level inline */}
        <div className="flex items-baseline gap-2 mb-1.5">
          <h3
            className="text-xl font-extrabold"
            style={{ color: textColor }}
          >
            {name}
          </h3>
          {!isComplete && (
            <span
              className="text-lg font-extrabold"
              style={{ color: '#A78BFA' }}
            >
              Lvl {currentLevel}
            </span>
          )}
        </div>

        {/* Progress bar with numbers and XP boost */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-base font-bold"
              style={{ color: secondaryTextColor }}
            >
              {!isComplete && nextThreshold !== null
                ? achievementId === 'champion'
                  ? `Level ${formatProgress(currentProgress, unit)} / ${formatProgress(nextThreshold, unit)}`
                  : `${formatProgress(currentProgress, unit)} / ${formatProgress(nextThreshold, unit)} ${unit}`
                : isComplete
                ? 'Completed'
                : ''}
            </span>
            {xpBoost > 0 && (
              <div className="flex items-center gap-1">
                <ZapIcon className="w-5 h-5" style={{ color: '#A78BFA' }} fill="#A78BFA" />
                <span
                  className="text-xl font-extrabold"
                  style={{ color: '#A78BFA' }}
                >
                  +{xpBoost.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div
            className="w-full h-3 rounded-full overflow-hidden"
            style={{
              backgroundColor: progressBg,
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercentage}%`,
                backgroundColor: colorStr,
              }}
            />
          </div>
        </div>

        {/* Achievement Description */}
        <p
          className="text-base font-semibold"
          style={{ color: secondaryTextColor }}
        >
          {getAchievementDescription(achievementId, isComplete)}
        </p>
      </div>
    </div>
  );
}
