/**
 * History Image Service
 *
 * Renders paginated HistoryCard pages to PNG via Puppeteer.
 *
 * Page 0:  cumulative header + current period + 1 past period (newest)
 * Page N:  3 past periods each (no header)
 *
 * @module services/historyImage
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { UserStats, XpResetSnapshot } from '../types';
import { HistoryCard, ResetPeriodData } from '../components/HistoryCard';
import { browserPool } from './browserPool';

export type { ResetPeriodData };

// ── Helpers ────────────────────────────────────────────────────────────────────

function toResetPeriodData(snap: XpResetSnapshot): ResetPeriodData {
  const d = new Date(snap.resetAt.seconds * 1000);
  return {
    resetNumber: snap.resetNumber,
    resetDateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    periodXp: snap.periodXp,
    periodHours: snap.periodHours,
    periodSessions: snap.periodSessions,
    longestStreakInPeriod: snap.longestStreakInPeriod,
    longestSessionInPeriod: snap.longestSessionInPeriod,
  };
}

/**
 * Calculate total pages for a given number of past periods.
 *   Page 0 shows 1 past period (+ cumulative + current).
 *   Pages 1+ show 3 past periods each.
 */
export function calcTotalPages(pastPeriodCount: number): number {
  if (pastPeriodCount === 0) return 1;
  return 1 + Math.ceil((pastPeriodCount - 1) / 3);
}

/**
 * Slice the sorted (newest-first) past periods array for a given page.
 */
export function getPeriodsForPage(periods: ResetPeriodData[], page: number): ResetPeriodData[] {
  if (page === 0) return periods.slice(0, 1);
  const start = 1 + (page - 1) * 3;
  return periods.slice(start, start + 3);
}

// ── Service ───────────────────────────────────────────────────────────────────

export class HistoryImageService {
  /**
   * Generate a history page image.
   *
   * @param username   - Discord username
   * @param stats      - Firestore UserStats (may be null)
   * @param avatarUrl  - Discord avatar URL
   * @param page       - 0-indexed page number
   */
  async generateHistoryImage(
    username: string,
    stats: UserStats | null,
    avatarUrl?: string,
    page = 0
  ): Promise<Buffer> {
    const browser = await browserPool.getBrowser();
    const pg = await browser.newPage();

    try {
      await pg.setViewport({ width: 700, height: 2000 });

      // ── Prepare data ─────────────────────────────────────────────────────
      const rawHistory: XpResetSnapshot[] = stats?.resetHistory ?? [];

      // Newest first
      const allPastPeriods: ResetPeriodData[] = [...rawHistory]
        .sort((a, b) => b.resetNumber - a.resetNumber)
        .map(toResetPeriodData);

      const currentXp       = stats?.xp ?? 0;
      const currentHours    = (stats?.totalDuration ?? 0) / 3600;
      const currentSessions = stats?.totalSessions ?? 0;

      const cumulativeXp       = rawHistory.reduce((s, r) => s + r.periodXp,       currentXp);
      const cumulativeHours    = rawHistory.reduce((s, r) => s + r.periodHours,    currentHours);
      const cumulativeSessions = rawHistory.reduce((s, r) => s + r.periodSessions, currentSessions);

      const totalPages   = calcTotalPages(allPastPeriods.length);
      const clampedPage  = Math.max(0, Math.min(page, totalPages - 1));
      const periodsToShow = getPeriodsForPage(allPastPeriods, clampedPage);

      // ── Render ──────────────────────────────────────────────────────────
      const component = React.createElement(HistoryCard, {
        username,
        avatarUrl,
        showCumulative:     clampedPage === 0,
        showCurrentPeriod:  clampedPage === 0,
        periodsToShow,
        pageInfo: { current: clampedPage + 1, total: totalPages },
        currentPeriodNumber: rawHistory.length + 1,
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
              body { margin:0; padding:0; width:700px; font-family:var(--font-main); background-color:#131F24; }
              * { font-family: var(--font-main); }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;

      await pg.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 300));

      // ── Measure height ──────────────────────────────────────────────────
      const contentHeight = await pg.evaluate(`
        (() => {
          const first = document.body.firstElementChild;
          if (first) {
            return Math.ceil(Math.max(
              first.getBoundingClientRect().height,
              first.offsetHeight || 0,
              first.scrollHeight || 0
            ));
          }
          return document.body.scrollHeight;
        })()
      `) as number;

      const finalHeight = contentHeight > 0 ? Math.ceil(contentHeight + 20) : 800;

      console.log(`[HistoryImage] page ${clampedPage + 1}/${totalPages}, periods: ${periodsToShow.length}, height: ${finalHeight}`);

      const screenshot = await pg.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 700, height: finalHeight },
        omitBackground: false,
      });

      return screenshot as Buffer;
    } finally {
      await pg.close();
    }
  }
}
