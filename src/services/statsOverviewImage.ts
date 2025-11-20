import puppeteer, { Browser } from 'puppeteer';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StatsOverview } from '../components/StatsOverview';

export class StatsOverviewImageService {
  private browser: Browser | null = null;

  /**
   * Initialize the browser instance (reusable for performance)
   */
  private async getBrowser(): Promise<Browser> {
    // Check if browser is connected, if not recreate it
    if (this.browser && !this.browser.connected) {
      console.log('[StatsOverviewImageService] Browser disconnected, recreating...');
      this.browser = null;
    }

    if (!this.browser) {
      console.log('[StatsOverviewImageService] Launching new browser instance...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Generate a Duolingo-style stats overview image
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
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to exact square dimensions
      await page.setViewport({
        width: 700,
        height: 700,
        deviceScaleFactor: 1
      });

      // Render React component to HTML
      const component = React.createElement(StatsOverview, {
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
   * Clean up browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
