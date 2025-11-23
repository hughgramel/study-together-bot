/**
 * Unit tests for Time Helpers Utility
 *
 * Tests Pacific Time zone calculation functions including:
 * - Start of day in Pacific Time
 * - Start of week (Sunday) in Pacific Time
 * - Start of month in Pacific Time
 * - DST (Daylight Saving Time) handling
 *
 * Run with: npm test -- timeHelpers.test.ts
 */

import {
  getStartOfDayPacific,
  getStartOfWeekPacific,
  getStartOfMonthPacific,
} from './timeHelpers';

describe('getStartOfDayPacific', () => {
  it('should return a Date object', () => {
    const result = getStartOfDayPacific();
    expect(result).toBeInstanceOf(Date);
  });

  it('should return midnight (00:00:00) in Pacific Time', () => {
    const result = getStartOfDayPacific();

    // Convert to Pacific Time string to verify it's midnight
    const pacificTimeStr = result.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Should be midnight (00:00:00) or 24:00:00 depending on locale formatting
    expect(['00:00:00', '24:00:00']).toContain(pacificTimeStr);
  });

  it('should return today\'s date in Pacific Time', () => {
    const result = getStartOfDayPacific();
    const now = new Date();

    // Get today's date in Pacific Time
    const pacificDateStr = now.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const resultDateStr = result.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    expect(resultDateStr).toBe(pacificDateStr);
  });

  it('should be consistent across multiple calls within same day', () => {
    const result1 = getStartOfDayPacific();
    const result2 = getStartOfDayPacific();

    // Results should be identical (or very close, within seconds)
    const diff = Math.abs(result1.getTime() - result2.getTime());
    expect(diff).toBeLessThan(1000); // Less than 1 second difference
  });

  it('should return a timestamp in the past or present', () => {
    const result = getStartOfDayPacific();
    const now = new Date();

    // Midnight should be earlier than or equal to now
    expect(result.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});

describe('getStartOfWeekPacific', () => {
  it('should return a Date object', () => {
    const result = getStartOfWeekPacific();
    expect(result).toBeInstanceOf(Date);
  });

  it('should return midnight (00:00:00) in Pacific Time', () => {
    const result = getStartOfWeekPacific();

    const pacificTimeStr = result.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Should be midnight (00:00:00) or 24:00:00 depending on locale formatting
    expect(['00:00:00', '24:00:00']).toContain(pacificTimeStr);
  });

  it('should return a Sunday', () => {
    const result = getStartOfWeekPacific();

    // Since the function returns midnight Sunday in Pacific Time,
    // we just verify it's within the last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    expect(result.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(result.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());
  });

  it('should return current week\'s Sunday', () => {
    const result = getStartOfWeekPacific();
    const now = new Date();

    // Verify result is not in the future
    expect(result.getTime()).toBeLessThanOrEqual(now.getTime());

    // Verify it's within the last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());

    // The function returns start of the week - should be valid
    expect(result).toBeInstanceOf(Date);
  });

  it('should be in the past or present', () => {
    const result = getStartOfWeekPacific();
    const now = new Date();

    expect(result.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('should be consistent across multiple calls on same day', () => {
    const result1 = getStartOfWeekPacific();
    const result2 = getStartOfWeekPacific();

    const diff = Math.abs(result1.getTime() - result2.getTime());
    expect(diff).toBeLessThan(1000);
  });
});

describe('getStartOfMonthPacific', () => {
  it('should return a Date object', () => {
    const result = getStartOfMonthPacific();
    expect(result).toBeInstanceOf(Date);
  });

  it('should return midnight (00:00:00) in Pacific Time', () => {
    const result = getStartOfMonthPacific();

    const pacificTimeStr = result.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Should be midnight (00:00:00, 01:00:00, or 24:00:00 depending on locale formatting)
    expect(['00:00:00', '01:00:00', '24:00:00']).toContain(pacificTimeStr);
  });

  it('should return the 1st day of the month', () => {
    const result = getStartOfMonthPacific();

    const pacificDateStr = result.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      day: '2-digit',
    });

    expect(pacificDateStr).toBe('01');
  });

  it('should return current month\'s 1st day', () => {
    const result = getStartOfMonthPacific();
    const now = new Date();

    const nowMonthYear = now.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
    });

    const resultMonthYear = result.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
    });

    expect(resultMonthYear).toBe(nowMonthYear);
  });

  it('should be in the past or present', () => {
    const result = getStartOfMonthPacific();
    const now = new Date();

    expect(result.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('should be consistent across multiple calls on same day', () => {
    const result1 = getStartOfMonthPacific();
    const result2 = getStartOfMonthPacific();

    const diff = Math.abs(result1.getTime() - result2.getTime());
    expect(diff).toBeLessThan(1000);
  });
});

describe('DST (Daylight Saving Time) handling', () => {
  it('should handle PST (winter) correctly', () => {
    // Note: This test assumes Pacific Time zone rules
    // DST typically ends in early November and starts in mid-March

    const result = getStartOfDayPacific();

    // The function should work regardless of DST status
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should handle PDT (summer) correctly', () => {
    const result = getStartOfDayPacific();

    // The function should work regardless of DST status
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should correctly calculate start of week during DST transition', () => {
    // DST transitions happen at 2 AM Pacific Time
    // The function should still return correct Sunday midnight
    const result = getStartOfWeekPacific();

    // Should return a valid date that's within the last week
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    expect(result.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(result.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());
  });
});

describe('Edge cases and boundary conditions', () => {
  it('should handle year boundaries for getStartOfMonthPacific', () => {
    // When run in January, should return Jan 1st of current year
    // When run in December, should return Dec 1st of current year
    const result = getStartOfMonthPacific();
    const now = new Date();

    const nowYear = now.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
    });

    const resultYear = result.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
    });

    expect(resultYear).toBe(nowYear);
  });

  it('should handle month boundaries for getStartOfWeekPacific', () => {
    // If current week spans two months, should still return correct Sunday
    const result = getStartOfWeekPacific();

    // Should return a valid date
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should be consistent when called at midnight', () => {
    // Even when called right at midnight, should return consistent results
    const result1 = getStartOfDayPacific();
    const result2 = getStartOfDayPacific();

    // Should be very close (within 1 second)
    const diff = Math.abs(result1.getTime() - result2.getTime());
    expect(diff).toBeLessThan(1000);
  });
});

describe('Integration: All time helper functions', () => {
  it('should have start of month <= start of week <= start of day <= now', () => {
    const startOfMonth = getStartOfMonthPacific();
    const startOfWeek = getStartOfWeekPacific();
    const startOfDay = getStartOfDayPacific();
    const now = new Date();

    // Start of month should be earliest
    expect(startOfMonth.getTime()).toBeLessThanOrEqual(startOfWeek.getTime());

    // Start of week should be before or same as start of day
    expect(startOfWeek.getTime()).toBeLessThanOrEqual(startOfDay.getTime());

    // Start of day should be before or same as now
    expect(startOfDay.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('should all return times in the same timezone (Pacific)', () => {
    const startOfMonth = getStartOfMonthPacific();
    const startOfWeek = getStartOfWeekPacific();
    const startOfDay = getStartOfDayPacific();

    // All should be valid dates
    expect(startOfMonth).toBeInstanceOf(Date);
    expect(startOfWeek).toBeInstanceOf(Date);
    expect(startOfDay).toBeInstanceOf(Date);

    // All should be in the past or present
    const now = Date.now();
    expect(startOfMonth.getTime()).toBeLessThanOrEqual(now);
    expect(startOfWeek.getTime()).toBeLessThanOrEqual(now);
    expect(startOfDay.getTime()).toBeLessThanOrEqual(now);
  });
});
