import puppeteer, { Browser } from 'puppeteer';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StatsChart, DataPoint } from '../components/StatsChart';

export class StatsImageService {
  private browser: Browser | null = null;

  /**
   * Pre-initialize the browser to avoid delays on first use
   */
  async warmup(): Promise<void> {
    console.log('[StatsImageService] Warming up browser...');
    await this.getBrowser();
    console.log('[StatsImageService] Browser ready');
  }

  /**
   * Initialize the browser instance (reusable for performance)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
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
   * Generate a Duolingo-style stats chart image using React + Tailwind
   */
  async generateStatsImage(
    username: string,
    metric: 'hours' | 'xp' | 'sessions' | 'totalHours',
    timeframe: 'week' | 'month' | 'year',
    data: DataPoint[],
    currentValue: number,
    previousValue: number,
    avatarUrl?: string
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to match our card size (wider for chart)
      await page.setViewport({ width: 1200, height: 700 });

      // Render React component to HTML
      const component = React.createElement(StatsChart, {
        username,
        avatarUrl,
        metric,
        timeframe,
        data,
        currentValue,
        previousValue,
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
              body {
                margin: 0;
                padding: 0;
                width: 1200px;
                height: 700px;
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

      // Load the HTML
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 1200, height: 700 },
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
