/**
 * History Card - Per-period XP and hours breakdown
 *
 * Renders a user's full reset history as a visual card, matching the dark
 * Duolingo-style aesthetic used by ProfileCard and LeaderboardCard.
 *
 * Layout (top → bottom):
 *   Header: avatar + username + period count
 *   All-Time Cumulative: XP / hours / sessions summary (gold-bordered)
 *   Current Period: in-progress stats (green-bordered)
 *   Past Periods: newest-first, each with 5 stats
 *
 * @module components/HistoryCard
 */

import React from 'react';
import { User, Zap, Timer, BookOpen, Flame, TrendingUp, Clock } from 'lucide-react';

// ── Data shapes ────────────────────────────────────────────────────────────────

export interface ResetPeriodData {
  resetNumber: number;
  resetDateStr: string;       // pre-formatted: "Oct 1, 2026"
  periodXp: number;
  periodHours: number;        // decimal hours
  periodSessions: number;
  longestStreakInPeriod: number;
  longestSessionInPeriod: number;  // seconds
}

interface HistoryCardProps {
  username: string;
  avatarUrl?: string;
  resetPeriods: ResetPeriodData[];   // past completed periods (all of them, newest first)
  currentXp: number;
  currentHours: number;
  currentSessions: number;
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

// ── Sub-component: compact stat tile ─────────────────────────────────────────

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

// ── Sub-component: individual period card ────────────────────────────────────

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
      {/* Period header row */}
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

      {/* Top row: XP / Hours / Sessions */}
      <div className="grid grid-cols-3 gap-3 mb-3">
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
      </div>

      {/* Bottom row: Best Streak / Longest Session (only for past periods) */}
      {!isInProgress && (
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            gradient="from-[#FF9600] to-[#FF6B00]"
            icon={<Flame className="w-4 h-4 text-white" fill="white" />}
            value={period.longestStreakInPeriod > 0 ? `${period.longestStreakInPeriod}d` : '—'}
            label="Best Streak"
          />
          <StatTile
            gradient="from-[#FF6B6B] to-[#EE5A6F]"
            icon={<Clock className="w-4 h-4 text-white" />}
            value={fmtSeconds(period.longestSessionInPeriod)}
            label="Longest Session"
          />
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export const HistoryCard: React.FC<HistoryCardProps> = ({
  username,
  avatarUrl,
  resetPeriods,
  currentXp,
  currentHours,
  currentSessions,
  cumulativeXp,
  cumulativeHours,
  cumulativeSessions,
}) => {
  const displayName = username.length > 12 ? username.substring(0, 12) + '…' : username;
  const totalPeriods = resetPeriods.length + 1;

  // Virtual "current period" object for PeriodCard
  const currentPeriod: ResetPeriodData = {
    resetNumber: totalPeriods,
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
            <img
              src={avatarUrl}
              alt={username}
              className="w-full h-full rounded-full object-cover border-4 border-[#1F2B31]"
            />
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
        <div className="ml-auto flex-shrink-0 bg-[#1F2B31] border border-[#2E3D44] rounded-xl px-3 py-1.5">
          <span className="text-[#DBDEE1] text-sm font-bold">
            {totalPeriods} period{totalPeriods !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── All-Time Cumulative ── */}
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

      {/* ── Current Period ── */}
      <PeriodCard period={currentPeriod} isCurrent isInProgress />

      {/* ── Past Periods (newest → oldest) ── */}
      {resetPeriods.map(p => (
        <PeriodCard key={p.resetNumber} period={p} />
      ))}

      {/* Bottom breathing room */}
      <div className="h-2" />
    </div>
  );
};
