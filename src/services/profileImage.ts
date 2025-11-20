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
   * Generate a Duolingo-style profile image using React + Tailwind
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
    currentUser?: LeaderboardEntry
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Calculate height based on actual number of entries
      const entryCount = entries.length > 0 ? entries.length : 10; // Sample has 10 entries
      const hasCurrentUserForCalc = !!currentUser; // Only add extra height if currentUser exists

      // Base: header (60) + top padding (32) + bottom padding (24) = 116
      const baseHeight = 150;
      // Each entry: padding (12) + content (~50) + border (4) = ~66, round up to 70 for safety
      const entryHeight = 70;
      // Spacing between entries (space-y-2.5 = 10px)
      const spacingHeight = entryCount > 0 ? (entryCount - 1) * 10 : 0;
      // Current user: separator (30) + entry (70) = 100
      const extraUserHeight = hasCurrentUserForCalc ? 100 : 0;

      const totalHeight = baseHeight + (entryCount * entryHeight) + spacingHeight + extraUserHeight;

      // Add small buffer to ensure nothing gets cut off
      const finalHeight = Math.ceil(totalHeight * 1.05); // 5% buffer

      console.log('[LeaderboardImage] Generating image:', {
        entries: entries.length,
        entryCount,
        hasCurrentUser: !!currentUser,
        hasCurrentUserForCalc,
        totalHeight,
        finalHeight
      });

      // Set viewport to match our card size (700px width like profile cards)
      await page.setViewport({ width: 700, height: finalHeight });

      // Render React component to HTML
      const component = React.createElement(LeaderboardCard, {
        timeframe,
        entries,
        currentUser,
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
                height: ${finalHeight}px;
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

      // Wait a bit more for Tailwind to fully process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 700, height: finalHeight },
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
