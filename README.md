# Review Pulse

A local Steam review trends tracker. Pick a game and it shows:

- **Average daily positive rate** and a **daily trend chart** (with review volume)
- **Player segments** by playtime at review: New (0–5 h), Normal (6–20 h), HardCore (21 h+)
- **Weekly talking points**: top keywords in Simplified Chinese reviews, split by positive / negative, with the reviews behind each keyword

Reviews come from Steam's public store endpoints (no API key) and are stored in a local SQLite file, so history grows each time you sync.

## Requirements

- Node.js 22.13 or newer (uses the built-in `node:sqlite`; developed on Node 24)

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173, search for a game by name or App ID, and the first sync starts automatically (7 days of reviews). The API runs on port 3001; Vite proxies `/api` to it.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run sync -- 1145360` | Sync one or more App IDs from the terminal and print a report |
| `npm run reindex` | Rebuild keyword terms after editing `server/src/text/lexicon.ts` |
| `npm test` | Server tests (time, segments, metrics, keywords, sync) |
| `npm run typecheck` | Type-check server and client |
| `npm run build && npm start` | Production build; the server then serves the app on http://localhost:3001 |

## How the numbers work

- **Days** use China time (UTC+8). Change with `TZ_OFFSET_HOURS`.
- **Average daily positive** = mean of each day's `positive / total`. Today (still in progress) and days with fewer than 5 reviews (`MIN_DAILY_REVIEWS`) are left out. **Overall positive** = all positives ÷ all reviews.
- **Segments** use `playtime_at_review`: New < 6 h, Normal 6 h to < 21 h, HardCore ≥ 21 h. Edit `config.segments` in `server/src/config.ts`.
- **Keywords** analyse only `schinese` reviews. Text is cleaned (BBCode, URLs, emoji), split with jieba plus a game-term dictionary, filtered with Chinese and gaming stopwords, and ranked by TF-IDF. Once earlier weeks are stored, they become the baseline, so recurring words sink and new topics rise. Keywords need at least 20 reviews in the selection (`KEYWORDS_MIN_REVIEWS`).

## Sync behaviour

- First sync of a game fetches reviews newest-first until it passes 7 days back (`SYNC_INITIAL_DAYS`).
- Later syncs stop at the newest stored review (with a 1-hour overlap). Reviews are never deleted, so the 30-day and "All stored" ranges unlock as history builds up.
- Opening a game whose data is older than 6 hours (`SYNC_STALE_HOURS`) syncs it automatically.
- Steam requests are throttled to about one per second (`SYNC_REQUEST_INTERVAL_MS`) and retried with backoff on 429 / 5xx.

## Layout

```
server/   Express API, SQLite (server/data/review-pulse.db), Steam client, analytics
  src/steam/      Steam endpoints (reviews, search, app details)
  src/sync/       Sync job (initial + incremental)
  src/analytics/  Daily rates, segments, keywords, review lists, ranges
  src/text/       Cleaning, jieba tokenizing, word lists
  scripts/        sync-cli, reindex
client/   React + Vite + TanStack Query + Recharts
  src/components/ TopBar, GameHeader, KpiTiles, TrendChart, SegmentPanel, TalkingPoints
  src/state/      Dashboard filters stored in the URL
```

## Environment variables

| Variable | Default |
| --- | --- |
| `API_PORT` | 3001 |
| `DB_PATH` | `server/data/review-pulse.db` |
| `TZ_OFFSET_HOURS` | 8 |
| `SYNC_INITIAL_DAYS` | 7 |
| `SYNC_STALE_HOURS` | 6 |
| `SYNC_REQUEST_INTERVAL_MS` | 1000 |
| `MIN_DAILY_REVIEWS` | 5 |
| `KEYWORDS_MIN_REVIEWS` | 20 |
