/**
 * Badge Service - Backward compatibility wrapper for AchievementService
 *
 * Provides a legacy export for BadgeService that maps to the new AchievementService.
 * Maintains backward compatibility for existing code while transitioning to the
 * achievements system. All badge functionality is now handled by AchievementService.
 *
 * @module services/badges
 * @deprecated Use AchievementService directly instead
 */
export { AchievementService as BadgeService } from './achievements';
