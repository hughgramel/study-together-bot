/**
 * Streak Image Service - Renders streak milestone cards as images
 *
 * Uses Puppeteer to render the StreakCard React component as a PNG image for
 * Discord embeds. Displays celebration cards when users reach streak milestones
 * (3, 7, 14, 30+ days). Maintains a reusable browser instance for performance.
 *
 * @module services/streakImage
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import StreakCard from '../components/StreakCard';
import { browserPool } from './browserPool';

/**
 * Service for rendering streak milestone celebration cards as images
 */
class StreakImageService {
  // Browser management now handled by shared browser pool

  /**
   * Generate a streak milestone celebration image
   *
   * @param username - User's display name
   * @param avatarUrl - URL to user's avatar image
   * @param streak - Current streak number
   * @param message - Celebration message
   * @returns PNG image buffer
   */
  async generateStreakImage(
    username: string,
    avatarUrl: string,
    streak: number,
    message: string
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Render React component to HTML
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StreakCard, {
          username,
          avatarUrl,
          streak,
          message,
        })
      );

      // Create full HTML page with Tailwind CDN and Nunito font
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
                width: 500px;
                height: 140px;
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

      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      // Set viewport to match card size
      await page.setViewport({ width: 500, height: 140, deviceScaleFactor: 2 });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: false,
      });

      await page.close();

      return screenshot as Buffer;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    // Browser cleanup is now handled by the shared browser pool
    // This method is kept for backwards compatibility
  }
}

export const streakImageService = new StreakImageService();
