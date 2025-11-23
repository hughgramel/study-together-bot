/**
 * Level Up Image Service - Renders level-up celebration cards as images
 *
 * Uses Puppeteer to render the LevelUpCard React component as a PNG image for
 * Discord embeds. Maintains a reusable browser instance for performance. Used when
 * users level up to display celebration cards in Discord channels.
 *
 * @module services/levelUpImage
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LevelUpCard from '../components/LevelUpCard';
import { createLogger } from '../utils/logger';
import { browserPool } from './browserPool';

const logger = createLogger('LevelUpImageService');

/**
 * Service for rendering level-up celebration cards as images
 */
class LevelUpImageService {
  // Browser management now handled by shared browser pool

  /**
   * Generate a level-up celebration image
   *
   * @param username - User's display name
   * @param avatarUrl - URL to user's avatar image
   * @param newLevel - The new level achieved
   * @param hoursToNext - Hours needed to reach next level
   * @returns PNG image buffer
   */
  async generateLevelUpImage(
    username: string,
    avatarUrl: string,
    newLevel: number,
    hoursToNext: number
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Render React component to HTML
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(LevelUpCard, {
          username,
          avatarUrl,
          newLevel,
          hoursToNext,
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
   * Cleanup browser resources (now handled by browser pool)
   */
  async cleanup(): Promise<void> {
    // Browser cleanup is now handled by the shared browser pool
    // This method is kept for backwards compatibility
  }
}

export const levelUpImageService = new LevelUpImageService();
