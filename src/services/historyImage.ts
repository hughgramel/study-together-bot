/**
 * History Image Service
 *
 * Renders the HistoryCard React component to a PNG using Puppeteer.
 * Follows the same pattern as ProfileImageService / generateLeaderboardImage:
 * dynamic height measured from the rendered DOM, with a safety buffer.
 *
 * @module services/historyImage
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { UserStats, XpResetSnapshot } from '../types';
import { HistoryCard, ResetPeriodData } from '../components/HistoryCard';
import { browserPool } from './browserPool';

// Re-export so callers only need this one import
export type { ResetPeriodData };

/**
 * Convert an XpResetSnapshot (Firestore data) to the plain ResetPeriodData
 * the React component expects (no firebase-admin types).
 */
function toResetPeriodData(snap: XpResetSnapshot): ResetPeriodData {
  const d = new Date(snap.resetAt.seconds * 1000);
  const resetDateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    resetNumber: snap.resetNumber,
    resetDateStr,
    periodXp: snap.periodXp,
    periodHours: snap.periodHours,
    periodSessions: snap.periodSessions,
    longestStreakInPeriod: snap.longestStreakInPeriod,
    longestSessionInPeriod: snap.longestSessionInPeriod,
  };
}

export class HistoryImageService {
  /**
   * Generate a history card image for a user.
   *
   * @param username    - Discord username
   * @param stats       - User's Firestore stats document (may be null)
   * @param avatarUrl   - Discord avatar URL (256px PNG)
   */
  async generateHistoryImage(
    username: string,
    stats: UserStats | null,
    avatarUrl?: string
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const page = await browser.newPage();

    try {
      // Set a generous initial viewport; we'll crop to actual height after render
      await page.setViewport({ width: 700, height: 2000 });

      // ── Prepare data ────────────────────────────────────────────────────────
      const rawHistory: XpResetSnapshot[] = stats?.resetHistory || [];

      // Newest first
      const resetPeriods: ResetPeriodData[] = [...rawHistory]
        .sort((a, b) => b.resetNumber - a.resetNumber)
        .map(toResetPeriodData);

      const currentXp       = stats?.xp || 0;
      const currentHours    = (stats?.totalDuration || 0) / 3600;
      const currentSessions = stats?.totalSessions || 0;

      // Cumulative = all past periods + current
      const cumulativeXp       = rawHistory.reduce((s, r) => s + r.periodXp, currentXp);
      const cumulativeHours    = rawHistory.reduce((s, r) => s + r.periodHours, currentHours);
      const cumulativeSessions = rawHistory.reduce((s, r) => s + r.periodSessions, currentSessions);

      // ── Render ──────────────────────────────────────────────────────────────
      const component = React.createElement(HistoryCard, {
        username,
        avatarUrl,
        resetPeriods,
        currentXp,
        currentHours,
        currentSessions,
        cumulativeXp,
        cumulativeHours,
        cumulativeSessions,
      });

      const html = ReactDOMServer.renderToStaticMarkup(component);

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
              :root { --font-main: 'Nunito', sans-serif; }
              body {
                margin: 0;
                padding: 0;
                width: 700px;
                font-family: var(--font-main);
                background-color: #131F24;
              }
              * { font-family: var(--font-main); }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;

      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // ── Measure actual height ────────────────────────────────────────────────
      const contentHeight = await page.evaluate(`
        (() => {
          const first = document.body.firstElementChild;
          if (first) {
            const rect   = first.getBoundingClientRect();
            const offset = first.offsetHeight || 0;
            const scroll = first.scrollHeight || 0;
            return Math.ceil(Math.max(rect.height, offset, scroll));
          }
          return document.body.scrollHeight;
        })()
      `) as number;

      // Buffer so the bottom padding is never clipped
      const finalHeight = contentHeight > 0 ? Math.ceil(contentHeight + 20) : 800;

      console.log('[HistoryImage] periods:', resetPeriods.length, 'height:', finalHeight);

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
}
