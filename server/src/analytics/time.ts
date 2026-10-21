import { config } from '../config.js';

const DAY = 86_400;

/** Unix seconds → 'YYYY-MM-DD' in the configured timezone. */
export function dayKey(unixSeconds: number, offsetHours = config.tzOffsetHours): string {
  return new Date((unixSeconds + offsetHours * 3600) * 1000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' (configured timezone) → unix seconds at local midnight. */
export function dayStart(day: string, offsetHours = config.tzOffsetHours): number {
  return Date.parse(`${day}T00:00:00Z`) / 1000 - offsetHours * 3600;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (DAY * 1000));
}

/** Inclusive list of days from → to. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** ISO 8601 week for a 'YYYY-MM-DD' day, e.g. '2026-W42'. */
export function isoWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const weekday = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // Thursday of this week decides the year
  const year = d.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Monday and Sunday ('YYYY-MM-DD') of an ISO week string. */
export function weekBounds(week: string): { from: string; to: string } {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) throw new Error(`Invalid ISO week: ${week}`);
  const year = Number(m[1]);
  const wk = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Weekday - 1) + (wk - 1) * 7);
  const from = monday.toISOString().slice(0, 10);
  return { from, to: addDays(from, 6) };
}

export function today(offsetHours = config.tzOffsetHours): string {
  return dayKey(Math.floor(Date.now() / 1000), offsetHours);
}
