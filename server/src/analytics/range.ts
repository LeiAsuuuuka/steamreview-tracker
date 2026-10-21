import { addDays, dayKey, dayStart, daysBetween, today } from './time.js';

export interface DateRange {
  from: string; // inclusive, 'YYYY-MM-DD' local
  to: string; // inclusive
  fromTs: number; // unix s, inclusive
  toTs: number; // unix s, exclusive
}

export function makeRange(from: string, to: string): DateRange {
  return { from, to, fromTs: dayStart(from), toTs: dayStart(addDays(to, 1)) };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve `?range=7d|30d|all` or `?from=&to=` into concrete days.
 * `coveredFrom` is the moment since which every review is stored; 'all' starts there.
 */
export function resolveRange(
  q: { range?: unknown; from?: unknown; to?: unknown },
  coveredFrom: number | null,
): DateRange {
  const end = today();
  if (typeof q.from === 'string' && typeof q.to === 'string' && DAY_RE.test(q.from) && DAY_RE.test(q.to)) {
    return q.from <= q.to ? makeRange(q.from, q.to) : makeRange(q.to, q.from);
  }
  const range = typeof q.range === 'string' ? q.range : '7d';
  if (range === 'all') {
    const start = coveredFrom ? dayKey(coveredFrom) : addDays(end, -6);
    // Day of covered_from is only partly covered; start on the next full day.
    const firstFull = coveredFrom && dayStart(start) < coveredFrom ? addDays(start, 1) : start;
    return makeRange(firstFull <= end ? firstFull : end, end);
  }
  const m = /^(\d{1,3})d$/.exec(range);
  const days = m ? Math.max(1, Math.min(365, Number(m[1]))) : 7;
  return makeRange(addDays(end, -(days - 1)), end);
}

/** The range of the same length right before `r`. */
export function previousRange(r: DateRange): DateRange {
  const len = daysBetween(r.from, r.to) + 1;
  return makeRange(addDays(r.from, -len), addDays(r.from, -1));
}

/** Whole days of stored history, counting from the first fully covered day to today. */
export function storedDays(coveredFrom: number | null): number {
  if (!coveredFrom) return 0;
  const all = resolveRange({ range: 'all' }, coveredFrom);
  return daysBetween(all.from, all.to) + 1;
}
