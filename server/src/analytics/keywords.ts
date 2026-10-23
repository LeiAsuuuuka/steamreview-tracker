import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { config, type SegmentId } from '../config.js';
import { db as sharedDb } from '../db/index.js';
import { splitSentences } from '../text/normalize.js';
import { langClause } from './langs.js';
import { makeRange, type DateRange } from './range.js';
import { segmentSql } from './segments.js';
import { addDays, dayKey, isoWeek, today, weekBounds } from './time.js';

export type Sentiment = 'p' | 'n';

export interface Scope {
  range: DateRange;
  segment?: SegmentId;
  /** Steam language codes; empty or missing = all languages. */
  langs?: string[];
}

export interface KeywordTerm {
  term: string;
  /** Reviews in the selection that mention the term. */
  count: number;
  /** count ÷ reviews of that sentiment in the selection. */
  share: number;
  score: number;
}

export interface KeywordResult {
  range: { from: string; to: string };
  /** Selected languages; empty = all. */
  languages: string[];
  reviews: { total: number; positive: number; negative: number };
  minReviews: number;
  insufficient: boolean;
  /** 'history' once other stored weeks exist; until then the selection itself. */
  baseline: 'history' | 'selection';
  positive: KeywordTerm[];
  negative: KeywordTerm[];
}

function scopeWhere(scope: Scope, alias = 'r'): { sql: string; params: SQLInputValue[] } {
  const lang = langClause(scope.langs, `${alias}.language`);
  let sql = `${alias}.created_at >= ? AND ${alias}.created_at < ?${lang.sql}`;
  const params: SQLInputValue[] = [scope.range.fromTs, scope.range.toTs, ...lang.params];
  if (scope.segment) {
    sql += ` AND ${segmentSql(`${alias}.playtime_at_review_min`)} = ?`;
    params.push(scope.segment);
  }
  return { sql, params };
}

/** Drop terms that overlap an already chosen, higher-ranked term ("掉帧" beats "严重掉帧"). */
function pickDistinct(terms: KeywordTerm[], n: number): KeywordTerm[] {
  const out: KeywordTerm[] = [];
  for (const t of terms) {
    if (out.some((o) => o.term.includes(t.term) || t.term.includes(o.term))) continue;
    out.push(t);
    if (out.length === n) break;
  }
  return out;
}

export function keywords(appid: number, scope: Scope, conn: DatabaseSync = sharedDb()): KeywordResult {
  const where = scopeWhere(scope);
  const counts = conn
    .prepare(`SELECT voted_up AS up, COUNT(*) AS n FROM reviews r WHERE r.appid = ? AND ${where.sql} GROUP BY voted_up`)
    .all(appid, ...where.params) as { up: number; n: number }[];
  const nPos = counts.find((c) => c.up === 1)?.n ?? 0;
  const nNeg = counts.find((c) => c.up === 0)?.n ?? 0;
  const total = nPos + nNeg;

  const base: KeywordResult = {
    range: { from: scope.range.from, to: scope.range.to },
    languages: scope.langs ?? [],
    reviews: { total, positive: nPos, negative: nNeg },
    minReviews: config.keywords.minReviews,
    insufficient: total < config.keywords.minReviews,
    baseline: 'selection',
    positive: [],
    negative: [],
  };
  if (base.insufficient) return base;

  // Baseline for IDF: stored reviews outside the selected days if there are enough, else the selection itself.
  const lang = langClause(scope.langs, 'r.language');
  const outsideWhere = {
    sql: `(r.created_at < ? OR r.created_at >= ?)${lang.sql}`,
    params: [scope.range.fromTs, scope.range.toTs, ...lang.params] as SQLInputValue[],
  };
  const outside = conn
    .prepare(`SELECT COUNT(*) AS n FROM reviews r WHERE r.appid = ? AND ${outsideWhere.sql}`)
    .get(appid, ...outsideWhere.params) as { n: number };
  const useHistory = outside.n >= config.keywords.minReviews;
  base.baseline = useHistory ? 'history' : 'selection';

  const baseWhere = useHistory ? outsideWhere : where;
  const nBase = useHistory ? outside.n : total;
  const baseDf = new Map(
    (
      conn
        .prepare(
          `SELECT t.term, COUNT(*) AS df FROM review_terms t JOIN reviews r ON r.recommendation_id = t.recommendation_id
           WHERE r.appid = ? AND ${baseWhere.sql} GROUP BY t.term`,
        )
        .all(appid, ...baseWhere.params) as { term: string; df: number }[]
    ).map((r) => [r.term, r.df]),
  );

  const rows = conn
    .prepare(
      `SELECT t.term, r.voted_up AS up, COUNT(*) AS df FROM review_terms t
       JOIN reviews r ON r.recommendation_id = t.recommendation_id
       WHERE r.appid = ? AND ${where.sql}
       GROUP BY t.term, r.voted_up HAVING COUNT(*) >= ?`,
    )
    .all(appid, ...where.params, config.keywords.minDocFreq) as { term: string; up: number; df: number }[];

  const score = (df: number, n: number, term: string) => {
    const idf = Math.log((nBase + 1) / ((baseDf.get(term) ?? 0) + 1)) + 1;
    return (df / n) * idf;
  };
  const build = (up: number, n: number): KeywordTerm[] => {
    if (n === 0) return [];
    const list = rows
      .filter((r) => r.up === up)
      .map((r) => ({ term: r.term, count: r.df, share: r.df / n, score: score(r.df, n, r.term) }))
      .sort((a, b) => b.score - a.score || b.count - a.count);
    return pickDistinct(list, config.keywords.top);
  };
  base.positive = build(1, nPos);
  base.negative = build(0, nNeg);
  return base;
}

export interface WeekOption {
  id: string; // 'last7' or ISO week
  label: string;
  from: string;
  to: string;
  reviews: number;
}

/** Periods the talking points can show: the last 7 days, then each ISO week with stored reviews. */
export function weekOptions(
  appid: number,
  coveredFrom: number | null,
  langs: string[] = [],
  conn: DatabaseSync = sharedDb(),
): WeekOption[] {
  const end = today();
  const tz = config.tzOffsetHours * 3600;
  const lang = langClause(langs);
  const rows = conn
    .prepare(
      `SELECT date(created_at + ?, 'unixepoch') AS day, COUNT(*) AS n FROM reviews
       WHERE appid = ?${lang.sql} GROUP BY day`,
    )
    .all(tz, appid, ...lang.params) as { day: string; n: number }[];
  const firstDay = coveredFrom ? dayKey(coveredFrom) : null;
  const countIn = (from: string, to: string) =>
    rows.filter((r) => r.day >= from && r.day <= to).reduce((s, r) => s + r.n, 0);

  const last7From = addDays(end, -6);
  const out: WeekOption[] = [
    { id: 'last7', label: 'Last 7 days', from: last7From, to: end, reviews: countIn(last7From, end) },
  ];
  const weeks = new Set(rows.filter((r) => !firstDay || r.day >= firstDay).map((r) => isoWeek(r.day)));
  for (const w of [...weeks].sort().reverse()) {
    const { from, to } = weekBounds(w);
    out.push({ id: w, label: w, from, to, reviews: countIn(from, to) });
  }
  return out;
}

export function rangeForPeriod(period: unknown): DateRange {
  if (typeof period === 'string' && /^\d{4}-W\d{2}$/.test(period)) {
    const { from, to } = weekBounds(period);
    return makeRange(from, to);
  }
  const end = today();
  return makeRange(addDays(end, -6), end);
}

/** new = newest first (default), old = oldest first, helpful = most helpful votes first. */
export type ReviewSort = 'new' | 'old' | 'helpful';

const ORDER: Record<ReviewSort, string> = {
  new: 'r.created_at DESC, r.recommendation_id DESC',
  old: 'r.created_at ASC, r.recommendation_id ASC',
  helpful: 'r.votes_up DESC, r.weighted_score DESC, r.created_at DESC',
};

export interface ReviewFilters extends Scope {
  sentiment?: Sentiment;
  term?: string;
  sort?: ReviewSort;
  page?: number;
  pageSize?: number;
}

export interface ReviewItem {
  id: string;
  createdAt: number;
  date: string;
  votedUp: boolean;
  /** Steam language code. */
  language: string;
  text: string;
  /** Best sentence for long reviews; null when the full text is short enough. */
  excerpt: string | null;
  votesUp: number;
  playtimeAtReviewHours: number;
  segment: SegmentId;
  url: string;
}

const EXCERPT_OVER = 220;

function excerptFor(text: string, term: string | undefined): string | null {
  if (text.length <= EXCERPT_OVER) return null;
  const sentences = splitSentences(text);
  const lower = term?.toLowerCase();
  const hit = lower ? sentences.find((s) => s.toLowerCase().includes(lower)) : undefined;
  const pick = hit ?? sentences.find((s) => [...s].length >= 12) ?? sentences[0] ?? text;
  return [...pick].length > EXCERPT_OVER ? [...pick].slice(0, EXCERPT_OVER).join('') + '…' : pick;
}

export function reviewList(appid: number, f: ReviewFilters, conn: DatabaseSync = sharedDb()) {
  const where = scopeWhere(f);
  let sql = `FROM reviews r WHERE r.appid = ? AND ${where.sql}`;
  const params: SQLInputValue[] = [appid, ...where.params];
  if (f.sentiment) {
    sql += ' AND r.voted_up = ?';
    params.push(f.sentiment === 'p' ? 1 : 0);
  }
  if (f.term) {
    sql += ' AND EXISTS (SELECT 1 FROM review_terms t WHERE t.recommendation_id = r.recommendation_id AND t.term = ?)';
    params.push(f.term.toLowerCase());
  }
  const total = (conn.prepare(`SELECT COUNT(*) AS n ${sql}`).get(...params) as { n: number }).n;
  const pageSize = Math.min(50, Math.max(1, f.pageSize ?? 12));
  const page = Math.max(1, f.page ?? 1);
  const rows = conn
    .prepare(
      `SELECT r.recommendation_id AS id, r.author_steamid, r.created_at, r.voted_up, r.language, r.text, r.votes_up,
              r.playtime_at_review_min,
              ${segmentSql('r.playtime_at_review_min')} AS seg
       ${sql}
       ORDER BY ${ORDER[f.sort ?? 'new']}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as Record<string, any>[];

  const items: ReviewItem[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    date: dayKey(r.created_at),
    votedUp: r.voted_up === 1,
    language: r.language,
    text: r.text,
    excerpt: excerptFor(r.text, f.term),
    votesUp: r.votes_up,
    playtimeAtReviewHours: Math.round((r.playtime_at_review_min / 60) * 10) / 10,
    segment: r.seg,
    url: r.author_steamid
      ? `https://steamcommunity.com/profiles/${r.author_steamid}/recommended/${appid}/`
      : `https://steamcommunity.com/app/${appid}/reviews/`,
  }));
  return { total, page, pageSize, sort: f.sort ?? 'new', items };
}
