import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  appid               INTEGER PRIMARY KEY,
  name                TEXT,
  header_image        TEXT,
  review_score_desc   TEXT,
  total_reviews       INTEGER,
  total_positive      INTEGER,
  covered_from        INTEGER,  -- unix s: every review since this moment is stored
  newest_created      INTEGER,  -- unix s of the newest stored review
  last_synced_at      INTEGER,
  details_fetched_at  INTEGER,
  added_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  recommendation_id       TEXT PRIMARY KEY,
  appid                   INTEGER NOT NULL,
  author_steamid          TEXT NOT NULL,
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL,
  voted_up                INTEGER NOT NULL,
  language                TEXT NOT NULL,
  text                    TEXT NOT NULL,
  votes_up                INTEGER NOT NULL,
  weighted_score          REAL NOT NULL,
  playtime_at_review_min  INTEGER NOT NULL,
  playtime_forever_min    INTEGER NOT NULL,
  steam_purchase          INTEGER NOT NULL,
  received_for_free       INTEGER NOT NULL,
  early_access            INTEGER NOT NULL,
  fetched_at              INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_app_created ON reviews (appid, created_at);
CREATE INDEX IF NOT EXISTS reviews_app_lang_created ON reviews (appid, language, created_at);

-- Distinct terms per review (keyword-language reviews only), used for keyword counts and the term filter.
CREATE TABLE IF NOT EXISTS review_terms (
  recommendation_id  TEXT NOT NULL,
  appid              INTEGER NOT NULL,
  term               TEXT NOT NULL,
  PRIMARY KEY (recommendation_id, term)
);
CREATE INDEX IF NOT EXISTS review_terms_app_term ON review_terms (appid, term);

CREATE TABLE IF NOT EXISTS sync_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  appid           INTEGER NOT NULL,
  mode            TEXT NOT NULL,      -- 'initial' | 'incremental'
  status          TEXT NOT NULL,      -- 'running' | 'done' | 'error'
  started_at      INTEGER NOT NULL,
  finished_at     INTEGER,
  pages           INTEGER NOT NULL DEFAULT 0,
  fetched         INTEGER NOT NULL DEFAULT 0,
  oldest_reached  INTEGER,
  error           TEXT
);
CREATE INDEX IF NOT EXISTS sync_runs_app ON sync_runs (appid, id);
`;

let instance: DatabaseSync | null = null;

export function openDb(file = config.dbPath): DatabaseSync {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  // A server that was killed mid-sync leaves runs marked as running.
  db.prepare(`UPDATE sync_runs SET status = 'error', error = 'Interrupted', finished_at = ? WHERE status = 'running'`)
    .run(Math.floor(Date.now() / 1000));
  return db;
}

export function db(): DatabaseSync {
  if (!instance) instance = openDb();
  return instance;
}

/** Swap the shared connection (tests use ':memory:'). */
export function setDb(next: DatabaseSync): void {
  instance = next;
}

export function transaction<T>(conn: DatabaseSync, fn: () => T): T {
  conn.exec('BEGIN');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}
