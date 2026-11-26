/**
 * What a habit is doing right now, decided in one place.
 *
 * The Roadmap card and the habit's own page used to work this out each in
 * their own way: the card offered "Focus now" on a habit that was already
 * finished, and showed a timer whenever the habit was the timer's last one,
 * while the habit page went by whether the timer was actually running. One
 * habit, two answers. Every screen now asks this function.
 *
 * Order matters:
 *   1. A session running or paused for this habit is what is happening.
 *   2. Otherwise, done is done — nothing offers to start it again.
 *   3. Then skipped, then "focus now" inside its time window, then open.
 */
export type HabitStatus = 'focusing' | 'paused' | 'done' | 'skipped' | 'focus-now' | 'open';

export interface FocusState {
    activeHabitId: string | null;
    isRunning: boolean;
    isPaused: boolean;
}

export function habitStatus(input: {
    habitId: string;
    /** From the shared check-ins (lib/dataStore.ts), or the habit's saved amount reaching its target. */
    done: boolean;
    skipped?: boolean;
    focus: FocusState;
    /** Inside its scheduled window today. */
    focusWindowOpen?: boolean;
}): HabitStatus {
    const { habitId, done, skipped, focus, focusWindowOpen } = input;
    const mine = focus.activeHabitId === habitId;
    if (mine && focus.isRunning) return 'focusing';
    if (mine && focus.isPaused) return 'paused';
    if (done) return 'done';
    if (skipped) return 'skipped';
    if (focusWindowOpen) return 'focus-now';
    return 'open';
}

/** A session is live for this habit: running or paused. */
export const isLive = (status: HabitStatus) => status === 'focusing' || status === 'paused';
