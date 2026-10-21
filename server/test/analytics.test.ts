import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDb, setDb } from '../src/db/index.js';
import { addDays, dayKey, dayStart, isoWeek, today, weekBounds } from '../src/analytics/time.js';
import { segmentOf } from '../src/analytics/segments.js';
import { averageDailyRate, daily, segments, segmentInsight, summary, type DailyPoint } from '../src/analytics/metrics.js';
import { makeRange, resolveRange } from '../src/analytics/range.js';
import { keywords, reviewList } from '../src/analytics/keywords.js';
import { runSync } from '../src/sync/syncGame.js';
import { cleanReview, splitSentences, toHalfWidth } from '../src/text/normalize.js';
import { extractTerms } from '../src/text/tokenize.js';
import type { ReviewPage, SteamReview } from '../src/steam/client.js';

describe('time', () => {
  it('uses UTC+8 day boundaries', () => {
    // 2026-10-14T16:30:00Z is 00:30 on 15 Oct in China
    const ts = Date.UTC(2026, 9, 14, 16, 30) / 1000;
    expect(dayKey(ts, 8)).toBe('2026-10-15');
    expect(dayKey(ts, 0)).toBe('2026-10-14');
    expect(dayStart('2026-10-15', 8)).toBe(Date.UTC(2026, 9, 14, 16, 0) / 1000);
  });

  it('computes ISO weeks, including year edges', () => {
    expect(isoWeek('2026-10-12')).toBe('2026-W42');
    expect(isoWeek('2026-10-18')).toBe('2026-W42');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(weekBounds('2026-W42')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
  });
});

describe('segments', () => {
  it('maps playtime at review to New / Normal / HardCore', () => {
    expect(segmentOf(0)).toBe('new');
    expect(segmentOf(5 * 60 + 59)).toBe('new'); // 5.98 h
    expect(segmentOf(6 * 60)).toBe('normal');
    expect(segmentOf(20 * 60 + 59)).toBe('normal');
    expect(segmentOf(21 * 60)).toBe('hard');
  });
});

describe('average daily positive rate', () => {
  const p = (total: number, positive: number): DailyPoint => ({
    date: 'x', total, positive, negative: total - positive, rate: total ? positive / total : null, lowVolume: total < 5, partial: false,
  });

  it('averages daily rates and skips low-volume days', () => {
    // 90%, 50%, and a 2-review day at 0% that must be ignored
    expect(averageDailyRate([p(10, 9), p(100, 50), p(2, 0)])).toBeCloseTo(0.7);
  });

  it('returns null when no day qualifies', () => {
    expect(averageDailyRate([p(1, 1), p(0, 0)])).toBeNull();
  });
});

describe('text', () => {
  it('cleans BBCode, URLs and full-width characters', () => {
    expect(cleanReview('[h1]好[/h1] 看 https://a.b/c')).toBe('好 看');
    expect(toHalfWidth('ＢＵＧ！')).toBe('BUG!');
    expect(splitSentences('剧情很好。但是掉帧！\n还行')).toEqual(['剧情很好。', '但是掉帧！', '还行']);
  });

  it('keeps game terms whole and drops stopwords', () => {
    const terms = extractTerms('更新之后一直掉帧，存档bug也很烦，这个游戏真的太肝了');
    expect(terms).toContain('掉帧');
    expect(terms).toContain('存档bug');
    expect(terms).toContain('太肝');
    expect(terms).not.toContain('游戏');
    expect(terms).not.toContain('这个');
  });
});

// ---------- database-backed tests ----------

const APP = 42;
let conn: DatabaseSync;
let seq = 0;

function review(over: Partial<SteamReview> & { created: number }): SteamReview {
  seq += 1;
  return {
    recommendationid: String(seq),
    author: { steamid: `7656${seq}`, playtime_forever: 600, playtime_at_review: 600 },
    language: 'schinese',
    review: '剧情很棒',
    timestamp_created: over.created,
    timestamp_updated: over.created,
    voted_up: true,
    votes_up: 0,
    weighted_vote_score: 0.5,
    steam_purchase: true,
    received_for_free: false,
    written_during_early_access: false,
    ...over,
  };
}

/** Fake Steam: serves `all` newest-first in pages of `size`. */
function fakeSteam(all: SteamReview[], size = 3) {
  const sorted = [...all].sort((a, b) => b.timestamp_created - a.timestamp_created);
  const calls: string[] = [];
  const fetchPage = async (_appid: number, cursor: string): Promise<ReviewPage> => {
    calls.push(cursor);
    const start = cursor === '*' ? 0 : Number(cursor);
    const reviews = sorted.slice(start, start + size);
    return {
      cursor: String(start + size),
      reviews,
      summary: cursor === '*' ? { review_score_desc: 'Very Positive', total_positive: 9, total_negative: 1, total_reviews: 10 } : undefined,
    };
  };
  return { fetchPage, calls };
}

beforeEach(() => {
  conn = openDb(':memory:');
  setDb(conn);
  conn.prepare('INSERT INTO games (appid, name, details_fetched_at, added_at) VALUES (?, ?, ?, ?)').run(APP, 'Test', Math.floor(Date.now() / 1000), 0);
});

describe('sync', () => {
  it('stops at the initial window, then fetches only newer reviews', async () => {
    const now = Math.floor(Date.now() / 1000);
    const H = 3600;
    const old = [1, 2, 3, 4, 5].map((d) => review({ created: now - d * 24 * H }));
    const tooOld = [review({ created: now - 9 * 24 * H }), review({ created: now - 10 * 24 * H })];
    const steam = fakeSteam([...old, ...tooOld]);

    const first = await runSync(APP, { conn, fetchPage: steam.fetchPage, initialDays: 7 });
    expect(first.status).toBe('done');
    expect(first.mode).toBe('initial');
    expect(first.fetched).toBe(5);
    const stored = conn.prepare('SELECT COUNT(*) AS n FROM reviews').get() as { n: number };
    expect(stored.n).toBe(5);

    const fresh = [review({ created: now - 60 }), review({ created: now - 120 })];
    const steam2 = fakeSteam([...fresh, ...old, ...tooOld]);
    const second = await runSync(APP, { conn, fetchPage: steam2.fetchPage });
    expect(second.mode).toBe('incremental');
    // Page 1 holds the 2 new reviews + the newest stored one (inside the 1 h overlap); page 2 passes the stop point.
    expect(steam2.calls).toEqual(['*', '3']);
    const after = conn.prepare('SELECT COUNT(*) AS n FROM reviews').get() as { n: number };
    expect(after.n).toBe(7);
    const game = conn.prepare('SELECT review_score_desc FROM games WHERE appid = ?').get(APP) as { review_score_desc: string };
    expect(game.review_score_desc).toBe('Very Positive');
  });

  it('records Steam errors on the run', async () => {
    const failing = async (): Promise<ReviewPage> => {
      throw new Error('Steam responded 403');
    };
    const run = await runSync(APP, { conn, fetchPage: failing });
    expect(run.status).toBe('error');
    expect(run.error).toContain('403');
  });
});

describe('metrics and keywords on stored reviews', () => {
  const d0 = addDays(today(), -2);
  const at = (day: string, hour = 12) => dayStart(day) + hour * 3600;

  async function seed(list: SteamReview[]) {
    await runSync(APP, { conn, fetchPage: fakeSteam(list, 100).fetchPage, initialDays: 7 });
  }

  it('groups by local day, segments and builds keywords', async () => {
    const list: SteamReview[] = [];
    for (let i = 0; i < 12; i++) list.push(review({ created: at(d0), voted_up: true, review: '配乐太棒了，剧情也很好', author: { steamid: 's', playtime_forever: 0, playtime_at_review: 120 } }));
    for (let i = 0; i < 10; i++) list.push(review({ created: at(d0, 13), voted_up: false, review: '一直掉帧，优化太差', votes_up: i, author: { steamid: 's', playtime_forever: 0, playtime_at_review: 30 * 60 } }));
    list.push(review({ created: at(addDays(d0, 1)), voted_up: true, language: 'english', review: 'great' }));
    await seed(list);

    const range = makeRange(d0, addDays(d0, 1));
    const points = daily(APP, range);
    expect(points.map((p) => p.total)).toEqual([22, 1]);
    expect(points[0].rate).toBeCloseTo(12 / 22);
    expect(points[1].lowVolume).toBe(true);

    const segs = segments(APP, range);
    expect(segs.find((s) => s.id === 'new')?.count).toBe(12);
    expect(segs.find((s) => s.id === 'hard')?.rate).toBe(0);
    expect(segs.find((s) => s.id === 'normal')?.count).toBe(1);
    expect(segmentInsight(segs)).toBe('HardCore Players are 100 points less positive than New Players.');

    const kw = keywords(APP, { range });
    expect(kw.insufficient).toBe(false);
    expect(kw.reviews).toEqual({ total: 22, positive: 12, negative: 10 });
    expect(kw.positive.map((k) => k.term)).toContain('配乐');
    expect(kw.negative.map((k) => k.term)).toContain('掉帧');
    expect(kw.negative.find((k) => k.term === '掉帧')?.count).toBe(10);

    const rv = reviewList(APP, { range, term: '掉帧', sentiment: 'n' });
    expect(rv.total).toBe(10);
    expect(rv.items[0].votesUp).toBe(9); // most helpful first
    expect(rv.items[0].segment).toBe('hard');
    expect(reviewList(APP, { range, segment: 'new', sentiment: 'n' }).total).toBe(0);
  });

  it('flags too few keyword-language reviews', async () => {
    await seed([review({ created: at(d0) })]);
    const kw = keywords(APP, { range: makeRange(d0, d0) });
    expect(kw.insufficient).toBe(true);
    expect(kw.positive).toEqual([]);
  });

  it('summary reports no previous period until it is stored', async () => {
    await seed([review({ created: at(d0) })]);
    const g = conn.prepare('SELECT covered_from FROM games WHERE appid = ?').get(APP) as { covered_from: number };
    const s = summary(APP, resolveRange({ range: '7d' }, g.covered_from), g.covered_from);
    expect(s.previous).toBeNull();
    expect(s.total).toBe(1);
  });
});
