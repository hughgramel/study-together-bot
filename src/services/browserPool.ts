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
   */
  private async launchBrowser(): Promise<Browser> {
    console.log('[BrowserPool] Launching new browser instance...');

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-dev-tools',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Critical for Railway - prevents thread exhaustion
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
      ],
      // Set timeout to prevent hanging
      timeout: 30000,
    });

    console.log('[BrowserPool] Browser launched successfully');

    // Set up cleanup on process termination
    process.once('SIGINT', () => this.cleanup());
    process.once('SIGTERM', () => this.cleanup());

    return browser;
  }

  /**
   * Pre-warm the browser during bot startup
   */
  async warmup(): Promise<void> {
    console.log('[BrowserPool] Warming up browser...');
    await this.getBrowser();
    console.log('[BrowserPool] Browser ready');
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
