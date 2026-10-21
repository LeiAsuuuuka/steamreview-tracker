import type { SegmentId } from './api/types';

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? '–' : `${(v * 100).toFixed(digits)}%`;

export const int = (v: number | null | undefined) => (v === null || v === undefined ? '–' : v.toLocaleString('en-US'));

/** 'YYYY-MM-DD' → 'Thu 15 Oct' (the day string is already local to the server's timezone). */
export function dayLabel(day: string, opts: { weekday?: boolean } = { weekday: true }): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: opts.weekday ? 'short' : undefined, day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

export function relativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) return 'never';
  const s = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} days ago`;
}

export const SEGMENT_COLOR: Record<SegmentId, string> = {
  new: 'var(--seg-new)',
  normal: 'var(--seg-normal)',
  hard: 'var(--seg-hard)',
};

export const SEGMENT_SHORT: Record<SegmentId, string> = { new: 'New', normal: 'Normal', hard: 'HardCore' };
