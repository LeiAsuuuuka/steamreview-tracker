import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RangeId, ReviewSort, SegmentId, Sentiment } from '../api/types';

export interface DashboardParams {
  range: RangeId;
  /** Review languages (Steam codes); empty = all languages. */
  langs: string[];
  /** Talking points period: 'last7' or an ISO week. */
  period: string;
  /** Talking points custom dates ('YYYY-MM-DD'); override the period when both are set. */
  from: string | null;
  to: string | null;
  /** Review list order. */
  sort: ReviewSort;
  day: string | null;
  segment: SegmentId | null;
  sentiment: Sentiment | null;
  term: string | null;
}

const RANGES: RangeId[] = ['7d', '30d', 'all'];
const SEGMENTS: SegmentId[] = ['new', 'normal', 'hard'];
const SORTS: ReviewSort[] = ['new', 'old', 'helpful'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LANG_KEY = 'review-pulse.langs';

const parseLangs = (raw: string | null) =>
  (raw ?? '').split(',').map((s) => s.trim()).filter((s) => /^[a-z]{2,16}$/.test(s));

/** The last language choice, so it carries over to the next game. Storage can be unavailable. */
function storedLangs(): string[] {
  try {
    return parseLangs(localStorage.getItem(LANG_KEY));
  } catch {
    return [];
  }
}

function storeLangs(langs: string[]) {
  try {
    localStorage.setItem(LANG_KEY, langs.join(','));
  } catch {
    // Not remembering the choice is fine.
  }
}

/** Dashboard view state lives in the URL, so any view can be bookmarked or shared. */
export function useDashboardParams() {
  const [sp, setSp] = useSearchParams();

  const params = useMemo<DashboardParams>(() => {
    const range = sp.get('range') as RangeId;
    const segment = sp.get('seg') as SegmentId;
    const sentiment = sp.get('sent');
    return {
      range: RANGES.includes(range) ? range : '7d',
      langs: sp.has('lang') ? parseLangs(sp.get('lang')) : storedLangs(),
      period: sp.get('period') || 'last7',
      from: DAY_RE.test(sp.get('from') ?? '') && DAY_RE.test(sp.get('to') ?? '') ? sp.get('from') : null,
      to: DAY_RE.test(sp.get('from') ?? '') && DAY_RE.test(sp.get('to') ?? '') ? sp.get('to') : null,
      sort: SORTS.includes(sp.get('sort') as ReviewSort) ? (sp.get('sort') as ReviewSort) : 'new',
      day: sp.get('day'),
      segment: SEGMENTS.includes(segment) ? segment : null,
      sentiment: sentiment === 'p' || sentiment === 'n' ? sentiment : null,
      term: sp.get('term'),
    };
  }, [sp]);

  const update = useCallback(
    (patch: Partial<DashboardParams>) => {
      if (patch.langs) storeLangs(patch.langs);
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          const map: Record<keyof DashboardParams, string> = {
            range: 'range', langs: 'lang', period: 'period', from: 'from', to: 'to', sort: 'sort',
            day: 'day', segment: 'seg', sentiment: 'sent', term: 'term',
          };
          for (const [k, raw] of Object.entries(patch) as [keyof DashboardParams, string | string[] | null][]) {
            const key = map[k];
            const v = Array.isArray(raw) ? raw.join(',') : raw;
            const isDefault =
              (k === 'range' && v === '7d') || (k === 'period' && v === 'last7') || (k === 'sort' && v === 'new');
            // An empty language list means all languages; keep `lang=` in the URL so it overrides the remembered choice.
            if (k === 'langs') next.set(key, v ?? '');
            else if (v === null || v === undefined || isDefault) next.delete(key);
            else next.set(key, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  return [params, update] as const;
}
