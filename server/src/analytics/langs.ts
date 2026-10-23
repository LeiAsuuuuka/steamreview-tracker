import type { SQLInputValue } from 'node:sqlite';

const CODE = /^[a-z]{2,16}$/;

/** Parse `?lang=schinese,english` (or repeated `lang=`) into Steam language codes. Empty = all languages. */
export function parseLangs(q: unknown): string[] {
  const raw = Array.isArray(q) ? q.join(',') : typeof q === 'string' ? q : '';
  return [...new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter((s) => CODE.test(s)))];
}

/** ` AND <column> IN (?, …)` for a language filter, or nothing when all languages are selected. */
export function langClause(langs: string[] | undefined, column = 'language'): { sql: string; params: SQLInputValue[] } {
  if (!langs?.length) return { sql: '', params: [] };
  return { sql: ` AND ${column} IN (${langs.map(() => '?').join(', ')})`, params: langs };
}
