/**
 * Profile Image Service (Light Mode) - Renders light mode profiles and leaderboards
 *
 * Light mode version using ProfileCardLight and white backgrounds.
 *
 * @module services/profileImageLight
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { UserStats } from '../types';
import { calculateLevel } from '../utils/xp';
import { ProfileCardLight } from '../components/ProfileCardLight';
import { LeaderboardCardLight } from '../components/LeaderboardCardLight';
import { browserPool } from './browserPool';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string;
  xp: number;
  totalDuration: number;
  rank: number;
}

/**
 * Service for rendering light mode profile cards as images
 */
export class ProfileImageLightService {
  /**
   * Pre-initializes the browser instance
   */
  async warmup(): Promise<void> {
    console.log('[ProfileImageLightService] Warming up browser...');
    await browserPool.warmup();
    console.log('[ProfileImageLightService] Browser ready');
  }

  /**
   * Generate a light mode profile image
   */
  async generateProfileImage(
    username: string,
    stats: UserStats | null,
    avatarUrl?: string,
    groupInfo?: {
      groupName: string;
      groupId: string;
      groupLevel: number;
    }
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport to match our card size
      await page.setViewport({ width: 700, height: 650 });

      // Calculate stats
      const xp = stats?.xp || 0;
      const level = calculateLevel(xp);
      const currentStreak = stats?.currentStreak || 0;
      const totalSessions = stats?.totalSessions || 0;
      // Sum total levels across all leveled achievements (max 40)
      const leveledAchs = stats?.leveledAchievements || {};
      const achievementCount = Object.values(leveledAchs).reduce(
        (sum: number, a: any) => sum + ((a?.currentLevel as number) || 0),
        0
      );
      const longestStreak = stats?.longestStreak || 0;
      const totalHours = Math.floor((stats?.totalDuration || 0) / 3600);

      // Render React component to HTML
      const component = React.createElement(ProfileCardLight, {
        username,
        avatarUrl,
        streak: currentStreak,
        xp,
        level,
        totalSessions,
        achievementCount,
        longestStreak,
        totalHours,
        groupName: groupInfo?.groupName,
        groupId: groupInfo?.groupId,
        groupLevel: groupInfo?.groupLevel,
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

      // Load the HTML
      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 300));

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
   * Generate a light mode leaderboard image
   */
  async generateLeaderboardImage(
    timeframe: 'daily' | 'weekly' | 'monthly' | 'all-time',
    entries: LeaderboardEntry[],
    currentUser?: LeaderboardEntry,
    currentUserId?: string
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Set initial large viewport to render everything
      await page.setViewport({ width: 700, height: 2000 });

      // Render React component to HTML
      const component = React.createElement(LeaderboardCardLight, {
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

      // Load the HTML
      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // Wait for Tailwind to fully process and render
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the actual height of the rendered content
      const contentHeight = await page.evaluate(`
        (() => {
          const body = document.body;
          const firstChild = body.firstElementChild;

          if (firstChild) {
            const rect = firstChild.getBoundingClientRect();
            const offsetHeight = firstChild.offsetHeight || 0;
            const scrollHeight = firstChild.scrollHeight || 0;

            return Math.ceil(Math.max(rect.height, offsetHeight, scrollHeight));
          }
          return body.scrollHeight;
        })()
      `) as number;

      // Use measured height if available and valid, otherwise calculate
      let finalHeight = contentHeight;

      // If we got a valid measurement, add a buffer
      if (finalHeight > 0 && contentHeight > 0) {
        finalHeight = Math.ceil(contentHeight + 150);
      } else {
        // Fallback to calculation
        const entryCount = entries.length > 0 ? entries.length : 10;
        const hasCurrentUserForCalc = entries.length > 0
          ? !!currentUser
          : (timeframe === 'daily');

        const headerHeight = 60 + 24;
        const containerPadding = 32 + 24;
        const entryHeight = 68;
        const spacingHeight = entryCount > 0 ? (entryCount - 1) * 10 : 0;
        const extraUserHeight = hasCurrentUserForCalc ? 120 : 0;

        const calculatedHeight = headerHeight + containerPadding + (entryCount * entryHeight) + spacingHeight + extraUserHeight;
        finalHeight = calculatedHeight + 50;
      }

      console.log('[LeaderboardImageLight] Generating image:', {
        entries: entries.length,
        hasCurrentUser: !!currentUser,
        contentHeight,
        finalHeight,
        timeframe
      });

      // Take screenshot with actual content height
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
   * Clean up browser instance (handled by browser pool)
   */
  async cleanup(): Promise<void> {
    // Browser cleanup is handled by the shared browser pool
  }
}
