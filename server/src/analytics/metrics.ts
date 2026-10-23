import type { DatabaseSync } from 'node:sqlite';
import { config, type SegmentId } from '../config.js';
import { db as sharedDb } from '../db/index.js';
import { langClause } from './langs.js';
import { previousRange, type DateRange } from './range.js';
import { segmentSql } from './segments.js';
import { dayRange, today } from './time.js';

export interface DailyPoint {
  date: string;
  positive: number;
  negative: number;
  total: number;
  /** null when there were no reviews that day. */
  rate: number | null;
  /** Below the minimum review count, so left out of the average. */
  lowVolume: boolean;
  /** Today: still in progress, so left out of the average, lowest day and insights. */
  partial: boolean;
}

/** Days that count toward the average, lowest day and insights. */
export const countsTowardAverage = (p: DailyPoint) => !p.lowVolume && !p.partial && p.rate !== null;

export interface SegmentRow {
  id: SegmentId;
  name: string;
  label: string;
  count: number;
  positive: number;
  share: number;
  rate: number | null;
}

const tzSeconds = () => config.tzOffsetHours * 3600;

export function daily(
  appid: number,
  range: DateRange,
  langs: string[] = [],
  conn: DatabaseSync = sharedDb(),
): DailyPoint[] {
  const lang = langClause(langs);
  const rows = conn
    .prepare(
      `SELECT date(created_at + ?, 'unixepoch') AS day, SUM(voted_up) AS pos, COUNT(*) AS total
       FROM reviews WHERE appid = ? AND created_at >= ? AND created_at < ?${lang.sql}
       GROUP BY day`,
    )
    .all(tzSeconds(), appid, range.fromTs, range.toTs, ...lang.params) as { day: string; pos: number; total: number }[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const now = today();
  return dayRange(range.from, range.to).map((date) => {
    const r = byDay.get(date);
    const total = r?.total ?? 0;
    const positive = r?.pos ?? 0;
    return {
      date,
      positive,
      negative: total - positive,
      total,
      rate: total ? positive / total : null,
      lowVolume: total < config.metrics.minDailyReviews,
      partial: date === now,
    };
  });
}

/** Mean of each eligible day's positive share. null when no day has enough reviews. */
export function averageDailyRate(points: DailyPoint[]): number | null {
  const eligible = points.filter(countsTowardAverage);
  if (!eligible.length) return null;
  return eligible.reduce((sum, p) => sum + (p.rate as number), 0) / eligible.length;
}

export function segments(
  appid: number,
  range: DateRange,
  langs: string[] = [],
  conn: DatabaseSync = sharedDb(),
): SegmentRow[] {
  const lang = langClause(langs);
  const rows = conn
    .prepare(
      `SELECT ${segmentSql()} AS seg, COUNT(*) AS n, SUM(voted_up) AS pos
       FROM reviews WHERE appid = ? AND created_at >= ? AND created_at < ?${lang.sql}
       GROUP BY seg`,
    )
    .all(appid, range.fromTs, range.toTs, ...lang.params) as { seg: SegmentId; n: number; pos: number }[];
  const total = rows.reduce((s, r) => s + r.n, 0);
  return config.segments.map((s) => {
    const r = rows.find((x) => x.seg === s.id);
    const count = r?.n ?? 0;
    const positive = r?.pos ?? 0;
    return {
      id: s.id,
      name: s.name,
      label: s.label,
      count,
      positive,
      share: total ? count / total : 0,
      rate: count ? positive / count : null,
    };
  });
}

function fmtDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function trendInsight(points: DailyPoint[], avg: number | null): string | null {
  const eligible = points.filter(countsTowardAverage);
  if (eligible.length < 2 || avg === null) return null;
  const avgVolume = eligible.reduce((s, p) => s + p.total, 0) / eligible.length;
  const lowest = eligible.reduce((a, b) => ((b.rate as number) < (a.rate as number) ? b : a));
  const highest = eligible.reduce((a, b) => ((b.rate as number) > (a.rate as number) ? b : a));
  if ((lowest.rate as number) < avg - 0.05) {
    const ratio = lowest.total / avgVolume;
    const volume = ratio >= 1.3 ? ` on ${ratio.toFixed(1)}× the usual volume` : '';
    return `Dip on ${fmtDay(lowest.date)}: ${pct(lowest.rate as number)} positive${volume}.`;
  }
  if ((highest.rate as number) > avg + 0.05) {
    return `Best day was ${fmtDay(highest.date)} at ${pct(highest.rate as number)} positive.`;
  }
  return `Steady: every day stayed between ${pct(lowest.rate as number)} and ${pct(highest.rate as number)} positive.`;
}

export function segmentInsight(rows: SegmentRow[]): string | null {
  const usable = rows.filter((r) => r.count >= 10 && r.rate !== null);
  if (usable.length < 2) return null;
  const best = usable.reduce((a, b) => ((b.rate as number) > (a.rate as number) ? b : a));
  const worst = usable.reduce((a, b) => ((b.rate as number) < (a.rate as number) ? b : a));
  const diff = Math.round(((best.rate as number) - (worst.rate as number)) * 100);
  if (diff < 3) return 'All player types rate the game about the same.';
  return `${worst.name}s are ${diff} points less positive than ${best.name}s.`;
}

export function summary(
  appid: number,
  range: DateRange,
  coveredFrom: number | null,
  langs: string[] = [],
  conn: DatabaseSync = sharedDb(),
) {
  const points = daily(appid, range, langs, conn);
  const avg = averageDailyRate(points);
  const total = points.reduce((s, p) => s + p.total, 0);
  const positive = points.reduce((s, p) => s + p.positive, 0);
  const eligible = points.filter(countsTowardAverage);
  const lowest = eligible.length
    ? eligible.reduce((a, b) => ((b.rate as number) < (a.rate as number) ? b : a))
    : null;
  const avgVolume = eligible.length ? eligible.reduce((s, p) => s + p.total, 0) / eligible.length : 0;

  const prev = previousRange(range);
  const prevCovered = coveredFrom !== null && coveredFrom <= prev.fromTs;
  const prevAvg = prevCovered ? averageDailyRate(daily(appid, prev, langs, conn)) : null;

  const segs = segments(appid, range, langs, conn);
  return {
    range: { from: range.from, to: range.to },
    avgDailyRate: avg,
    eligibleDays: eligible.length,
    minDailyReviews: config.metrics.minDailyReviews,
    previous: prevAvg === null || avg === null ? null : { from: prev.from, to: prev.to, avgDailyRate: prevAvg, delta: avg - prevAvg },
    total,
    positive,
    negative: total - positive,
    perDay: points.length ? total / points.length : 0,
    pooledRate: total ? positive / total : null,
    lowestDay: lowest ? { ...lowest, volumeRatio: avgVolume ? lowest.total / avgVolume : null } : null,
    /** Selected languages; empty = all. */
    languages: langs,
    insights: { trend: trendInsight(points, avg), segments: segmentInsight(segs) },
  };
}

export interface LanguageCount {
  code: string;
  count: number;
  positive: number;
}

/** Reviews per language in the range (unfiltered), most reviews first. Feeds the language picker. */
export function languages(appid: number, range: DateRange, conn: DatabaseSync = sharedDb()): LanguageCount[] {
  return conn
    .prepare(
      `SELECT language AS code, COUNT(*) AS count, SUM(voted_up) AS positive
       FROM reviews WHERE appid = ? AND created_at >= ? AND created_at < ?
       GROUP BY language ORDER BY count DESC, language`,
    )
    .all(appid, range.fromTs, range.toTs) as unknown as LanguageCount[];
}
