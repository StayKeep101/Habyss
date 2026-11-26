/** One minute → pixels scale for both timelines, so the planned and tracked sides line up hour for hour (the phone's rule:
 * one scale for items and the gaps between them, so an hour is always twice as tall as half an hour). */
export interface Axis { from: number; to: number; pxPerMin: number; height: number; y(minute: number): number; minuteAt(y: number): number }

/**
 * Waking to bedtime, in minutes from the day's midnight. A bedtime at or before waking is after midnight (07:00–01:00 is
 * 420–1500), so the axis never collapses. `spans` widens it to take in anything outside those hours (time tracked at 6 am,
 * a task set after bedtime).
 */
export function makeAxis(wake: number, sleep: number, pxPerMin = 1.6, spans: { start: number; end: number }[] = []): Axis {
  const bed = sleep <= wake ? sleep + 1440 : sleep;
  const from = Math.max(0, Math.min(wake, ...spans.map(s => s.start)));
  const to = Math.max(from + 60, bed, ...spans.map(s => s.end));
  return { from, to, pxPerMin, height: (to - from) * pxPerMin, y: m => (m - from) * pxPerMin, minuteAt: y => from + y / pxPerMin };
}
/** Hour marks inside the axis, as minutes. */
export const hourMarks = (axis: Axis): number[] => { const out: number[] = []; for (let m = Math.ceil(axis.from / 60) * 60; m <= axis.to; m += 60) out.push(m); return out; };

/**
 * Where each planned row sits: at its time, or just under the row before when that one (drawn at least `min` tall so its
 * title fits) would overlap it. Short items back to back used to be drawn on top of each other.
 */
export function stack<T extends { start: number; end: number }>(items: T[], axis: Axis, min = 44, gap = 4): (T & { top: number; height: number })[] {
  let floor = -Infinity;
  return [...items].sort((a, b) => a.start - b.start || a.end - b.end).map(item => {
    const top = Math.max(axis.y(item.start), floor);
    const height = Math.max(min, (item.end - item.start) * axis.pxPerMin);
    floor = top + height + gap;
    return { ...item, top, height };
  });
}
