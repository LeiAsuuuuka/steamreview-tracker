// Usage: npm run reindex
// Rebuilds review_terms for every stored review. Run after editing src/text/lexicon.ts or tokenize.ts.
import { db, transaction } from '../src/db/index.js';
import { extractTerms } from '../src/text/tokenize.js';

const conn = db();
const rows = conn
  .prepare('SELECT recommendation_id AS id, appid, language, text FROM reviews')
  .all() as { id: string; appid: number; language: string; text: string }[];

const t0 = Date.now();
const add = conn.prepare('INSERT OR IGNORE INTO review_terms (recommendation_id, appid, term) VALUES (?, ?, ?)');
let terms = 0;
transaction(conn, () => {
  conn.exec('DELETE FROM review_terms');
  for (const r of rows) {
    for (const term of extractTerms(r.text, r.language)) {
      add.run(r.id, r.appid, term);
      terms += 1;
    }
  }
});
console.log(`Reindexed ${rows.length} reviews → ${terms} terms in ${Date.now() - t0} ms`);
