/**
 * Formatters Utility - Time and date formatting helpers
 *
 * Provides utility functions for formatting durations, calculating elapsed time,
 * comparing dates, and generating date keys. Used throughout the bot for consistent
 * time display and date calculations.
 *
 * @module utils/formatters
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * Formats duration in seconds to a human-readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2h 15m", "45m", "< 1m")
 *
 * @example
 * formatDuration(8100) // "2h 15m"
 * formatDuration(2700) // "45m"
 * formatDuration(30)   // "< 1m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return '< 1m';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Calculates elapsed duration from start time, accounting for paused time
 * @param startTime - Firebase timestamp when session started
 * @param pausedDuration - Total seconds spent paused
 * @param pausedAt - Optional timestamp if currently paused
 * @returns Total elapsed seconds (minus paused time)
 */
export function calculateDuration(
  startTime: Timestamp,
  pausedDuration: number,
  pausedAt?: Timestamp
): number {
  const now = Date.now();
  const startMs = startTime.toMillis();
  const elapsedMs = now - startMs;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  let totalPausedSeconds = pausedDuration;

  // If currently paused, add current pause duration
  if (pausedAt) {
    const pauseMs = now - pausedAt.toMillis();
    totalPausedSeconds += Math.floor(pauseMs / 1000);
  }

  return Math.max(0, elapsedSeconds - totalPausedSeconds);
}

/**
 * Checks if two timestamps are on the same UTC day
 *
 * @param date1 - First timestamp to compare
 * @param date2 - Second timestamp to compare
 * @returns True if both timestamps are on the same UTC day
 */
export function isSameDay(date1: Timestamp, date2: Timestamp): boolean {
  const d1 = new Date(date1.toMillis());
  const d2 = new Date(date2.toMillis());

  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

/**
 * Checks if date1 is the day before date2 (in UTC)
 *
 * @param date1 - Timestamp to check if it's yesterday
 * @param date2 - Reference timestamp (typically "today")
 * @returns True if date1 is exactly one day before date2
 */
export function isYesterday(date1: Timestamp, date2: Timestamp): boolean {
  const d1 = new Date(date1.toMillis());
  const d2 = new Date(date2.toMillis());

  // Add one day to date1 and check if it's the same day as date2
  const d1PlusOne = new Date(d1);
  d1PlusOne.setUTCDate(d1PlusOne.getUTCDate() + 1);

  return (
    d1PlusOne.getUTCFullYear() === d2.getUTCFullYear() &&
    d1PlusOne.getUTCMonth() === d2.getUTCMonth() &&
    d1PlusOne.getUTCDate() === d2.getUTCDate()
  );
}

/**
 * Gets the number of days between two timestamps
 *
 * @param date1 - First timestamp
 * @param date2 - Second timestamp
 * @returns Absolute number of days between the timestamps
 */
export function daysBetween(date1: Timestamp, date2: Timestamp): number {
  const ms1 = date1.toMillis();
  const ms2 = date2.toMillis();
  const diffMs = Math.abs(ms2 - ms1);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Gets date key in YYYY-MM-DD format for indexing and comparison
 *
 * @param timestamp - Firebase timestamp
 * @returns Date string in ISO format (e.g., "2025-01-15")
 */
export function getDateKey(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toISOString().split('T')[0];
}
