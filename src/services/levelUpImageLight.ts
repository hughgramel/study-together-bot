/**
 * Level Up Image Light Service - Renders light mode level-up celebration cards as images
 *
 * Light mode version using Puppeteer to render the LevelUpCardLight React component.
 *
 * @module services/levelUpImageLight
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LevelUpCardLight from '../components/LevelUpCardLight';
import { createLogger } from '../utils/logger';
import { browserPool } from './browserPool';

const logger = createLogger('LevelUpImageLightService');

/**
 * Service for rendering level-up celebration cards as images (light mode)
 */
class LevelUpImageLightService {
  // Browser management now handled by shared browser pool

  /**
   * Generate a level-up celebration image in light mode
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
        React.createElement(LevelUpCardLight, {
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

export const levelUpImageLightService = new LevelUpImageLightService();
