/**
 * Error Handler Middleware
 *
 * Centralized error handling for command execution.
 * Provides consistent error responses and logging.
 */

import { CommandInteraction } from 'discord.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorHandler');

/**
 * Custom error class for command errors
 */
export class CommandError extends Error {
  public readonly isOperational: boolean;
  public readonly userMessage: string;

  constructor(message: string, userMessage?: string, isOperational = true) {
    super(message);
    this.name = 'CommandError';
    this.userMessage = userMessage || message;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle command execution errors
 */
export async function handleCommandError(
  error: Error,
  interaction: CommandInteraction
): Promise<void> {
  logger.error('Command execution failed', error);

  // Determine user-facing error message
  let userMessage = 'An unexpected error occurred. Please try again later.';

  if (error instanceof CommandError && error.isOperational) {
    userMessage = error.userMessage;
  }

  // Send error response to user
  try {
    const errorPayload = {
      content: `❌ ${userMessage}`,
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorPayload);
    } else {
      await interaction.reply(errorPayload);
    }
  } catch (replyError) {
    logger.error('Failed to send error response to user', replyError);
  }
}

/**
 * Wrap command execute function with error handling
 */
export function withErrorHandling<T extends any[]>(
  fn: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      // Find the interaction in args
      const interaction = args.find(
        (arg) => arg && typeof arg === 'object' && 'reply' in arg
      ) as CommandInteraction | undefined;

      if (interaction) {
        await handleCommandError(
          error instanceof Error ? error : new Error(String(error)),
          interaction
        );
      } else {
        logger.error('Error occurred but no interaction found', error);
      }
    }
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(requiredVars: string[]): void {
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
