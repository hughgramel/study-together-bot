/**
 * Leveled Achievements Image Service - Renders achievement list as images
 *
 * Uses Puppeteer to render the LeveledAchievementsList React component as a PNG image
 * for Discord embeds. Maintains a reusable browser instance for performance.
 *
 * @module services/leveledAchievementsImage
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LeveledAchievementsList from '../components/LeveledAchievementsList';
import { browserPool } from './browserPool';

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: number;
  currentLevel: number;
  maxLevel: number;
  currentProgress: number;
  nextThreshold: number | null;
  unit: string;
}

/**
 * Service for rendering leveled achievements list as images
 */
class LeveledAchievementsImageService {
  /**
   * Generate a leveled achievements list image
   *
   * @param username - User's display name
   * @param avatarUrl - URL to user's avatar image
   * @param achievements - Array of achievement progress data
   * @param totalBoost - Total XP boost percentage
   * @param lightMode - Whether to use light mode (default: false)
   * @returns PNG image buffer
   */
  async generateAchievementsImage(
    username: string,
    avatarUrl: string,
    achievements: Achievement[],
    totalBoost: number,
    lightMode: boolean = false
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Make it square: 700x700
      const cardHeight = 700;

      // Render React component to HTML
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(LeveledAchievementsList, {
          username,
          avatarUrl,
          achievements,
          totalBoost,
          lightMode,
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
              @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
              :root {
                --font-main: 'Nunito', sans-serif;
              }
              body {
                margin: 0;
                padding: 0;
                width: 700px;
                height: ${cardHeight}px;
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
      await page.setViewport({
        width: 700,
        height: cardHeight,
        deviceScaleFactor: 2, // 2x resolution for crisp images
      });

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
}

// Export singleton instance
export const leveledAchievementsImageService = new LeveledAchievementsImageService();
