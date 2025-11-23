/**
 * Logger Utility
 *
 * Centralized logging utility with different log levels and timestamps.
 * Provides consistent logging format across the application.
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Color codes for console output
 */
const colors = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m',  // Green
  WARN: '\x1b[33m',  // Yellow
  ERROR: '\x1b[31m', // Red
  RESET: '\x1b[0m',
};

/**
 * Logger class
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Format log message with timestamp and context
   */
  private format(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const color = colors[level];
    const reset = colors.RESET;
    const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
    return `${color}[${timestamp}] [${level}] [${this.context}]${reset} ${message}${dataStr}`;
  }

  /**
   * Debug log - verbose information for development
   */
  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.format(LogLevel.DEBUG, message, data));
    }
  }

  /**
   * Info log - general informational messages
   */
  info(message: string, data?: unknown): void {
    console.log(this.format(LogLevel.INFO, message, data));
  }

  /**
   * Warn log - warning messages for potential issues
   */
  warn(message: string, data?: unknown): void {
    console.warn(this.format(LogLevel.WARN, message, data));
  }

  /**
   * Error log - error messages with optional error object
   */
  error(message: string, error?: Error | unknown): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(this.format(LogLevel.ERROR, message, errorData));
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
