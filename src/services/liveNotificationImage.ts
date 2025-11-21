import puppeteer, { Browser } from 'puppeteer';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LiveNotificationCard from '../components/LiveNotificationCard';

interface LiveUser {
  username: string;
  avatarUrl: string;
  activity: string;
  duration: string;
  isPaused: boolean;
}

class LiveNotificationImageService {
  private browser: Browser | null = null;

  /**
   * Initialize the browser instance (reusable for performance)
   */
  private async getBrowser(): Promise<Browser> {
    // Check if browser exists and is still connected
    if (this.browser && !this.browser.connected) {
      console.log('[LiveNotificationImageService] Browser disconnected, recreating...');
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore errors when closing disconnected browser
      }
      this.browser = null;
    }

    if (!this.browser) {
      console.log('[LiveNotificationImageService] Launching new browser instance...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });
      console.log('[LiveNotificationImageService] Browser launched successfully');
    }

    return this.browser;
  }

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
    const browser = await this.getBrowser();
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

      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

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
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const liveNotificationImageService = new LiveNotificationImageService();
