import { config, type SegmentId } from '../config.js';

export function segmentOf(playtimeAtReviewMinutes: number): SegmentId {
  const hours = playtimeAtReviewMinutes / 60;
  for (const s of config.segments) {
    if (hours < s.maxHours) return s.id;
  }
  return config.segments[config.segments.length - 1].id;
}

/** SQL CASE expression matching segmentOf(), for grouping in queries. */
export function segmentSql(column = 'playtime_at_review_min'): string {
  const parts = config.segments
    .filter((s) => Number.isFinite(s.maxHours))
    .map((s) => `WHEN ${column} < ${s.maxHours * 60} THEN '${s.id}'`);
  const last = config.segments[config.segments.length - 1].id;
  return `CASE ${parts.join(' ')} ELSE '${last}' END`;
}

export function isSegmentId(v: unknown): v is SegmentId {
  return config.segments.some((s) => s.id === v);
}
