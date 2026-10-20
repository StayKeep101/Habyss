import { emit } from './appEvents';

/**
 * Several goals to set up, one after another: each opens the goal sheet with
 * its words filled in, and closing that sheet (saved or not) opens the next.
 * A goal needs its target and dates chosen, so it cannot be made in bulk the
 * way a task can.
 */
let queue: string[] = [];
const GAP_MS = 450;

export function queueGoals(texts: string[], delay = GAP_MS) {
    queue = texts.filter(text => text.trim());
    openNextGoal(delay);
}

/** Opens the next queued goal; false when there is none left. */
export function openNextGoal(delay = GAP_MS): boolean {
    const next = queue.shift();
    if (next === undefined) return false;
    setTimeout(() => emit('show_goal_quick_add', { prefill: next }), delay);
    return true;
}

export const goalsWaiting = () => queue.length;
