/**
 * Time Helpers Utility - Pacific Time zone helpers
 *
 * Provides utility functions for getting start of day/week/month in Pacific Time.
 * Used for stats calculations and leaderboards.
 *
 * @module utils/timeHelpers
 */

/**
 * Gets the start of the current day in Pacific Time
 *
 * @returns Date object representing midnight Pacific Time today
 */
export function getStartOfDayPacific(): Date {
  const now = new Date();

  // Convert current time to Pacific Time
  const pacificTimeStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse the Pacific time string (MM/DD/YYYY, HH:mm:ss)
  const [datePart] = pacificTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');

  // Create a date string for midnight Pacific Time
  // Use PST offset (-08:00) for winter, PDT (-07:00) for summer
  // JavaScript will handle the conversion automatically
  const pacificDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  // Determine if we're in PST or PDT by checking if DST is active
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdTimezoneOffset;

  // Create midnight Pacific Time (use -07:00 for PDT, -08:00 for PST)
  const offset = isDST ? '-07:00' : '-08:00';
  const midnightPacific = new Date(`${pacificDateStr}T00:00:00${offset}`);

  return midnightPacific;
}

/**
 * Gets the start of the current week (Sunday) in Pacific Time
 *
 * @returns Date object representing midnight Pacific Time on Sunday of current week
 */
export function getStartOfWeekPacific(): Date {
  const now = new Date();

  // Convert current time to Pacific Time
  const pacificTimeStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse the Pacific time string
  const [datePart] = pacificTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');

  // Create a date object for today in Pacific Time
  const pacificDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);

  // Get day of week (0 = Sunday, 6 = Saturday)
  const pacificDayOfWeek = pacificDate.getDay();

  // Calculate days to subtract to get to Sunday
  const daysToSubtract = pacificDayOfWeek;

  // Subtract days to get to Sunday
  pacificDate.setDate(pacificDate.getDate() - daysToSubtract);

  // Determine if we're in PST or PDT
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdTimezoneOffset;

  // Create midnight Pacific Time for that Sunday
  const offset = isDST ? '-07:00' : '-08:00';
  const sundayMidnight = new Date(`${pacificDate.toISOString().split('T')[0]}T00:00:00${offset}`);

  return sundayMidnight;
}

/**
 * Gets the start of the current month in Pacific Time
 *
 * @returns Date object representing midnight Pacific Time on the 1st of the current month
 */
export function getStartOfMonthPacific(): Date {
  const now = new Date();

  // Convert current time to Pacific Time
  const pacificTimeStr = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse the Pacific time string
  const [datePart] = pacificTimeStr.split(', ');
  const [month, day, year] = datePart.split('/');

  // Create date string for 1st of the month
  const firstOfMonth = `${year}-${month.padStart(2, '0')}-01`;

  // Determine if we're in PST or PDT
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdTimezoneOffset;

  // Create midnight Pacific Time for the 1st
  const offset = isDST ? '-07:00' : '-08:00';
  const firstOfMonthMidnight = new Date(`${firstOfMonth}T00:00:00${offset}`);

  return firstOfMonthMidnight;
}
