export type SegmentId = 'new' | 'normal' | 'hard';
export type Sentiment = 'p' | 'n';
export type RangeId = '7d' | '30d' | 'all';

export interface SyncStatus {
  runId: number;
  mode: 'initial' | 'incremental';
  status: 'running' | 'done' | 'error';
  startedAt: number;
  finishedAt: number | null;
  pages: number;
  fetched: number;
  oldestReached: number | null;
  stopAt: number;
  error: string | null;
}

export interface Game {
  appid: number;
  name: string;
  headerImage: string | null;
  reviewScoreDesc: string | null;
  steamTotalReviews: number | null;
  steamTotalPositive: number | null;
  coveredFrom: number | null;
  lastSyncedAt: number | null;
  storedReviews: number;
  storedDays: number;
  stale: boolean;
  syncing: boolean;
  lastSync: SyncStatus | null;
}

export interface SearchResult {
  appid: number;
  name: string;
  image: string | null;
}

export interface DailyPoint {
  date: string;
  positive: number;
  negative: number;
  total: number;
  rate: number | null;
  lowVolume: boolean;
  /** Today, still in progress. */
  partial: boolean;
}

export interface Summary {
  range: { from: string; to: string };
  avgDailyRate: number | null;
  eligibleDays: number;
  minDailyReviews: number;
  previous: { from: string; to: string; avgDailyRate: number; delta: number } | null;
  total: number;
  positive: number;
  negative: number;
  perDay: number;
  pooledRate: number | null;
  lowestDay: (DailyPoint & { volumeRatio: number | null }) | null;
  keywordLanguageReviews: number;
  insights: { trend: string | null; segments: string | null };
}

export interface SegmentRow {
  id: SegmentId;
  name: string;
  label: string;
  count: number;
  positive: number;
  share: number;
  rate: number | null;
}

export interface Period {
  id: string;
  label: string;
  from: string;
  to: string;
  reviews: number;
}

export interface KeywordTerm {
  term: string;
  count: number;
  share: number;
  score: number;
}

export interface KeywordResult {
  range: { from: string; to: string };
  language: string;
  reviews: { total: number; positive: number; negative: number };
  minReviews: number;
  insufficient: boolean;
  baseline: 'history' | 'selection';
  positive: KeywordTerm[];
  negative: KeywordTerm[];
}

export interface ReviewItem {
  id: string;
  createdAt: number;
  date: string;
  votedUp: boolean;
  text: string;
  excerpt: string | null;
  votesUp: number;
  playtimeAtReviewHours: number;
  segment: SegmentId;
  url: string;
}

export interface ReviewPage {
  total: number;
  page: number;
  pageSize: number;
  items: ReviewItem[];
}
