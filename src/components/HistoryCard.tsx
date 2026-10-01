/**
 * History Card - Per-period XP and hours breakdown (paginated)
 *
 * Renders one page of a user's reset history. Pages are:
 *   Page 0: cumulative totals + current period + 1 past period
 *   Page 1+: 3 past periods (no cumulative header)
 *
 * @module components/HistoryCard
 */

import React from 'react';
import { User, Zap, Timer, BookOpen, Flame, TrendingUp, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Data shapes ────────────────────────────────────────────────────────────────

export interface ResetPeriodData {
  resetNumber: number;
  resetDateStr: string;
  periodXp: number;
  periodHours: number;
  periodSessions: number;
  longestStreakInPeriod: number;
  longestSessionInPeriod: number;  // seconds
}

interface HistoryCardProps {
  username: string;
  avatarUrl?: string;

  // Page control
  showCumulative: boolean;
  showCurrentPeriod: boolean;
  periodsToShow: ResetPeriodData[];   // past completed periods for this page only
  pageInfo: { current: number; total: number };

  // Current period data (used when showCurrentPeriod = true)
  currentPeriodNumber: number;
  currentXp: number;
  currentHours: number;
  currentSessions: number;

  // Cumulative data (used when showCumulative = true)
  cumulativeXp: number;
  cumulativeHours: number;
  cumulativeSessions: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtHours(h: number): string {
  if (h >= 10) return `${Math.floor(h)}h`;
  if (h >= 1)  return `${h.toFixed(1)}h`;
  return `${Math.round(h * 60)}m`;
}

function fmtSeconds(sec: number): string {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ── StatTile ──────────────────────────────────────────────────────────────────

interface StatTileProps {
  gradient: string;
  icon: React.ReactNode;
  value: string;
  label: string;
}

const StatTile: React.FC<StatTileProps> = ({ gradient, icon, value, label }) => (
  <div className="flex items-center gap-2.5">
    <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center flex-shrink-0`}>
      {icon}
    </div>
    <div className="flex flex-col min-w-0">
      <span className="text-[#EFEFEF] text-lg font-extrabold leading-tight truncate">{value}</span>
      <span className="text-[#AFAFAF] text-xs font-semibold leading-tight">{label}</span>
    </div>
  </div>
);

// ── PeriodCard ────────────────────────────────────────────────────────────────

interface PeriodCardProps {
  period: ResetPeriodData;
  isCurrent?: boolean;
  isInProgress?: boolean;
}

const PeriodCard: React.FC<PeriodCardProps> = ({ period, isCurrent, isInProgress }) => {
  const borderColor = isCurrent ? 'border-[#58CC02]/50' : 'border-[#2E3D44]';
  const badgeBg    = isCurrent ? 'bg-[#58CC02]' : 'bg-[#2E3D44]';
  const badgeText  = isCurrent ? 'text-white' : 'text-[#EFEFEF]';
  const titleColor = isCurrent ? 'text-[#58CC02]' : 'text-[#DBDEE1]';

  return (
    <div className={`bg-[#1F2B31] rounded-2xl p-5 border-2 ${borderColor}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-full ${badgeBg} flex items-center justify-center flex-shrink-0`}>
            <span className={`${badgeText} text-xs font-extrabold`}>{period.resetNumber}</span>
          </div>
          <span className={`${titleColor} text-base font-extrabold`}>
            {isCurrent ? 'Current Period' : `Period ${period.resetNumber}`}
          </span>
        </div>
        <span className="text-[#AFAFAF] text-sm font-semibold">
          {isInProgress ? 'In Progress' : `Reset ${period.resetDateStr}`}
        </span>
      </div>

      {/*
        All 5 stats share the same 3-column grid so the icons stay vertically
        aligned:
          Row 1:  [XP]         [Hours]          [Sessions]
          Row 2:  [Best Streak] [Longest Session] [empty]
        This puts "Hours" and "Longest Session" in the same column.
      */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          gradient="from-[#CE82FF] to-[#A855F7]"
          icon={<Zap className="w-4 h-4 text-white" fill="white" />}
          value={period.periodXp.toLocaleString()}
          label="XP Earned"
        />
        <StatTile
          gradient="from-[#1CB0F6] to-[#0088CC]"
          icon={<Timer className="w-4 h-4 text-white" />}
          value={fmtHours(period.periodHours)}
          label="Hours"
        />
        <StatTile
          gradient="from-[#58CC02] to-[#45A000]"
          icon={<BookOpen className="w-4 h-4 text-white" />}
          value={String(period.periodSessions)}
          label="Sessions"
        />

        {/* Second row — only for completed past periods */}
        {!isInProgress && (
          <>
            <StatTile
              gradient="from-[#FF9600] to-[#FF6B00]"
              icon={<Flame className="w-4 h-4 text-white" fill="white" />}
              value={period.longestStreakInPeriod > 0 ? `${period.longestStreakInPeriod}d` : '—'}
              label="Best Streak"
            />
            <StatTile
              gradient="from-[#1CB0F6] to-[#0088CC]"
              icon={<Clock className="w-4 h-4 text-white" />}
              value={fmtSeconds(period.longestSessionInPeriod)}
              label="Longest Session"
            />
            {/* Empty cell to keep grid tidy */}
            <div />
          </>
        )}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export const HistoryCard: React.FC<HistoryCardProps> = ({
  username,
  avatarUrl,
  showCumulative,
  showCurrentPeriod,
  periodsToShow,
  pageInfo,
  currentPeriodNumber,
  currentXp,
  currentHours,
  currentSessions,
  cumulativeXp,
  cumulativeHours,
  cumulativeSessions,
}) => {
  const displayName = username.length > 12 ? username.substring(0, 12) + '…' : username;
  const isMultiPage = pageInfo.total > 1;

  // Virtual period object for the current in-progress period
  const currentPeriod: ResetPeriodData = {
    resetNumber: currentPeriodNumber,
    resetDateStr: '',
    periodXp: currentXp,
    periodHours: currentHours,
    periodSessions: currentSessions,
    longestStreakInPeriod: 0,
    longestSessionInPeriod: 0,
  };

  return (
    <div className="w-[700px] bg-[#131F24] flex flex-col p-8 gap-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] p-[3px] flex-shrink-0">
            <img src={avatarUrl} alt={username} className="w-full h-full rounded-full object-cover border-4 border-[#1F2B31]" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#58CC02] to-[#4CAF00] flex items-center justify-center flex-shrink-0">
            <User className="w-10 h-10 text-white" />
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[#EFEFEF] text-2xl font-extrabold leading-tight">{displayName}</span>
          <span className="text-[#AFAFAF] text-base font-semibold">Study History</span>
        </div>

        {/* Page indicator (only shown when multi-page) */}
        {isMultiPage && (
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <ChevronLeft className={`w-5 h-5 ${pageInfo.current > 1 ? 'text-[#DBDEE1]' : 'text-[#2E3D44]'}`} />
            <div className="bg-[#1F2B31] border border-[#2E3D44] rounded-xl px-3 py-1.5">
              <span className="text-[#DBDEE1] text-sm font-bold">
                {pageInfo.current} / {pageInfo.total}
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 ${pageInfo.current < pageInfo.total ? 'text-[#DBDEE1]' : 'text-[#2E3D44]'}`} />
          </div>
        )}
      </div>

      {/* ── Cumulative totals (page 0 only) ── */}
      {showCumulative && (
        <div className="bg-[#1F2B31] rounded-2xl p-5 border-2 border-[#FFD700]/40">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-extrabold uppercase tracking-widest">All-Time Cumulative</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              gradient="from-[#CE82FF] to-[#A855F7]"
              icon={<Zap className="w-5 h-5 text-white" fill="white" />}
              value={cumulativeXp.toLocaleString()}
              label="Total XP"
            />
            <StatTile
              gradient="from-[#1CB0F6] to-[#0088CC]"
              icon={<Timer className="w-5 h-5 text-white" />}
              value={fmtHours(cumulativeHours)}
              label="Total Hours"
            />
            <StatTile
              gradient="from-[#58CC02] to-[#45A000]"
              icon={<BookOpen className="w-5 h-5 text-white" />}
              value={cumulativeSessions.toLocaleString()}
              label="Total Sessions"
            />
          </div>
        </div>
      )}

      {/* ── Current period (page 0 only) ── */}
      {showCurrentPeriod && (
        <PeriodCard period={currentPeriod} isCurrent isInProgress />
      )}

      {/* ── Past periods for this page ── */}
      {periodsToShow.map(p => (
        <PeriodCard key={p.resetNumber} period={p} />
      ))}

      <div className="h-2" />
    </div>
  );
};
