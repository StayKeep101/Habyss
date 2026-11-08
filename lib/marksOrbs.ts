import { MARKS, MARKS_LIMITS } from './marks';

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
/** Marks fly as round lights; Shards, the currency, as small gems to your wallet. */
export type OrbKind = 'marks' | 'shards';
export interface Burst { id: number; kind: OrbKind; count: number; marks: number; from: Point }
type Measure = (done: (target: Point | null) => void) => void;

/** The most orbs drawn for one burst; a goal's fifty would be a blizzard. */
export const MAX_ORBS = 24;

let lastTouch: Point | null = null;
const targets: Record<OrbKind, { owner: string; measure: Measure } | null> = { marks: null, shards: null };
let nextId = 1;
let rewardActionAt = 0;
export const recentRewardAction = () => rewardActionAt > 0 && Date.now() - rewardActionAt < 3000;
const listeners = new Set<(burst: Burst) => void>();
const landers: Record<OrbKind, Set<() => void>> = { marks: new Set(), shards: new Set() };

export const noteTouch = (x: number, y: number) => { lastTouch = { x, y }; };
export const lastTouchPoint = (): Point | null => lastTouch;

/** A screen showing your Marks says where they are while it is in front. */
export function registerMarksTarget(owner: string, measure: Measure, kind: OrbKind = 'marks'): () => void {
    targets[kind] = { owner, measure };
    return () => { if (targets[kind]?.owner === owner) targets[kind] = null; };
}
/** Where your Shards balance is on screen (Home's wallet card), while it is in front. */
export const registerShardsTarget = (owner: string, measure: Measure) => registerMarksTarget(owner, measure, 'shards');
export function measureMarksTarget(done: (point: Point | null) => void, kind: OrbKind = 'marks') {
    const found = targets[kind];
    if (!found) { done(null); return; }
    found.measure(done);
}

export function onMarksBurst(listener: (burst: Burst) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
/** Each orb that lands, so the counter can give a little bump. */
export function onOrbLanded(listener: () => void, kind: OrbKind = 'marks'): () => void {
    landers[kind].add(listener);
    return () => { landers[kind].delete(listener); };
}
export const orbLanded = (kind: OrbKind = 'marks') => landers[kind].forEach(listener => listener());

/** Sends `marks` Marks' worth of orbs from the last touch (or `from`). */
export function burstMarks(marks: number, from?: Point | null): Burst | null {
    if (marks <= 0) return null;
    rewardActionAt = Date.now();
    const burst: Burst = { id: nextId++, kind: 'marks', count: orbCount(marks), marks, from: from ?? lastTouch ?? { x: 0, y: 0 } };
    listeners.forEach(listener => listener(burst));
    return burst;
}

/** Sends `shards` Shards' worth of gems from the last touch, a beat after the Marks leave. */
export function burstShards(shards: number, from?: Point | null): Burst | null {
    if (shards <= 0) return null;
    const burst: Burst = { id: nextId++, kind: 'shards', count: orbCount(shards), marks: shards, from: from ?? lastTouch ?? { x: 0, y: 0 } };
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
    if (!completed) { burst.delete(key); takeBack(MARKS.complete.habit); return 0; }
    if (burst.has(key)) return 0;
    burst.add(key);
    // Past the day's full habits each tick earns one (MARKS_LIMITS, lib/marks.ts).
    const kept = [...burst].filter(entry => entry.endsWith(`:${date}`)).length;
    return kept > MARKS_LIMITS.fullHabitsPerDay ? MARKS_LIMITS.extraHabit : MARKS.complete.habit;
}
export const taskDone = () => MARKS.complete.task;
/** The same for a task: one burst per finish, again after it is reopened. */
const tasksBurst = new Set<string>();
export function taskEarned(taskId: string, date: string, completed: boolean): number {
    const key = `${taskId}:${date}`;
    if (!completed) { tasksBurst.delete(key); takeBack(MARKS.complete.task); return 0; }
    if (tasksBurst.has(key)) return 0;
    tasksBurst.add(key);
    return MARKS.complete.task;
}
export const goalDone = () => MARKS.complete.goal;
export const milestoneDone = () => MARKS.complete.milestone;

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

/**
 * Unticked: what it earned leaves the total shown too. Home reports the real
 * total only while it is on screen (tabs you are not on do not re-render), so
 * without this the pill on the timeline counted +5 for every tick and never
 * took it back, and ticking and unticking looked like endless Marks. The real
 * total (lib/marks.ts) was never affected; this keeps what is shown honest,
 * and Home's next report corrects any rounding (the day's multiplier).
 */
function takeBack(marks: number) {
    if (total === null) return;
    total = Math.max(0, total - marks);
    before = null;
    claimed = true;
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
    burst.clear(); tasksBurst.clear(); rewardActionAt = 0; lastTouch = null; targets.marks = null; targets.shards = null;
    total = null; before = null; changedAt = 0; claimed = true;
};
