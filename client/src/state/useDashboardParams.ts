import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RangeId, SegmentId, Sentiment } from '../api/types';

export interface DashboardParams {
  range: RangeId;
  /** Talking points period: 'last7' or an ISO week. */
  period: string;
  day: string | null;
  segment: SegmentId | null;
  sentiment: Sentiment | null;
  term: string | null;
}

const RANGES: RangeId[] = ['7d', '30d', 'all'];
const SEGMENTS: SegmentId[] = ['new', 'normal', 'hard'];

/** Dashboard view state lives in the URL, so any view can be bookmarked or shared. */
export function useDashboardParams() {
  const [sp, setSp] = useSearchParams();

  const params = useMemo<DashboardParams>(() => {
    const range = sp.get('range') as RangeId;
    const segment = sp.get('seg') as SegmentId;
    const sentiment = sp.get('sent');
    return {
      range: RANGES.includes(range) ? range : '7d',
      period: sp.get('period') || 'last7',
      day: sp.get('day'),
      segment: SEGMENTS.includes(segment) ? segment : null,
      sentiment: sentiment === 'p' || sentiment === 'n' ? sentiment : null,
      term: sp.get('term'),
    };
  }, [sp]);

  const update = useCallback(
    (patch: Partial<DashboardParams>) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          const map: Record<keyof DashboardParams, string> = {
            range: 'range', period: 'period', day: 'day', segment: 'seg', sentiment: 'sent', term: 'term',
          };
          for (const [k, v] of Object.entries(patch) as [keyof DashboardParams, string | null][]) {
            const key = map[k];
            const isDefault = (k === 'range' && v === '7d') || (k === 'period' && v === 'last7');
            if (v === null || v === undefined || isDefault) next.delete(key);
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
