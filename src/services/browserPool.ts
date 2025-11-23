/**
 * Browser Pool Service - Manages a single shared Puppeteer browser instance
 *
 * Prevents resource exhaustion by ensuring only one browser instance exists
 * across all image generation services. Handles automatic reconnection and
 * proper cleanup on shutdown.
 *
 * @module services/browserPool
 */

import puppeteer, { Browser } from 'puppeteer';

/**
 * Singleton service that manages a single shared browser instance
 * for all Puppeteer-based image generation
 */
class BrowserPoolService {
  private browser: Browser | null = null;
  private isLaunching: boolean = false;
  private launchPromise: Promise<Browser> | null = null;

  /**
   * Get the shared browser instance, creating it if necessary
   * Handles concurrent requests by queueing them until browser is ready
   */
  async getBrowser(): Promise<Browser> {
    // If browser exists and is connected, return it
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // If browser is disconnected, clean it up
    if (this.browser && !this.browser.connected) {
      console.log('[BrowserPool] Browser disconnected, will recreate...');
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore errors when closing disconnected browser
      }
      this.browser = null;
    }

    // If another request is already launching the browser, wait for it
    if (this.isLaunching && this.launchPromise) {
      console.log('[BrowserPool] Browser launch in progress, waiting...');
      return this.launchPromise;
    }

    // Launch a new browser
    this.isLaunching = true;
    this.launchPromise = this.launchBrowser();

    try {
      this.browser = await this.launchPromise;
      return this.browser;
    } finally {
      this.isLaunching = false;
      this.launchPromise = null;
    }
  }

  /**
   * Launch a new browser instance with optimized settings for Railway/production
   * Supports both Windows and Unix-based systems
   */
  private async launchBrowser(): Promise<Browser> {
    const isWindows = process.platform === 'win32';
    const isProduction = process.env.NODE_ENV === 'production';

    console.log(
      `[BrowserPool] Launching browser on ${process.platform} (${isProduction ? 'production' : 'development'})`
    );

    // Base args that work on all platforms
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-dev-tools',
      '--no-first-run',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--metrics-recording-only',
      '--mute-audio',
    ];

    // Add platform-specific args
    const platformArgs = isWindows
      ? [
          // Windows-specific args
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
        ]
      : [
          // Unix-specific args
          '--no-zygote',
        ];

    // Only use single-process in production (Railway) to prevent thread exhaustion
    // On Windows development, avoid single-process as it can cause crashes
    const processArgs =
      isProduction && !isWindows ? ['--single-process'] : [];

    try {
      // Get executable path for debugging
      const executablePath = isWindows
        ? process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath()
        : puppeteer.executablePath();

      console.log(`[BrowserPool] Chrome executable: ${executablePath}`);
      console.log(
        `[BrowserPool] Launch args: ${[...baseArgs, ...platformArgs, ...processArgs].join(' ')}`
      );

      const browser = await puppeteer.launch({
        headless: true,
        args: [...baseArgs, ...platformArgs, ...processArgs],
        // Set timeout to prevent hanging
        timeout: 30000,
        // On Windows, explicitly handle executable path if needed
        ...(isWindows && {
          executablePath,
        }),
      });

      console.log(`[BrowserPool] Browser launched successfully`);

      // Set up cleanup on process termination
      process.once('SIGINT', () => this.cleanup());
      process.once('SIGTERM', () => this.cleanup());

      return browser;
    } catch (error) {
      console.error('[BrowserPool] Failed to launch browser:', error);
      throw error;
    }
  }

  /**
   * Pre-warm the browser during bot startup
   * Makes startup slower but catches browser issues early
   * If warmup fails, browser will be launched on-demand instead
   */
  async warmup(): Promise<void> {
    console.log('[BrowserPool] Warming up browser...');

    try {
      await this.getBrowser();
      console.log('[BrowserPool] Browser ready');
    } catch (error) {
      console.error('[BrowserPool] Browser warmup failed:', error);
      console.log(
        '[BrowserPool] Bot will continue - browser will launch on-demand when needed'
      );
      // Don't throw - allow bot to start even if browser warmup fails
      // Browser will be launched on-demand when image generation is needed
    }
  }

  /**
   * Close the browser and clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      console.log('[BrowserPool] Closing browser...');
      try {
        await this.browser.close();
      } catch (e) {
        console.error('[BrowserPool] Error closing browser:', e);
      }
      this.browser = null;
    }
  }

  /**
   * Get current browser status for debugging
   */
  getStatus(): { connected: boolean; isLaunching: boolean } {
    return {
      connected: this.browser?.connected || false,
      isLaunching: this.isLaunching,
    };
  }
}

// Export singleton instance
export const browserPool = new BrowserPoolService();
