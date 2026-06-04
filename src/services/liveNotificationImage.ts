/**
 * Live Notification Image Service - Renders live session lists as images
 *
 * Uses Puppeteer to render the LiveNotificationCard React component as a PNG image
 * showing all currently active study sessions. Displays up to 10 users with their
 * activities, durations, and pause status. Maintains a reusable browser instance
 * for performance.
 *
 * @module services/liveNotificationImage
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LiveNotificationCard from '../components/LiveNotificationCard';
import { createLogger } from '../utils/logger';
import { browserPool } from './browserPool';

const logger = createLogger('LiveNotificationImageService');

interface LiveUser {
  username: string;
  avatarUrl: string;
  activity: string;
  duration: string;
  isPaused: boolean;
}

/**
 * Service for rendering live notification cards as images
 */
class LiveNotificationImageService {
  // Browser management now handled by shared browser pool

  /**
   * Generate a live session notification image
   *
   * @param users - Array of live users (max 10 will be displayed)
   * @param totalCount - Total number of live users
   * @returns PNG image buffer
   */
  async generateLiveNotificationImage(
    users: LiveUser[],
    totalCount: number
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Render React component to HTML
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(LiveNotificationCard, {
          users,
          totalCount,
        })
      );

      // Calculate dynamic height based on number of users
      const displayUsers = users.slice(0, 10);
      const remainingCount = totalCount - displayUsers.length;
      const baseHeight = 100;
      const userItemHeight = 58;
      const footerHeight = remainingCount > 0 ? 40 : 0;
      const totalHeight = baseHeight + (displayUsers.length * userItemHeight) + footerHeight;

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
                height: ${totalHeight}px;
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

      // domcontentloaded is when Tailwind CDN script runs; don't wait for networkidle0
      // because 10 avatar images + CDN keep connections open indefinitely
      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 10000 });
      // Wait for fonts (Google Fonts), but not for images
      await new Promise(resolve => setTimeout(resolve, 300));

      // Set viewport to match card size
      await page.setViewport({ width: 500, height: totalHeight, deviceScaleFactor: 2 });

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

export const liveNotificationImageService = new LiveNotificationImageService();
