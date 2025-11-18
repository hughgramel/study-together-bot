import { CommandInteraction } from 'discord.js';
import { AnalyticsService } from './analytics.service';

/**
 * Analytics middleware for Discord.js command interactions
 *
 * Usage: Wrap your command handler with trackCommand() to automatically
 * track execution time, success/failure, and errors.
 *
 * Example:
 * ```typescript
 * await analyticsMiddleware.trackCommand(interaction, async () => {
 *   // Your command logic here
 *   await interaction.reply('Success!');
 * });
 * ```
 */
export class AnalyticsMiddleware {
  private analyticsService: AnalyticsService;

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  /**
   * Track command execution with automatic timing and error handling
   *
   * @param interaction - Discord command interaction
   * @param handler - Async function containing command logic
   * @returns Promise that resolves when handler completes
   */
  async trackCommand(
    interaction: CommandInteraction,
    handler: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    const commandName = interaction.commandName;
    const userId = interaction.user.id;
    const serverId = interaction.guildId || 'DM';

    let success = true;
    let errorMessage: string | undefined;

    try {
      // Execute the command handler
      await handler();
    } catch (error: any) {
      success = false;
      errorMessage = error.message || 'Unknown error';

      // Re-throw the error so the bot can handle it
      throw error;
    } finally {
      // Track command execution (even if it failed)
      const responseTime = Date.now() - startTime;

      // Fire-and-forget analytics tracking (don't await)
      this.analyticsService
        .trackCommand(userId, serverId, commandName, success, responseTime, errorMessage)
        .catch((err) => {
          // Silently fail - analytics should never crash the bot
          console.error('[Analytics] Tracking error:', err.message);
        });
    }
  }

  /**
   * Track command execution without wrapping (manual tracking)
   *
   * Use this when you need more control over timing or error handling
   *
   * @param interaction - Discord command interaction
   * @param success - Whether command succeeded
   * @param responseTimeMs - Execution time in milliseconds
   * @param errorMessage - Optional error message if failed
   */
  async trackCommandManual(
    interaction: CommandInteraction,
    success: boolean,
    responseTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    const commandName = interaction.commandName;
    const userId = interaction.user.id;
    const serverId = interaction.guildId || 'DM';

    await this.analyticsService
      .trackCommand(userId, serverId, commandName, success, responseTimeMs, errorMessage)
      .catch((err) => {
        console.error('[Analytics] Tracking error:', err.message);
      });
  }
}

/**
 * Utility function to create a tracked command handler
 *
 * This is a higher-order function that wraps your command handler
 * with automatic analytics tracking.
 *
 * Example:
 * ```typescript
 * const trackedHandler = createTrackedHandler(analyticsService, async (interaction) => {
 *   await interaction.reply('Hello!');
 * });
 *
 * // Use it in your command handler
 * if (commandName === 'hello') {
 *   await trackedHandler(interaction);
 * }
 * ```
 */
export function createTrackedHandler(
  analyticsService: AnalyticsService,
  handler: (interaction: CommandInteraction) => Promise<void>
): (interaction: CommandInteraction) => Promise<void> {
  const middleware = new AnalyticsMiddleware(analyticsService);

  return async (interaction: CommandInteraction) => {
    await middleware.trackCommand(interaction, () => handler(interaction));
  };
}

/**
 * Performance monitoring decorator
 *
 * Tracks execution time of any async function and logs slow operations
 *
 * @param threshold - Time in ms above which to log warning (default: 3000ms)
 */
export function monitorPerformance(threshold: number = 3000) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const result = await method.apply(this, args);
      const duration = Date.now() - startTime;

      if (duration > threshold) {
        console.warn(
          `[Performance] ${target.constructor.name}.${propertyName} took ${duration}ms (threshold: ${threshold}ms)`
        );
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Batch tracker for tracking multiple events efficiently
 *
 * Use this when you need to track many events at once (e.g., processing
 * multiple users' sessions in a cron job)
 */
export class BatchTracker {
  private analyticsService: AnalyticsService;
  private events: Array<() => Promise<void>> = [];

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  /**
   * Add a tracking event to the batch
   */
  add(trackingFn: () => Promise<void>): void {
    this.events.push(trackingFn);
  }

  /**
   * Execute all tracking events in parallel
   */
  async flush(): Promise<void> {
    await Promise.allSettled(this.events.map((fn) => fn()));
    this.events = [];
  }

  /**
   * Get number of pending events
   */
  get size(): number {
    return this.events.length;
  }
}
