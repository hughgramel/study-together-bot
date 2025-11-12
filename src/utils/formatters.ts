import { Timestamp } from 'firebase-admin/firestore';

/**
 * Formats duration in seconds to a human-readable string
 * Examples: "2h 15m", "45m", "1h 0m"
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
 * Checks if two timestamps are on the same day
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
 * Checks if date1 is the day before date2
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
 */
export function daysBetween(date1: Timestamp, date2: Timestamp): number {
  const ms1 = date1.toMillis();
  const ms2 = date2.toMillis();
  const diffMs = Math.abs(ms2 - ms1);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
