// Usage: npm run sync -- <appid> [<appid> …]
// Syncs reviews into the local database and prints a short report.
import { config } from '../src/config.js';
import { db } from '../src/db/index.js';
import { averageDailyRate, daily, languages, segments } from '../src/analytics/metrics.js';
import { keywords, rangeForPeriod } from '../src/analytics/keywords.js';
import { resolveRange } from '../src/analytics/range.js';
import { runSync } from '../src/sync/syncGame.js';

const ids = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);
if (!ids.length) {
  console.error('Usage: npm run sync -- <appid> [<appid> …]   e.g. npm run sync -- 1145360');
  process.exit(1);
}

const pct = (v: number | null) => (v === null ? '–' : `${(v * 100).toFixed(1)}%`);

for (const appid of ids) {
  const t0 = Date.now();
  process.stdout.write(`Syncing ${appid} … `);
  const run = await runSync(appid);
  console.log(`${run.status} · ${run.mode} · ${run.pages} pages · ${run.fetched} reviews · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (run.error) {
    console.error(`  ${run.error}`);
    continue;
  }
  const g = db().prepare('SELECT name, covered_from FROM games WHERE appid = ?').get(appid) as { name: string; covered_from: number };
  const range = resolveRange({ range: `${config.sync.initialDays}d` }, g.covered_from);
  const points = daily(appid, range);
  console.log(`  ${g.name}  ${range.from} → ${range.to}`);
  for (const p of points) console.log(`  ${p.date}  ${String(p.total).padStart(5)} reviews  ${pct(p.rate)}${p.lowVolume ? '  (low volume)' : ''}`);
  console.log(`  Average daily positive: ${pct(averageDailyRate(points))}`);
  for (const s of segments(appid, range)) console.log(`  ${s.name.padEnd(16)} ${String(s.count).padStart(5)}  ${pct(s.rate)}`);
  for (const l of languages(appid, range).slice(0, 5)) console.log(`  ${l.code.padEnd(16)} ${String(l.count).padStart(5)}`);
  const kw = keywords(appid, { range: rangeForPeriod('last7') });
  if (kw.insufficient) console.log(`  Keywords: only ${kw.reviews.total} reviews (need ${kw.minReviews})`);
  else {
    console.log(`  Positive keywords: ${kw.positive.map((k) => `${k.term}(${k.count})`).join(' ')}`);
    console.log(`  Negative keywords: ${kw.negative.map((k) => `${k.term}(${k.count})`).join(' ')}`);
  }
}
