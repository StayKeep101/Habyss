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

/** For tests. */
export const resetMarksOrbs = () => { burst.clear(); lastTouch = null; target = null; };
