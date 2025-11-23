/**
 * Stats Overview Image Service (Light Mode) - Renders light mode stats breakdowns
 *
 * Light mode version using StatsOverviewLight with white backgrounds.
 *
 * @module services/statsOverviewImageLight
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StatsOverviewLight } from '../components/StatsOverviewLight';
import { browserPool } from './browserPool';

/**
 * Service for rendering light mode statistics overview cards as images
 */
export class StatsOverviewImageLightService {
  /**
   * Generate a light mode stats overview image
   */
  async generateStatsOverviewImage(
    username: string,
    metric: 'hours' | 'sessions' | 'xp',
    timeframe: 'today' | 'week' | 'month' | 'all-time',
    currentValue: number,
    previousValue: number,
    breakdown: { label: string; value: number }[],
    avatarUrl?: string,
    highlightIndex?: number
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to exact square dimensions
      await page.setViewport({
        width: 700,
        height: 700,
        deviceScaleFactor: 1
      });

      // Render React component to HTML
      const component = React.createElement(StatsOverviewLight, {
        username,
        avatarUrl,
        metric,
        timeframe,
        currentValue,
        previousValue,
        breakdown,
        highlightIndex,
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
              * {
                box-sizing: border-box;
                font-family: var(--font-main);
              }
              body {
                margin: 0;
                padding: 0;
                width: 700px;
                max-width: 700px;
                min-width: 700px;
                height: 700px;
                max-height: 700px;
                min-height: 700px;
                overflow: hidden;
                font-family: var(--font-main);
                background-color: white;
              }
              body > div {
                width: 700px !important;
                max-width: 700px !important;
                min-width: 700px !important;
                height: 700px !important;
                max-height: 700px !important;
                min-height: 700px !important;
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

      // Wait for content to render and fonts to load
      await page.waitForSelector('body > div');
      await page.evaluate('document.fonts.ready');

      // Take screenshot with exact square dimensions
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: false,
        clip: {
          x: 0,
          y: 0,
          width: 700,
          height: 700
        },
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
