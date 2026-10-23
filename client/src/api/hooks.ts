import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api, type TalkingScope } from './client';
import type { RangeId, ReviewSort, SegmentId, Sentiment } from './types';

export const keys = {
  game: (appid: number) => ['game', appid] as const,
  data: (appid: number) => ['data', appid] as const,
};

/** Game info; polls while a sync is running and refreshes all charts when it finishes. */
export function useGame(appid: number) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: keys.game(appid),
    queryFn: () => api.game(appid),
    refetchInterval: (q) => (q.state.data?.syncing ? 1500 : false),
  });
  const wasSyncing = useRef(false);
  const syncing = query.data?.syncing ?? false;
  useEffect(() => {
    if (wasSyncing.current && !syncing) qc.invalidateQueries({ queryKey: keys.data(appid) });
    wasSyncing.current = syncing;
  }, [syncing, appid, qc]);
  return query;
}

export function useSync(appid: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.sync(appid),
    onSuccess: (game) => qc.setQueryData(keys.game(appid), game),
  });
}

/** Syncs once on open when the stored data is missing or older than the server's stale limit. */
export function useAutoSync(appid: number) {
  const game = useGame(appid);
  const sync = useSync(appid);
  const triggered = useRef<number | null>(null);
  useEffect(() => {
    const g = game.data;
    if (!g || g.syncing || !g.stale || triggered.current === appid) return;
    if (g.lastSync?.status === 'error' && g.lastSync.finishedAt && Date.now() / 1000 - g.lastSync.finishedAt < 300) return;
    triggered.current = appid;
    sync.mutate();
  }, [game.data, appid, sync]);
  return { game, sync };
}

const dataOpts = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;

export function useLanguages(appid: number, range: RangeId, enabled: boolean) {
  return useQuery({ queryKey: [...keys.data(appid), 'languages', range], queryFn: () => api.languages(appid, range), enabled, ...dataOpts });
}

export function useSummary(appid: number, range: RangeId, langs: string[], enabled: boolean) {
  return useQuery({
    queryKey: [...keys.data(appid), 'summary', range, langs],
    queryFn: () => api.summary(appid, range, langs),
    enabled,
    ...dataOpts,
  });
}

export function useDaily(appid: number, range: RangeId, langs: string[], enabled: boolean) {
  return useQuery({
    queryKey: [...keys.data(appid), 'daily', range, langs],
    queryFn: () => api.daily(appid, range, langs),
    enabled,
    ...dataOpts,
  });
}

export function useSegments(appid: number, range: RangeId, langs: string[], enabled: boolean) {
  return useQuery({
    queryKey: [...keys.data(appid), 'segments', range, langs],
    queryFn: () => api.segments(appid, range, langs),
    enabled,
    ...dataOpts,
  });
}

export function usePeriods(appid: number, langs: string[], enabled: boolean) {
  return useQuery({
    queryKey: [...keys.data(appid), 'periods', langs],
    queryFn: () => api.periods(appid, langs),
    enabled,
    ...dataOpts,
  });
}

export function useKeywords(appid: number, scope: TalkingScope, enabled: boolean) {
  return useQuery({ queryKey: [...keys.data(appid), 'keywords', scope], queryFn: () => api.keywords(appid, scope), enabled, ...dataOpts });
}

export function useReviews(
  appid: number,
  scope: TalkingScope & { sentiment: Sentiment | null; term: string | null; segment: SegmentId | null; sort: ReviewSort },
  pageSize: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...keys.data(appid), 'reviews', scope, pageSize],
    queryFn: () => api.reviews(appid, { ...scope, page: 1, pageSize }),
    enabled,
    ...dataOpts,
  });
}

export function useTrackedGames() {
  return useQuery({ queryKey: ['games'], queryFn: api.games });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}
