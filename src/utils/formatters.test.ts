/**
 * Unit tests for Formatters Utility
 *
 * Tests time and duration formatting functions including:
 * - Duration formatting (seconds to human-readable)
 * - Elapsed time calculations with pause support
 * - Date comparison helpers (same day, yesterday, days between)
 * - Date key generation
 *
 * Run with: npm test -- formatters.test.ts
 */

import {
  formatDuration,
  calculateDuration,
  isSameDay,
  isYesterday,
  daysBetween,
  getDateKey,
} from './formatters';
import { Timestamp } from 'firebase-admin/firestore';

describe('formatDuration', () => {
  it('should format durations less than 60 seconds as "< 1m"', () => {
    expect(formatDuration(0)).toBe('< 1m');
    expect(formatDuration(30)).toBe('< 1m');
    expect(formatDuration(59)).toBe('< 1m');
  });

  it('should format durations in minutes only when less than 1 hour', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(1800)).toBe('30m');
    expect(formatDuration(3540)).toBe('59m');
  });

  it('should format durations with hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h 0m');
    expect(formatDuration(8100)).toBe('2h 15m');
    expect(formatDuration(5400)).toBe('1h 30m');
  });

  it('should handle large durations correctly', () => {
    expect(formatDuration(36000)).toBe('10h 0m');
    expect(formatDuration(86400)).toBe('24h 0m');
    expect(formatDuration(90061)).toBe('25h 1m');
  });

  it('should round down partial minutes', () => {
    expect(formatDuration(3659)).toBe('1h 0m'); // 60 minutes, 59 seconds = 1h 0m
    expect(formatDuration(3661)).toBe('1h 1m'); // 1 hour, 1 minute, 1 second
  });
});

describe('calculateDuration', () => {
  it('should calculate elapsed time without pauses', () => {
    const now = Date.now();
    const startTime = Timestamp.fromMillis(now - 3600000); // 1 hour ago
    const pausedDuration = 0;

    const elapsed = calculateDuration(startTime, pausedDuration);

    // Should be approximately 3600 seconds (1 hour)
    expect(elapsed).toBeGreaterThanOrEqual(3600);
    expect(elapsed).toBeLessThan(3610); // Allow 10 second buffer
  });

  it('should subtract paused duration from elapsed time', () => {
    const now = Date.now();
    const startTime = Timestamp.fromMillis(now - 3600000); // 1 hour ago
    const pausedDuration = 600; // 10 minutes paused

    const elapsed = calculateDuration(startTime, pausedDuration);

    // Should be approximately 3000 seconds (50 minutes)
    expect(elapsed).toBeGreaterThanOrEqual(3000);
    expect(elapsed).toBeLessThan(3010);
  });

  it('should include current pause duration if currently paused', () => {
    const now = Date.now();
    const startTime = Timestamp.fromMillis(now - 3600000); // 1 hour ago
    const pausedDuration = 300; // 5 minutes previously paused
    const pausedAt = Timestamp.fromMillis(now - 600000); // paused 10 minutes ago

    const elapsed = calculateDuration(startTime, pausedDuration, pausedAt);

    // Total paused: 300 + 600 = 900 seconds (15 minutes)
    // Elapsed: 3600 - 900 = 2700 seconds (45 minutes)
    expect(elapsed).toBeGreaterThanOrEqual(2700);
    expect(elapsed).toBeLessThan(2710);
  });

  it('should return 0 if paused duration exceeds elapsed time', () => {
    const now = Date.now();
    const startTime = Timestamp.fromMillis(now - 1000); // 1 second ago
    const pausedDuration = 5000; // 5 seconds paused (more than elapsed)

    const elapsed = calculateDuration(startTime, pausedDuration);

    expect(elapsed).toBe(0);
  });

  it('should handle zero elapsed time', () => {
    const now = Date.now();
    const startTime = Timestamp.fromMillis(now);
    const pausedDuration = 0;

    const elapsed = calculateDuration(startTime, pausedDuration);

    expect(elapsed).toBe(0);
  });
});

describe('isSameDay', () => {
  it('should return true for same day timestamps', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-15T10:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-01-15T20:00:00Z'));

    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('should return false for different day timestamps', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-15T23:59:59Z'));
    const date2 = Timestamp.fromDate(new Date('2025-01-16T00:00:01Z'));

    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('should return true for same timestamp', () => {
    const date = Timestamp.fromDate(new Date('2025-01-15T12:00:00Z'));

    expect(isSameDay(date, date)).toBe(true);
  });

  it('should handle different months', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-31T12:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-02-01T12:00:00Z'));

    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('should handle different years', () => {
    const date1 = Timestamp.fromDate(new Date('2024-12-31T12:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-01-01T12:00:00Z'));

    expect(isSameDay(date1, date2)).toBe(false);
  });
});

describe('isYesterday', () => {
  it('should return true for consecutive days', () => {
    const yesterday = Timestamp.fromDate(new Date('2025-01-14T12:00:00Z'));
    const today = Timestamp.fromDate(new Date('2025-01-15T12:00:00Z'));

    expect(isYesterday(yesterday, today)).toBe(true);
  });

  it('should return false for same day', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-15T10:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-01-15T20:00:00Z'));

    expect(isYesterday(date1, date2)).toBe(false);
  });

  it('should return false for two days apart', () => {
    const twoDaysAgo = Timestamp.fromDate(new Date('2025-01-13T12:00:00Z'));
    const today = Timestamp.fromDate(new Date('2025-01-15T12:00:00Z'));

    expect(isYesterday(twoDaysAgo, today)).toBe(false);
  });

  it('should handle month boundaries', () => {
    const lastDayOfMonth = Timestamp.fromDate(new Date('2025-01-31T12:00:00Z'));
    const firstDayOfNextMonth = Timestamp.fromDate(new Date('2025-02-01T12:00:00Z'));

    expect(isYesterday(lastDayOfMonth, firstDayOfNextMonth)).toBe(true);
  });

  it('should handle year boundaries', () => {
    const lastDayOfYear = Timestamp.fromDate(new Date('2024-12-31T12:00:00Z'));
    const firstDayOfNextYear = Timestamp.fromDate(new Date('2025-01-01T12:00:00Z'));

    expect(isYesterday(lastDayOfYear, firstDayOfNextYear)).toBe(true);
  });
});

describe('daysBetween', () => {
  it('should return 0 for same day', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-15T10:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-01-15T20:00:00Z'));

    expect(daysBetween(date1, date2)).toBe(0);
  });

  it('should return 1 for consecutive days', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-15T12:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-01-16T12:00:00Z'));

    expect(daysBetween(date1, date2)).toBe(1);
  });

  it('should return absolute difference regardless of order', () => {
    const earlier = Timestamp.fromDate(new Date('2025-01-10T12:00:00Z'));
    const later = Timestamp.fromDate(new Date('2025-01-15T12:00:00Z'));

    expect(daysBetween(earlier, later)).toBe(5);
    expect(daysBetween(later, earlier)).toBe(5); // Should be same
  });

  it('should handle large time spans', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-01T00:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-12-31T23:59:59Z'));

    expect(daysBetween(date1, date2)).toBe(364);
  });

  it('should handle leap years', () => {
    const date1 = Timestamp.fromDate(new Date('2024-02-28T12:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2024-03-01T12:00:00Z'));

    // 2024 is a leap year, so Feb has 29 days
    expect(daysBetween(date1, date2)).toBe(2);
  });
});

describe('getDateKey', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const timestamp = Timestamp.fromDate(new Date('2025-01-15T12:34:56Z'));
    const key = getDateKey(timestamp);

    expect(key).toBe('2025-01-15');
  });

  it('should zero-pad single digit months and days', () => {
    const timestamp = Timestamp.fromDate(new Date('2025-01-05T12:00:00Z'));
    const key = getDateKey(timestamp);

    expect(key).toBe('2025-01-05');
  });

  it('should handle different times on same day', () => {
    const morning = Timestamp.fromDate(new Date('2025-01-15T06:00:00Z'));
    const evening = Timestamp.fromDate(new Date('2025-01-15T22:00:00Z'));

    expect(getDateKey(morning)).toBe(getDateKey(evening));
  });

  it('should be consistent and sortable', () => {
    const date1 = Timestamp.fromDate(new Date('2025-01-10T12:00:00Z'));
    const date2 = Timestamp.fromDate(new Date('2025-01-15T12:00:00Z'));
    const date3 = Timestamp.fromDate(new Date('2025-02-01T12:00:00Z'));

    const keys = [getDateKey(date1), getDateKey(date2), getDateKey(date3)];
    const sorted = [...keys].sort();

    expect(keys).toEqual(sorted); // Should be in chronological order
  });
});
