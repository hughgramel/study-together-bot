/**
 * Session Start Image Service - Renders session start notifications as images
 *
 * Uses Puppeteer to render the SessionStartCard React component as a PNG image for
 * Discord embeds. Displays when a user starts a new study session with their activity.
 * Maintains a reusable browser instance for performance.
 *
 * @module services/sessionStartImage
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import SessionStartCard from '../components/SessionStartCard';
import { createLogger } from '../utils/logger';
import { browserPool } from './browserPool';

const logger = createLogger('SessionStartImageService');

/**
 * Service for rendering session start notification cards as images
 */
class SessionStartImageService {
  // Browser management now handled by shared browser pool

  /**
   * Generate a session start notification image
   *
   * @param username - User's display name
   * @param avatarUrl - URL to user's avatar image
   * @param activity - What the user is working on
   * @returns PNG image buffer
   */
  async generateSessionStartImage(
    username: string,
    avatarUrl: string,
    activity: string
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Render React component to HTML
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SessionStartCard, {
          username,
          avatarUrl,
          activity,
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

export const sessionStartImageService = new SessionStartImageService();
