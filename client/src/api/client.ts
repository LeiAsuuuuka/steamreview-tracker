import type {
  DailyPoint, Game, KeywordResult, LanguageCount, Period, RangeId, ReviewPage, ReviewSort, SearchResult, SegmentId,
  SegmentRow, Sentiment, Summary,
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

/** Comma-joined Steam language codes; empty = all languages (param omitted). */
const lang = (langs: string[]) => (langs.length ? langs.join(',') : undefined);

export interface TalkingScope {
  period: string;
  /** Custom date range ('YYYY-MM-DD'); overrides the period when both are set. */
  from?: string | null;
  to?: string | null;
  day?: string | null;
  segment?: SegmentId | null;
  langs: string[];
}

export const api = {
  search: (q: string) => request<SearchResult[]>(`/search${qs({ q })}`),
  games: () => request<Game[]>('/games'),
  game: (appid: number) => request<Game>(`/games/${appid}`),
  sync: (appid: number) => request<Game>(`/games/${appid}/sync`, { method: 'POST' }),
  languages: (appid: number, range: RangeId) =>
    request<{ range: { from: string; to: string }; languages: LanguageCount[] }>(`/games/${appid}/languages${qs({ range })}`),
  summary: (appid: number, range: RangeId, langs: string[]) =>
    request<Summary>(`/games/${appid}/summary${qs({ range, lang: lang(langs) })}`),
  daily: (appid: number, range: RangeId, langs: string[]) =>
    request<{ range: { from: string; to: string }; points: DailyPoint[] }>(
      `/games/${appid}/daily${qs({ range, lang: lang(langs) })}`,
    ),
  segments: (appid: number, range: RangeId, langs: string[]) =>
    request<{ range: { from: string; to: string }; segments: SegmentRow[] }>(
      `/games/${appid}/segments${qs({ range, lang: lang(langs) })}`,
    ),
  periods: (appid: number, langs: string[]) => request<Period[]>(`/games/${appid}/periods${qs({ lang: lang(langs) })}`),
  keywords: (appid: number, s: TalkingScope) =>
    request<KeywordResult>(
      `/games/${appid}/keywords${qs({
        period: s.period, from: s.from, to: s.to, day: s.day, segment: s.segment, lang: lang(s.langs),
      })}`,
    ),
  reviews: (
    appid: number,
    s: TalkingScope & { sentiment?: Sentiment | null; term?: string | null; sort: ReviewSort; page: number; pageSize: number },
  ) =>
    request<ReviewPage>(
      `/games/${appid}/reviews${qs({
        period: s.period, from: s.from, to: s.to, day: s.day, segment: s.segment, lang: lang(s.langs),
        sentiment: s.sentiment, term: s.term, sort: s.sort, page: s.page, pageSize: s.pageSize,
      })}`,
    ),
};
