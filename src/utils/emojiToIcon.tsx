import React from 'react';
import {
  Target, Timer, Award, Flame, Clock, Moon, Sunrise, Zap,
  TrendingUp, Mountain, Trophy, Star, Medal, BookOpen, Brain,
  Sparkles, Crown, Rocket, Shield, Heart, LucideIcon
} from 'lucide-react';

/**
 * Maps emoji strings to Lucide React icon components
 * Used for rendering achievement icons consistently across platforms
 */
export const emojiToIcon: Record<string, LucideIcon> = {
  // Milestone & General
  '🎯': Target,
  '🏆': Trophy,
  '⭐': Star,
  '🏅': Medal,
  '👑': Crown,
  '🎖️': Award,
  '✨': Sparkles,

  // Time & Duration
  '⏱️': Timer,
  '⏰': Clock,
  '⏲️': Timer,

  // Streak & Fire
  '🔥': Flame,

  // Study & Learning
  '📚': BookOpen,
  '✍️': BookOpen,
  '🧠': Brain,

  // Level & Progress
  '⚡': Zap,
  '💯': Target,
  '🚀': Rocket,
  '🛡️': Shield,

  // Time of Day
  '🌙': Moon,
  '🌅': Sunrise,
  '☀️': Sunrise,

  // Achievement Tiers
  '💪': TrendingUp,
  '⛰️': Mountain,
  '💝': Heart,
};

/**
 * Get icon component for a given emoji
 * Falls back to Award icon if emoji not found
 */
export function getIconForEmoji(emoji: string): LucideIcon {
  return emojiToIcon[emoji] || Award;
}

/**
 * Render icon component with standard styling
 */
export function renderAchievementIcon(
  emoji: string,
  className: string = "w-6 h-6"
): React.ReactElement {
  const IconComponent = getIconForEmoji(emoji);
  return <IconComponent className={className} />;
}
