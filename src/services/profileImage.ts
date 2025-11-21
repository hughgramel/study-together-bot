import puppeteer, { Browser } from 'puppeteer';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { UserStats } from '../types';
import { calculateLevel } from '../utils/xp';
import { ProfileCard } from '../components/ProfileCard';
import { LeaderboardCard } from '../components/LeaderboardCard';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string;
  xp: number;
  totalDuration: number;
  rank: number;
}

export class ProfileImageService {
  private browser: Browser | null = null;

  /**
   * Pre-initialize the browser to avoid delays on first use
   */
  async warmup(): Promise<void> {
    console.log('[ProfileImageService] Warming up browser...');
    await this.getBrowser();
    console.log('[ProfileImageService] Browser ready');
  }

  /**
   * Initialize the browser instance (reusable for performance)
   */
  private async getBrowser(): Promise<Browser> {
    // Check if browser exists and is still connected
    if (this.browser && !this.browser.connected) {
      console.log('[ProfileImageService] Browser disconnected, recreating...');
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore errors when closing disconnected browser
      }
      this.browser = null;
    }

    if (!this.browser) {
      console.log('[ProfileImageService] Launching new browser instance...');
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
   * Generate a profile image using React + Tailwind
   */
  async generateProfileImage(
    username: string,
    stats: UserStats | null,
    avatarUrl?: string
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to match our card size
      await page.setViewport({ width: 700, height: 650 });

      // Calculate stats
      const xp = stats?.xp || 0;
      const level = calculateLevel(xp);
      const currentStreak = stats?.currentStreak || 0;
      const totalSessions = stats?.totalSessions || 0;
      const achievementCount = stats?.achievements?.length || 0;
      const longestStreak = stats?.longestStreak || 0;
      const totalHours = Math.floor((stats?.totalDuration || 0) / 3600);

      // Render React component to HTML
      const component = React.createElement(ProfileCard, {
        username,
        avatarUrl,
        streak: currentStreak,
        xp,
        level,
        totalSessions,
        achievementCount,
        longestStreak,
        totalHours,
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
                width: 700px;
                height: 650px;
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
        clip: { x: 0, y: 0, width: 700, height: 650 },
      });

      return screenshot as Buffer;
    } finally {
      await page.close();
    }
  }

  /**
   * Generate a leaderboard image using React + Tailwind
   */
  async generateLeaderboardImage(
    timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time',
    entries: LeaderboardEntry[],
    currentUser?: LeaderboardEntry,
    currentUserId?: string
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set initial large viewport to render everything
      await page.setViewport({ width: 700, height: 2000 });

      // Render React component to HTML
      const component = React.createElement(LeaderboardCard, {
        timeframe,
        entries,
        currentUser,
        currentUserId,
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
                width: 700px;
                font-family: var(--font-main);
                background-color: #131F24;
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

      // Wait for Tailwind to fully process and render
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the actual height of the rendered content - try multiple methods
      const contentHeight = await page.evaluate(`
        (() => {
          const body = document.body;
          const firstChild = body.firstElementChild;

          if (firstChild) {
            // Try multiple measurement methods
            const rect = firstChild.getBoundingClientRect();
            const offsetHeight = firstChild.offsetHeight || 0;
            const scrollHeight = firstChild.scrollHeight || 0;

            // Return the largest measurement (most accurate)
            return Math.ceil(Math.max(rect.height, offsetHeight, scrollHeight));
          }
          return body.scrollHeight;
        })()
      `) as number;

      // Use measured height if available and valid, otherwise calculate
      let finalHeight = contentHeight;

      // If we got a valid measurement, add a buffer to ensure nothing is cut off
      if (finalHeight > 0 && contentHeight > 0) {
        finalHeight = Math.ceil(contentHeight + 150); // Add 150px buffer to be safe
      } else {
        // Fallback to calculation
        const entryCount = entries.length > 0 ? entries.length : 10;
        const hasCurrentUserForCalc = entries.length > 0
          ? !!currentUser
          : (timeframe === 'daily');

        // Precise height calculation based on actual Tailwind classes
        // Header with padding: mb-6 = 24px margin
        const headerHeight = 60 + 24;  // 84px

        // Container padding: p-8 pb-6 = 32px top, 24px bottom
        const containerPadding = 32 + 24;  // 56px

        // Each entry: p-3 = 12px padding all sides, height ~52px content
        const entryHeight = 68;  // 12 + 12 + ~44px content

        // Spacing between entries: space-y-2.5 = 10px
        const spacingHeight = entryCount > 0 ? (entryCount - 1) * 10 : 0;

        // Current user section: py-1 separator + entry + spacing before it
        // Being more generous here: separator (40px) + entry (80px) = 120px
        const extraUserHeight = hasCurrentUserForCalc ? 120 : 0;

        const calculatedHeight = headerHeight + containerPadding + (entryCount * entryHeight) + spacingHeight + extraUserHeight;

        // Add extra buffer to calculated height to ensure nothing is cut off
        finalHeight = calculatedHeight + 50;
      }

      console.log('[LeaderboardImage] Generating image:', {
        entries: entries.length,
        hasCurrentUser: !!currentUser,
        contentHeight,
        finalHeight,
        timeframe
      });

      // Take screenshot with actual content height and white background
      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 700, height: finalHeight },
        omitBackground: false,
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
