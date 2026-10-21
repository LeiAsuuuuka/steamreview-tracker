import type {
  DailyPoint, Game, KeywordResult, Period, RangeId, ReviewPage, SearchResult, SegmentId, SegmentRow, Sentiment, Summary,
} from './types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError('Cannot reach the Review Pulse server. Is it running (npm run dev)?', 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // The Vite proxy answers 500 with no JSON body when the API server is down.
    const fallback = res.status >= 500 && !body
      ? 'Cannot reach the Review Pulse server. Is it running (npm run dev)?'
      : `Request failed (${res.status})`;
    throw new ApiError(body?.error ?? fallback, res.status);
  }
  return body as T;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface TalkingScope {
  period: string;
  day?: string | null;
  segment?: SegmentId | null;
}

export const api = {
  search: (q: string) => request<SearchResult[]>(`/search${qs({ q })}`),
  games: () => request<Game[]>('/games'),
  game: (appid: number) => request<Game>(`/games/${appid}`),
  sync: (appid: number) => request<Game>(`/games/${appid}/sync`, { method: 'POST' }),
  summary: (appid: number, range: RangeId) => request<Summary>(`/games/${appid}/summary${qs({ range })}`),
  daily: (appid: number, range: RangeId) =>
    request<{ range: { from: string; to: string }; points: DailyPoint[] }>(`/games/${appid}/daily${qs({ range })}`),
  segments: (appid: number, range: RangeId) =>
    request<{ range: { from: string; to: string }; segments: SegmentRow[] }>(`/games/${appid}/segments${qs({ range })}`),
  periods: (appid: number) => request<Period[]>(`/games/${appid}/periods`),
  keywords: (appid: number, s: TalkingScope) =>
    request<KeywordResult>(`/games/${appid}/keywords${qs({ period: s.period, day: s.day, segment: s.segment })}`),
  reviews: (appid: number, s: TalkingScope & { sentiment?: Sentiment | null; term?: string | null; page: number; pageSize: number }) =>
    request<ReviewPage>(
      `/games/${appid}/reviews${qs({
        period: s.period, day: s.day, segment: s.segment, sentiment: s.sentiment, term: s.term, page: s.page, pageSize: s.pageSize,
      })}`,
    ),
};
