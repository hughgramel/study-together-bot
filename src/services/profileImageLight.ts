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
import { browserPool } from './browserPool';

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
      const achievementCount = stats?.achievements?.length || 0;
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
   * Clean up browser instance (handled by browser pool)
   */
  async cleanup(): Promise<void> {
    // Browser cleanup is handled by the shared browser pool
  }
}
