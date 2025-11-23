/**
 * Task Parser Utility - Extracts numbered tasks from Discord messages
 *
 * Parses messages that contain numbered lists and extracts individual task items.
 * Supports various numbering formats: "1.", "1)", "1 -", etc.
 *
 * @module utils/taskParser
 */

/**
 * Parses a message for numbered list items
 *
 * Supports formats:
 * - "1. Task description"
 * - "1) Task description"
 * - "1 - Task description"
 * - "1: Task description"
 *
 * @param messageContent - Discord message content
 * @returns Array of task descriptions (without numbers), or null if no valid numbered list found
 *
 * @example
 * parseNumberedList("1. Study for exam\n2. Do homework")
 * // Returns: ["Study for exam", "Do homework"]
 */
export function parseNumberedList(messageContent: string): string[] | null {
  const lines = messageContent.split('\n');
  const tasks: string[] = [];

  // Regex to match numbered list items
  // Matches: "1.", "1)", "1:", "1 -", etc. at the start of a line
  const numberedItemRegex = /^\s*(\d+)[\.\)\:\-]\s+(.+)$/;

  let foundNumberedItem = false;
  let expectedNumber = 1;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      continue;
    }

    const match = trimmedLine.match(numberedItemRegex);

    if (match) {
      foundNumberedItem = true;
      const taskNumber = parseInt(match[1], 10);
      const taskDescription = match[2].trim();

      // Only add if task description is not empty
      if (taskDescription) {
        tasks.push(taskDescription);
      }

      // Track expected sequential numbering (but don't enforce it strictly)
      expectedNumber = taskNumber + 1;
    } else if (foundNumberedItem && trimmedLine.match(/^\d+/)) {
      // Line starts with a number but doesn't match our format - might be malformed
      // Continue to see if there are more valid items
      continue;
    }
  }

  // Return tasks if we found at least one valid numbered item
  if (tasks.length > 0) {
    return tasks;
  }

  return null;
}

/**
 * Validates if a message contains a properly formatted numbered list
 *
 * @param messageContent - Discord message content
 * @returns True if message contains at least one numbered item
 */
export function isNumberedList(messageContent: string): boolean {
  return parseNumberedList(messageContent) !== null;
}

/**
 * Counts the number of tasks in a numbered list
 *
 * @param messageContent - Discord message content
 * @returns Number of tasks found, or 0 if no valid numbered list
 */
export function countTasks(messageContent: string): number {
  const tasks = parseNumberedList(messageContent);
  return tasks ? tasks.length : 0;
}
