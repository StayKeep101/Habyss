import { MARKS } from './marks';

/**
 * The Marks orbs: when something earns Marks, one little orb per Mark flies
 * from where you tapped to your Marks, so you see them land.
 *
 * Three small pieces of state, kept outside React:
 * - where the last touch was (the root view notes every touch), which is
 *   where the orbs leave from;
 * - where the Marks counter is on screen right now, registered by whichever
 *   screen shows it while that screen is in front (Home's Marks bar); with
 *   none registered the orbs fly to a small Marks pill that appears for them;
 * - who is listening for a burst (the overlay that draws the orbs).
 */

export interface Point { x: number; y: number }
export interface Burst { id: number; count: number; marks: number; from: Point }
type Measure = (done: (target: Point | null) => void) => void;

/** The most orbs drawn for one burst; a goal's fifty would be a blizzard. */
export const MAX_ORBS = 24;

let lastTouch: Point | null = null;
let target: { owner: string; measure: Measure } | null = null;
let nextId = 1;
const listeners = new Set<(burst: Burst) => void>();
const landers = new Set<() => void>();

export const noteTouch = (x: number, y: number) => { lastTouch = { x, y }; };
export const lastTouchPoint = (): Point | null => lastTouch;

/** A screen showing your Marks says where they are while it is in front. */
export function registerMarksTarget(owner: string, measure: Measure): () => void {
    target = { owner, measure };
    return () => { if (target?.owner === owner) target = null; };
}
export function measureMarksTarget(done: (point: Point | null) => void) {
    if (!target) { done(null); return; }
    target.measure(done);
}

export function onMarksBurst(listener: (burst: Burst) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
/** Each orb that lands, so the counter can give a little bump. */
export function onOrbLanded(listener: () => void): () => void {
    landers.add(listener);
    return () => { landers.delete(listener); };
}
export const orbLanded = () => landers.forEach(listener => listener());

/** Sends `marks` Marks' worth of orbs from the last touch (or `from`). */
export function burstMarks(marks: number, from?: Point | null): Burst | null {
    if (marks <= 0) return null;
    const burst: Burst = { id: nextId++, count: orbCount(marks), marks, from: from ?? lastTouch ?? { x: 0, y: 0 } };
    listeners.forEach(listener => listener(burst));
    return burst;
}

/** One orb per Mark, up to the cap. */
export const orbCount = (marks: number) => Math.max(1, Math.min(MAX_ORBS, Math.round(marks)));

/**
 * Which completions have already sent orbs, so a timed or counted habit that
 * keeps being added to after reaching its target bursts once, and undoing and
 * redoing it bursts again (it earns again).
 */
const burst = new Set<string>();
export function habitDone(habitId: string, date: string, completed: boolean): number {
    const key = `${habitId}:${date}`;
    if (!completed) { burst.delete(key); return 0; }
    if (burst.has(key)) return 0;
    burst.add(key);
    return MARKS.complete.habit;
}
export const taskDone = () => MARKS.complete.task;
export const goalDone = () => MARKS.complete.goal;

/**
 * Your Marks total as last shown (Home's Marks bar reports it), so the pill
 * that catches orbs where no counter is on screen can count your real total
 * up by what was just earned.
 *
 * The data can update just before the orbs leave or just after, so a burst
 * reads the total as it was before the earning: a change seen moments ago
 * that nothing has claimed yet is taken to be this earning. Each burst claims
 * what it counts, and counts on from there, so several in a row add up.
 */
let total: number | null = null;
let before: number | null = null;
let changedAt = 0;
let claimed = true;
/** A change this recent, not yet counted by a burst, is the one being earned. */
const FRESH_MS = 1500;

export function noteMarksTotal(value: number, at = Date.now()) {
    if (value === total) return;
    before = total;
    total = value;
    changedAt = at;
    claimed = false;
}

/** From and to, for counting the total up by `marks`; null before Home has said what it is. */
export function marksRange(marks: number, at = Date.now()): { from: number; to: number } | null {
    if (total === null) return null;
    const fresh = !claimed && before !== null && at - changedAt < FRESH_MS && total - before >= marks;
    const from = fresh ? total - marks : total;
    const to = from + marks;
    if (!fresh) noteMarksTotal(to, at);
    claimed = true;
    return { from, to };
}

/** For tests. */
export const resetMarksOrbs = () => {
    burst.clear(); lastTouch = null; target = null;
    total = null; before = null; changedAt = 0; claimed = true;
};
