import { config } from '../config.js';

const STORE = 'https://store.steampowered.com';
const HEADERS = { 'User-Agent': 'ReviewPulse/0.1 (local review tracker)', Accept: 'application/json' };

export interface SteamReview {
  recommendationid: string;
  author: {
    steamid: string;
    playtime_forever: number;
    playtime_at_review?: number;
    num_reviews?: number;
  };
  language: string;
  review: string;
  timestamp_created: number;
  timestamp_updated: number;
  voted_up: boolean;
  votes_up: number;
  weighted_vote_score: number | string;
  steam_purchase: boolean;
  received_for_free: boolean;
  written_during_early_access: boolean;
}

export interface ReviewPage {
  cursor: string | null;
  reviews: SteamReview[];
  summary?: {
    review_score_desc: string;
    total_positive: number;
    total_negative: number;
    total_reviews: number;
  };
}

export interface SearchResult {
  appid: number;
  name: string;
  image: string | null;
}

export interface AppDetails {
  appid: number;
  name: string;
  headerImage: string | null;
}

export class SteamError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

// One shared throttle for every Steam request this process makes.
let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + config.sync.requestIntervalMs;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function getJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.sync.maxRetries; attempt++) {
    await throttle();
    try {
      // Steam answers retired endpoints with a 302 to the store homepage; following it
      // would surface as a (retried) JSON parse error on the HTML.
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000), redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        throw new SteamError(
          `Steam redirected ${new URL(url).pathname} to ${res.headers.get('location') ?? '?'} — the endpoint may have been retired`,
          res.status
        );
      }
      if (res.status === 429 || res.status >= 500) {
        throw new SteamError(`Steam responded ${res.status}`, res.status);
      }
      if (!res.ok) throw new SteamError(`Steam responded ${res.status}`, res.status);
      return await res.json();
    } catch (err) {
      lastError = err;
      const retryable = !(err instanceof SteamError) || err.status === 429 || (err.status ?? 0) >= 500;
      if (!retryable || attempt === config.sync.maxRetries) break;
      const backoff = 1000 * 2 ** attempt + Math.random() * 500;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastError instanceof Error ? lastError : new SteamError(String(lastError));
}

/**
 * One page of reviews, newest first. Pass cursor '*' for the first page.
 * Uses /ajaxappreviews: the old /appreviews now 302s to the store homepage, and its
 * documented successor IUserReviewsService/GetAppReviews returns a different shape.
 */
export async function fetchReviewPage(appid: number, cursor: string): Promise<ReviewPage> {
  const params = new URLSearchParams({
    json: '1',
    filter: 'recent',
    language: 'all',
    review_type: 'all',
    purchase_type: 'all',
    num_per_page: '100',
    cursor,
  });
  const data = (await getJson(`${STORE}/ajaxappreviews/${appid}?${params}`)) as {
    success?: number;
    cursor?: string;
    reviews?: SteamReview[];
    query_summary?: ReviewPage['summary'];
  };
  if (data.success !== 1) throw new SteamError(`Steam returned no reviews for app ${appid}. Check the App ID.`);
  if (data.reviews !== undefined && !Array.isArray(data.reviews)) {
    throw new SteamError('Unexpected review response shape from Steam');
  }
  return {
    cursor: typeof data.cursor === 'string' ? data.cursor : null,
    reviews: data.reviews ?? [],
    summary: cursor === '*' ? data.query_summary : undefined,
  };
}

export async function searchApps(term: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ term, l: 'english', cc: 'US' });
  const data = (await getJson(`${STORE}/api/storesearch/?${params}`)) as {
    items?: { id: number; name: string; tiny_image?: string; type?: string }[];
  };
  return (data.items ?? [])
    .filter((i) => i.type === undefined || i.type === 'app')
    .map((i) => ({ appid: i.id, name: i.name, image: i.tiny_image ?? null }));
}

export async function fetchAppDetails(appid: number): Promise<AppDetails | null> {
  const params = new URLSearchParams({ appids: String(appid), l: 'english', filters: 'basic' });
  const data = (await getJson(`${STORE}/api/appdetails?${params}`)) as Record<
    string,
    { success: boolean; data?: { name: string; header_image?: string } }
  >;
  const entry = data?.[String(appid)];
  if (!entry?.success || !entry.data) return null;
  return { appid, name: entry.data.name, headerImage: entry.data.header_image ?? null };
}
