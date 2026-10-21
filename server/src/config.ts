import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/ (tsx) and dist/src/ (built) both resolve to <server>/data
const serverRoot = here.includes(`${path.sep}dist${path.sep}`)
  ? path.resolve(here, '..', '..')
  : path.resolve(here, '..');

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  // Not PORT: dev tools often set PORT for the client, and the Vite proxy expects the API on 3001.
  port: num('API_PORT', 3001),
  dbPath: process.env.DB_PATH ?? path.join(serverRoot, 'data', 'review-pulse.db'),

  /** Day boundaries are computed in this offset from UTC (hours). 8 = China time. */
  tzOffsetHours: num('TZ_OFFSET_HOURS', 8),

  sync: {
    /** How far back the first sync of a game goes. */
    initialDays: num('SYNC_INITIAL_DAYS', 7),
    /** A game is considered stale after this many hours. */
    staleHours: num('SYNC_STALE_HOURS', 6),
    /** Minimum gap between Steam requests. */
    requestIntervalMs: num('SYNC_REQUEST_INTERVAL_MS', 1000),
    maxRetries: 4,
    /** Overlap with the newest stored review on incremental syncs, so nothing slips between runs. */
    overlapSeconds: 3600,
  },

  metrics: {
    /** Days with fewer reviews are left out of the average daily positive rate. */
    minDailyReviews: num('MIN_DAILY_REVIEWS', 5),
  },

  /** Playtime-at-review segments, in hours. Upper bounds are exclusive. */
  segments: [
    { id: 'new', name: 'New Player', label: '0–5 h', maxHours: 6 },
    { id: 'normal', name: 'Normal Player', label: '6–20 h', maxHours: 21 },
    { id: 'hard', name: 'HardCore Player', label: '21 h +', maxHours: Infinity },
  ] as const,

  keywords: {
    /** Steam language code analysed for keywords. */
    language: 'schinese',
    /** Below this many reviews in the selection, keywords are not shown. */
    minReviews: num('KEYWORDS_MIN_REVIEWS', 20),
    /** A term must appear in at least this many reviews to be listed. */
    minDocFreq: 2,
    top: 12,
  },
};

export type SegmentId = (typeof config.segments)[number]['id'];
