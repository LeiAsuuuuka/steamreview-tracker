import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { db } from './db/index.js';
import {
  keywords, rangeForPeriod, reviewList, weekOptions, type ReviewSort, type Sentiment,
} from './analytics/keywords.js';
import { dayKey, daysBetween, today } from './analytics/time.js';
import { parseLangs } from './analytics/langs.js';
import { daily, languages, segments, summary } from './analytics/metrics.js';
import { makeRange, resolveRange, storedDays, type DateRange } from './analytics/range.js';
import { isSegmentId } from './analytics/segments.js';
import { fetchAppDetails, searchApps } from './steam/client.js';
import { ensureGame, isSyncing, lastRun, startSync } from './sync/syncGame.js';

export const api = Router();

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).then((body) => {
    if (body !== undefined && !res.headersSent) res.json(body);
  }, next);
};

interface GameRow {
  appid: number;
  name: string | null;
  header_image: string | null;
  review_score_desc: string | null;
  total_reviews: number | null;
  total_positive: number | null;
  covered_from: number | null;
  last_synced_at: number | null;
  added_at: number;
}

function appidParam(req: Request): number {
  const appid = Number(req.params.appid);
  if (!Number.isInteger(appid) || appid <= 0) throw new HttpError(400, 'App ID must be a positive whole number.');
  return appid;
}

function gameRow(appid: number): GameRow | undefined {
  return db().prepare('SELECT * FROM games WHERE appid = ?').get(appid) as GameRow | undefined;
}

function requireGame(appid: number): GameRow {
  const g = gameRow(appid);
  if (!g) throw new HttpError(404, `App ${appid} has not been added yet. Sync it first.`);
  return g;
}

function gameView(g: GameRow) {
  const stale =
    g.last_synced_at === null || Date.now() / 1000 - g.last_synced_at > config.sync.staleHours * 3600;
  const stored = db().prepare('SELECT COUNT(*) AS n FROM reviews WHERE appid = ?').get(g.appid) as { n: number };
  return {
    appid: g.appid,
    name: g.name ?? `App ${g.appid}`,
    headerImage: g.header_image,
    reviewScoreDesc: g.review_score_desc,
    steamTotalReviews: g.total_reviews,
    steamTotalPositive: g.total_positive,
    coveredFrom: g.covered_from,
    /** First and last selectable days ('YYYY-MM-DD', dashboard timezone) for date pickers. */
    firstDay: g.covered_from ? dayKey(g.covered_from) : null,
    today: today(),
    lastSyncedAt: g.last_synced_at,
    storedReviews: stored.n,
    storedDays: storedDays(g.covered_from),
    stale,
    syncing: isSyncing(g.appid),
    lastSync: lastRun(g.appid),
  };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Selection for talking points: a single day, else custom from/to dates, else a period ('last7' or an ISO week). */
function scopeRange(q: Request['query']): DateRange {
  if (typeof q.day === 'string' && DAY_RE.test(q.day)) return makeRange(q.day, q.day);
  if (typeof q.from === 'string' && typeof q.to === 'string' && DAY_RE.test(q.from) && DAY_RE.test(q.to)) {
    const [from, to] = q.from <= q.to ? [q.from, q.to] : [q.to, q.from];
    if (daysBetween(from, to) > 366) throw new HttpError(400, 'Pick a date range of one year or less.');
    return makeRange(from, to);
  }
  return rangeForPeriod(q.period);
}

const sortQ = (q: Request['query']): ReviewSort =>
  q.sort === 'old' || q.sort === 'helpful' ? q.sort : 'new';

const segmentQ = (q: Request['query']) => (isSegmentId(q.segment) ? q.segment : undefined);
const sentimentQ = (q: Request['query']): Sentiment | undefined =>
  q.sentiment === 'p' || q.sentiment === 'n' ? q.sentiment : undefined;

api.get('/config', () => ({
  tzOffsetHours: config.tzOffsetHours,
  segments: config.segments.map(({ id, name, label }) => ({ id, name, label })),
  minDailyReviews: config.metrics.minDailyReviews,
  initialDays: config.sync.initialDays,
}));

api.get(
  '/search',
  wrap(async (req) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return [];
    if (/^\d+$/.test(q)) {
      const d = await fetchAppDetails(Number(q)).catch(() => null);
      return d ? [{ appid: d.appid, name: d.name, image: d.headerImage }] : [{ appid: Number(q), name: `App ${q}`, image: null }];
    }
    return (await searchApps(q)).slice(0, 10);
  }),
);

api.get(
  '/games',
  wrap(() => {
    const rows = db().prepare('SELECT * FROM games ORDER BY COALESCE(last_synced_at, added_at) DESC').all() as unknown as GameRow[];
    return rows.map(gameView);
  }),
);

api.get(
  '/games/:appid',
  wrap(async (req) => {
    const appid = appidParam(req);
    if (!gameRow(appid)) await ensureGame(appid);
    return gameView(requireGame(appid));
  }),
);

api.post(
  '/games/:appid/sync',
  wrap(async (req, res) => {
    const appid = appidParam(req);
    await ensureGame(appid);
    void startSync(appid);
    res.status(202);
    return gameView(requireGame(appid));
  }),
);

api.get(
  '/games/:appid/sync',
  wrap((req) => {
    const appid = appidParam(req);
    return { syncing: isSyncing(appid), lastSync: lastRun(appid) };
  }),
);

api.get(
  '/games/:appid/summary',
  wrap((req) => {
    const g = requireGame(appidParam(req));
    return summary(g.appid, resolveRange(req.query, g.covered_from), g.covered_from, parseLangs(req.query.lang));
  }),
);

api.get(
  '/games/:appid/languages',
  wrap((req) => {
    const g = requireGame(appidParam(req));
    const range = resolveRange(req.query, g.covered_from);
    return { range: { from: range.from, to: range.to }, languages: languages(g.appid, range) };
  }),
);

api.get(
  '/games/:appid/daily',
  wrap((req) => {
    const g = requireGame(appidParam(req));
    const range = resolveRange(req.query, g.covered_from);
    return { range: { from: range.from, to: range.to }, points: daily(g.appid, range, parseLangs(req.query.lang)) };
  }),
);

api.get(
  '/games/:appid/segments',
  wrap((req) => {
    const g = requireGame(appidParam(req));
    const range = resolveRange(req.query, g.covered_from);
    return { range: { from: range.from, to: range.to }, segments: segments(g.appid, range, parseLangs(req.query.lang)) };
  }),
);

api.get(
  '/games/:appid/periods',
  wrap((req) => {
    const g = requireGame(appidParam(req));
    return weekOptions(g.appid, g.covered_from, parseLangs(req.query.lang));
  }),
);

api.get(
  '/games/:appid/keywords',
  wrap((req) => {
    const g = requireGame(appidParam(req));
    return keywords(g.appid, {
      range: scopeRange(req.query),
      segment: segmentQ(req.query),
      langs: parseLangs(req.query.lang),
    });
  }),
);

api.get(
  '/games/:appid/reviews',
  wrap((req) => {
    const g = requireGame(appidParam(req));
    const term = typeof req.query.term === 'string' && req.query.term.trim() ? req.query.term.trim() : undefined;
    return reviewList(g.appid, {
      range: scopeRange(req.query),
      segment: segmentQ(req.query),
      langs: parseLangs(req.query.lang),
      sentiment: sentimentQ(req.query),
      sort: sortQ(req.query),
      term,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 12,
    });
  }),
);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status = err instanceof HttpError ? err.status : 502;
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  if (!(err instanceof HttpError)) console.error(err);
  res.status(status).json({ error: message });
}
