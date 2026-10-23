import type { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { db as sharedDb, transaction } from '../db/index.js';
import { fetchAppDetails, fetchReviewPage, type SteamReview } from '../steam/client.js';
import { extractTerms } from '../text/tokenize.js';

export interface SyncStatus {
  runId: number;
  appid: number;
  mode: 'initial' | 'incremental';
  status: 'running' | 'done' | 'error';
  startedAt: number;
  finishedAt: number | null;
  pages: number;
  fetched: number;
  /** Oldest review timestamp reached so far in this run. */
  oldestReached: number | null;
  /** Lower bound of this run: it stops once reviews are older than this. */
  stopAt: number;
  error: string | null;
}

type FetchPage = typeof fetchReviewPage;

const running = new Map<number, Promise<SyncStatus>>();
const live = new Map<number, SyncStatus>();

export function isSyncing(appid: number): boolean {
  return running.has(appid);
}

export function liveStatus(appid: number): SyncStatus | undefined {
  return live.get(appid);
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export async function ensureGame(appid: number, conn: DatabaseSync = sharedDb()): Promise<void> {
  const row = conn.prepare('SELECT details_fetched_at FROM games WHERE appid = ?').get(appid) as
    | { details_fetched_at: number | null }
    | undefined;
  if (!row) {
    conn.prepare('INSERT INTO games (appid, added_at) VALUES (?, ?)').run(appid, now());
  }
  const fresh = row?.details_fetched_at && now() - row.details_fetched_at < 86_400;
  if (fresh) return;
  try {
    const details = await fetchAppDetails(appid);
    if (details) {
      conn
        .prepare('UPDATE games SET name = ?, header_image = ?, details_fetched_at = ? WHERE appid = ?')
        .run(details.name, details.headerImage, now(), appid);
    }
  } catch {
    // Details are cosmetic; the review sync can proceed without them.
  }
}

function insertPage(conn: DatabaseSync, appid: number, reviews: SteamReview[]): void {
  const upsert = conn.prepare(`
    INSERT INTO reviews (recommendation_id, appid, author_steamid, created_at, updated_at, voted_up, language, text,
      votes_up, weighted_score, playtime_at_review_min, playtime_forever_min, steam_purchase, received_for_free,
      early_access, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (recommendation_id) DO UPDATE SET
      updated_at = excluded.updated_at, voted_up = excluded.voted_up, text = excluded.text,
      votes_up = excluded.votes_up, weighted_score = excluded.weighted_score,
      playtime_forever_min = excluded.playtime_forever_min, fetched_at = excluded.fetched_at`);
  const clearTerms = conn.prepare('DELETE FROM review_terms WHERE recommendation_id = ?');
  const addTerm = conn.prepare('INSERT OR IGNORE INTO review_terms (recommendation_id, appid, term) VALUES (?, ?, ?)');
  const fetchedAt = now();

  transaction(conn, () => {
    for (const r of reviews) {
      const atReview = r.author.playtime_at_review ?? r.author.playtime_forever ?? 0;
      upsert.run(
        r.recommendationid,
        appid,
        r.author.steamid ?? '',
        r.timestamp_created,
        r.timestamp_updated,
        r.voted_up ? 1 : 0,
        r.language,
        r.review ?? '',
        r.votes_up ?? 0,
        Number(r.weighted_vote_score) || 0,
        atReview,
        r.author.playtime_forever ?? 0,
        r.steam_purchase ? 1 : 0,
        r.received_for_free ? 1 : 0,
        r.written_during_early_access ? 1 : 0,
        fetchedAt,
      );
      clearTerms.run(r.recommendationid);
      for (const term of extractTerms(r.review ?? '', r.language)) addTerm.run(r.recommendationid, appid, term);
    }
  });
}

/**
 * Fetch reviews newest-first until we pass the stop point:
 * first sync → `initialDays` ago; later syncs → the newest review already stored (minus an overlap).
 */
export async function runSync(
  appid: number,
  opts: { conn?: DatabaseSync; fetchPage?: FetchPage; initialDays?: number } = {},
): Promise<SyncStatus> {
  const conn = opts.conn ?? sharedDb();
  const fetchPage = opts.fetchPage ?? fetchReviewPage;
  const initialDays = opts.initialDays ?? config.sync.initialDays;

  await ensureGame(appid, conn);
  const game = conn.prepare('SELECT covered_from, newest_created FROM games WHERE appid = ?').get(appid) as {
    covered_from: number | null;
    newest_created: number | null;
  };

  const startedAt = now();
  const initial = game.covered_from === null || game.newest_created === null;
  const stopAt = initial ? startedAt - initialDays * 86_400 : game.newest_created! - config.sync.overlapSeconds;
  const mode = initial ? 'initial' : 'incremental';

  const runId = Number(
    conn
      .prepare(`INSERT INTO sync_runs (appid, mode, status, started_at) VALUES (?, ?, 'running', ?)`)
      .run(appid, mode, startedAt).lastInsertRowid,
  );
  const status: SyncStatus = {
    runId, appid, mode, status: 'running', startedAt, finishedAt: null,
    pages: 0, fetched: 0, oldestReached: null, stopAt, error: null,
  };
  live.set(appid, status);
  const saveProgress = conn.prepare('UPDATE sync_runs SET pages = ?, fetched = ?, oldest_reached = ? WHERE id = ?');

  let cursor = '*';
  const seenCursors = new Set<string>();
  let newest = game.newest_created ?? 0;
  try {
    for (;;) {
      const page = await fetchPage(appid, cursor);
      if (page.summary) {
        conn
          .prepare('UPDATE games SET review_score_desc = ?, total_reviews = ?, total_positive = ? WHERE appid = ?')
          .run(page.summary.review_score_desc, page.summary.total_reviews, page.summary.total_positive, appid);
      }
      const inWindow = page.reviews.filter((r) => r.timestamp_created >= stopAt);
      if (inWindow.length) insertPage(conn, appid, inWindow);

      status.pages += 1;
      status.fetched += inWindow.length;
      for (const r of page.reviews) {
        newest = Math.max(newest, r.timestamp_created);
        status.oldestReached = Math.min(status.oldestReached ?? Infinity, r.timestamp_created);
      }
      saveProgress.run(status.pages, status.fetched, status.oldestReached, runId);

      const passedStop = page.reviews.some((r) => r.timestamp_created < stopAt);
      const exhausted = page.reviews.length === 0 || !page.cursor || seenCursors.has(page.cursor);
      if (passedStop || exhausted) break;
      seenCursors.add(page.cursor!);
      cursor = page.cursor!;
    }

    const finishedAt = now();
    conn
      .prepare(
        `UPDATE games SET covered_from = COALESCE(covered_from, ?), newest_created = ?, last_synced_at = ? WHERE appid = ?`,
      )
      .run(stopAt, newest || null, finishedAt, appid);
    conn.prepare(`UPDATE sync_runs SET status = 'done', finished_at = ? WHERE id = ?`).run(finishedAt, runId);
    status.status = 'done';
    status.finishedAt = finishedAt;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finishedAt = now();
    conn.prepare(`UPDATE sync_runs SET status = 'error', error = ?, finished_at = ? WHERE id = ?`).run(message, finishedAt, runId);
    status.status = 'error';
    status.error = message;
    status.finishedAt = finishedAt;
  }
  return status;
}

/** Start a sync in the background unless one is already running for this game. */
export function startSync(appid: number): Promise<SyncStatus> {
  const existing = running.get(appid);
  if (existing) return existing;
  const job = runSync(appid).finally(() => running.delete(appid));
  running.set(appid, job);
  return job;
}

export function lastRun(appid: number, conn: DatabaseSync = sharedDb()): SyncStatus | null {
  const inMemory = live.get(appid);
  if (inMemory) return inMemory;
  const row = conn.prepare('SELECT * FROM sync_runs WHERE appid = ? ORDER BY id DESC LIMIT 1').get(appid) as
    | Record<string, any>
    | undefined;
  if (!row) return null;
  return {
    runId: row.id, appid, mode: row.mode, status: row.status, startedAt: row.started_at,
    finishedAt: row.finished_at, pages: row.pages, fetched: row.fetched,
    oldestReached: row.oldest_reached, stopAt: 0, error: row.error,
  };
}
