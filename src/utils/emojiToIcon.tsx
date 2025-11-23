/**
 * Emoji to Icon Utility - Maps emojis to Lucide React icons
 *
 * Provides consistent icon rendering across platforms by mapping emoji strings
 * to Lucide React icon components. Used for achievements, milestones, and other
 * emoji-based UI elements that need to render reliably in Discord embeds.
 *
 * @module utils/emojiToIcon
 */

import React from 'react';
import {
  Target, Timer, Award, Flame, Clock, Moon, Sunrise, Zap,
  TrendingUp, Mountain, Trophy, Star, Medal, BookOpen, Brain,
  Sparkles, Crown, Rocket, Shield, Heart, LucideIcon
} from 'lucide-react';

/**
 * Maps emoji strings to Lucide React icon components
 *
 * Used for rendering achievement icons consistently across platforms.
 * Covers common categories: milestones, time, streaks, study, progress, and tiers.
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
 * Gets the Lucide icon component for a given emoji
 *
 * @param emoji - Emoji string to lookup (e.g., "🏆", "🔥")
 * @returns Lucide icon component (defaults to Award if not found)
 */
export function getIconForEmoji(emoji: string): LucideIcon {
  return emojiToIcon[emoji] || Award;
}

/**
 * Renders an achievement icon component with standard styling
 *
 * @param emoji - Emoji string to render as icon
 * @param className - Tailwind CSS classes for styling (default: "w-6 h-6")
 * @returns React element with the appropriate icon component
 */
export function renderAchievementIcon(
  emoji: string,
  className: string = "w-6 h-6"
): React.ReactElement {
  const IconComponent = getIconForEmoji(emoji);
  return <IconComponent className={className} />;
}
