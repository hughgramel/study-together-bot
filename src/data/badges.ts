/**
 * Badges Data - Wrapper for achievements definitions
 * Maintains backward compatibility while using achievements system
 */
export {
  ACHIEVEMENT_DEFINITIONS as BADGE_DEFINITIONS,
  getAchievement as getBadge,
  getAchievementsByCategory as getBadgesByCategory,
  getAllAchievements as getAllBadges,
} from './achievements';
