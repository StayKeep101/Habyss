import type { Interval, TaskRow } from '../types';
import { overlap } from '../analytics';
import { localDateKey } from '../shared/habitSchedule';

export type Range = 'Today' | 'Week' | 'Month' | 'Year';
type Class = 'productive' | 'neutral' | 'unproductive';

const MAX_SLICES = 5, MIN_SHARE = 0.05;

/** Local calendar bounds from the start of the range to now. Weeks start on Monday. */
export function rangeBounds(range: Range, now: Date): [number, number] {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const start = range === 'Year' ? new Date(y, 0, 1) : range === 'Month' ? new Date(y, m, 1) : new Date(y, m, range === 'Week' ? d - (now.getDay() + 6) % 7 : d);
  return [start.getTime(), now.getTime()];
}

export function greeting(now: Date): 'Good Morning' | 'Good Afternoon' | 'Good Evening' {
  const h = now.getHours();
  return h >= 5 && h < 12 ? 'Good Morning' : h >= 12 && h < 18 ? 'Good Afternoon' : 'Good Evening';
}

/** Active ms per category inside [from, min(to, now)]. */
function activeByCategory(intervals: Interval[], from: number, to: number, now: number): Map<string, number> {
  const end = Math.min(to, now), out = new Map<string, number>();
  for (const i of intervals) {
    if (i.state !== 'active') continue;
    const ms = overlap(i.start, i.end, from, end), key = i.category || 'uncategorized';
    if (ms > 0) out.set(key, (out.get(key) ?? 0) + ms);
  }
  return out;
}

/** Active time by category, largest first. Slices under 5%, and any beyond the fifth, fold into "Other". */
export function allocation(intervals: Interval[], from: number, to: number, now: number): { label: string; value: number }[] {
  const all = [...activeByCategory(intervals, from, to, now)].sort((a, b) => b[1] - a[1]);
  const total = all.reduce((n, [, ms]) => n + ms, 0);
  const shown = all.filter(([, ms]) => ms / total >= MIN_SHARE).slice(0, MAX_SLICES);
  const other = total - shown.reduce((n, [, ms]) => n + ms, 0);
  return [...shown.map(([label, value]) => ({ label, value })), ...(other > 0 ? [{ label: 'Other', value: other }] : [])];
}

/** Productive share of active time, rounded. Unclassified time is neutral and stays in the denominator. */
export function productivePercent(intervals: Interval[], classes: Record<string, Class>, from: number, to: number, now: number): number | null {
  let active = 0, productive = 0, judged = 0;
  for (const [category, ms] of activeByCategory(intervals, from, to, now)) {
    active += ms;
    const c = classes[category] ?? 'neutral';
    if (c !== 'neutral') judged += ms;
    if (c === 'productive') productive += ms;
  }
  return active > 0 && judged > 0 ? Math.round(productive / active * 100) : null;
}

/** The local day a task was completed, read as doneOnDay does. */
const completedDay = (at: string): string => { const when = new Date(at); return Number.isFinite(when.getTime()) ? localDateKey(when) : at.slice(0, 10); };

/** Tasks due within [from, to] (date keys, inclusive), and how many of those were completed within it. Cancelled tasks are not due. */
export function tasksInRange(tasks: TaskRow[], from: string, to: string): { done: number; total: number } {
  const inRange = (day: string) => day >= from && day <= to;
  const due = tasks.filter(t => !t.deleted && t.status !== 'cancelled' && t.due_date && inRange(t.due_date.slice(0, 10)));
  return { done: due.filter(t => t.status === 'done' && t.completed_at && inRange(completedDay(t.completed_at))).length, total: due.length };
}
