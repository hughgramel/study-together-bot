/**
 * Stats Image Service - Renders statistics charts as images
 *
 * Uses Puppeteer to render the StatsChart React component as a PNG image for
 * Discord embeds. Creates bar charts showing user statistics over time (week,
 * month, year) for different metrics (hours, XP, sessions). Maintains a reusable
 * browser instance for performance.
 *
 * @module services/statsImage
 */

import puppeteer, { Browser } from 'puppeteer';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StatsChart, DataPoint } from '../components/StatsChart';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsImageService');

/**
 * Service for rendering statistics charts as images
 */
export class StatsImageService {
  private browser: Browser | null = null;

  /**
   * Pre-initializes the browser instance to avoid delays on first use
   *
   * Should be called during bot startup to ensure browser is ready.
   */
  async warmup(): Promise<void> {
    logger.info('Warming up browser...');
    await this.getBrowser();
    logger.info('Browser ready');
  }

  /**
   * Initialize the browser instance (reusable for performance)
   */
  private async getBrowser(): Promise<Browser> {
    // Check if browser exists and is still connected
    if (this.browser && !this.browser.connected) {
      logger.info('Browser disconnected, recreating...');
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore errors when closing disconnected browser
      }
      this.browser = null;
    }

    if (!this.browser) {
      logger.info('Launching new browser instance...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Generate a stats chart image using React + Tailwind
   */
  async generateStatsImage(
    username: string,
    metric: 'hours' | 'xp' | 'sessions' | 'totalHours',
    timeframe: 'week' | 'month' | 'year',
    data: DataPoint[],
    currentValue: number,
    previousValue: number,
    avatarUrl?: string
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to match our card size (wider for chart)
      await page.setViewport({ width: 1200, height: 700 });

      // Render React component to HTML
      const component = React.createElement(StatsChart, {
        username,
        avatarUrl,
        metric,
        timeframe,
        data,
        currentValue,
        previousValue,
      });

      const html = ReactDOMServer.renderToStaticMarkup(component);

      // Create full HTML page with Tailwind CDN
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
              :root {
                --font-main: 'Nunito', sans-serif;
              }
              body {
                margin: 0;
                padding: 0;
                width: 1200px;
                height: 700px;
                overflow: hidden;
                font-family: var(--font-main);
              }
              * {
                font-family: var(--font-main);
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      // Load the HTML
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 1200, height: 700 },
      });

      return screenshot as Buffer;
    } finally {
      await page.close();
    }
  }

  /**
   * Clean up browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
