/**
 * Badges Data - Backward compatibility wrapper for achievements
 *
 * Provides legacy exports for badge-related data that map to the new achievements
 * system. Maintains backward compatibility for existing code while transitioning
 * to the unified achievements implementation.
 *
 * @module data/badges
 * @deprecated Use achievements data directly instead
 */
export {
  ACHIEVEMENT_DEFINITIONS as BADGE_DEFINITIONS,
  getAchievement as getBadge,
  getAchievementsByCategory as getBadgesByCategory,
  getAllAchievements as getAllBadges,
} from './achievements';
