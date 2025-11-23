/**
 * Stats Image Service (Light Mode) - Renders light mode statistics charts
 *
 * Light mode version using StatsChartLight with white backgrounds.
 *
 * @module services/statsImageLight
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StatsChartLight, DataPoint } from '../components/StatsChartLight';
import { createLogger } from '../utils/logger';
import { browserPool } from './browserPool';

const logger = createLogger('StatsImageLightService');

/**
 * Service for rendering light mode statistics charts as images
 */
export class StatsImageLightService {
  /**
   * Pre-initializes the browser instance
   */
  async warmup(): Promise<void> {
    logger.info('Warming up browser...');
    await browserPool.warmup();
    logger.info('Browser ready');
  }

  /**
   * Generate a light mode stats chart image
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
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to match our card size (wider for chart)
      await page.setViewport({ width: 1200, height: 700 });

      // Render React component to HTML
      const component = React.createElement(StatsChartLight, {
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
                background-color: white;
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
   * Clean up browser instance (handled by browser pool)
   */
  async cleanup(): Promise<void> {
    // Browser cleanup is handled by the shared browser pool
  }
}
