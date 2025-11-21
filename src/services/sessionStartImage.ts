import puppeteer, { Browser } from 'puppeteer';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import SessionStartCard from '../components/SessionStartCard';

class SessionStartImageService {
  private browser: Browser | null = null;

  /**
   * Initialize the browser instance (reusable for performance)
   */
  private async getBrowser(): Promise<Browser> {
    // Check if browser exists and is still connected
    if (this.browser && !this.browser.connected) {
      console.log('[SessionStartImageService] Browser disconnected, recreating...');
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore errors when closing disconnected browser
      }
      this.browser = null;
    }

    if (!this.browser) {
      console.log('[SessionStartImageService] Launching new browser instance...');
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
      console.log('[SessionStartImageService] Browser launched successfully');
    }

    return this.browser;
  }

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
    const browser = await this.getBrowser();
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
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const sessionStartImageService = new SessionStartImageService();
