/** One minute → pixels scale for both timelines, so the planned and tracked sides line up hour for hour (the phone's rule:
 * one scale for items and the gaps between them, so an hour is always twice as tall as half an hour). */
export interface Axis { from: number; to: number; pxPerMin: number; height: number; y(minute: number): number; minuteAt(y: number): number }
export function makeAxis(wake: number, sleep: number, pxPerMin = 1.6): Axis {
  const from = Math.max(0, Math.min(wake, sleep - 60)), to = Math.max(sleep, from + 60);
  return { from, to, pxPerMin, height: (to - from) * pxPerMin, y: m => (m - from) * pxPerMin, minuteAt: y => from + y / pxPerMin };
}
/** Hour marks inside the axis, as minutes. */
export const hourMarks = (axis: Axis): number[] => { const out: number[] = []; for (let m = Math.ceil(axis.from / 60) * 60; m <= axis.to; m += 60) out.push(m); return out; };
