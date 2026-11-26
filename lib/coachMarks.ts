/**
 * The first-run tour: real controls on screen (the + button, a tab, the
 * streak) register how to measure themselves, so the tour can light up
 * exactly where each one is, on any phone (components/ui/CoachMarks).
 *
 * It runs in order across screens: Home's cards, then making a first habit
 * yourself (+, Habit), then Roadmap, then friends. A step the
 * person does themselves waits for it to happen (`waitFor`); a step whose
 * control has gone (the sheet was closed) goes back to the step that brings
 * it up (`back`).
 */
export type Rect = { x: number; y: number; width: number; height: number };
type Measure = () => Promise<Rect | null>;

const targets = new Map<string, Measure>();

export function registerTarget(id: string, measure: Measure): () => void {
    targets.set(id, measure);
    return () => { if (targets.get(id) === measure) targets.delete(id); };
}

export async function measureTarget(id: string): Promise<Rect | null> {
    const measure = targets.get(id);
    if (!measure) return null;
    try { return await measure(); } catch { return null; }
}

/** One step: what to light up and what to say about it. */
export interface CoachStep {
    target: string;
    title: string;
    body: string;
    /** The person does it: the step moves on when this app event comes (with this value, if given). */
    waitFor?: { event: string; value?: string };
    /** The control keeps working during the step (typing, picking a kind); otherwise tapping it goes on. */
    live?: boolean;
    /** If the control is gone, the step to go back to (by target). */
    back?: string;
    /** An app event sent as the step starts, so a screen can show what the step is about. */
    announce?: string;
}

export const FIRST_RUN: CoachStep[] = [
    { target: 'today-focus', title: 'Today’s focus', body: 'The few things that would make today count. Tick them off here as you go.' },
    { target: 'streak', title: 'Your streak', body: 'Days in a row you kept. Do one habit or task a day and it grows.' },
    { target: 'focus-today', title: 'Focus today', body: 'Time you spent focused today, with this week under it. Tap it for the full picture.' },
    { target: 'missed', title: 'Missed', body: 'What slipped by. Tap it to pick things back up or let them go.' },
    { target: 'plus', title: 'Make your first habit', body: 'Tap + to start.', waitFor: { event: 'show_creation_modal' } },
    { target: 'create-habit', title: 'Choose Habit', body: 'Something you do again and again. Tasks are the one-off things.', waitFor: { event: 'show_quick_add' }, back: 'plus' },
    { target: 'tab-roadmap', title: 'Now open Roadmap', body: 'Your day lives here, in the order you will do it.', waitFor: { event: 'tab_selected', value: 'roadmap' } },
    { target: 'tab-community', title: 'Better with friends', body: 'Tap Community.', waitFor: { event: 'tab_selected', value: 'community' } },
    { target: 'add-friend', title: 'Add a friend', body: 'Share habits, cheer each other on and keep streaks together. That’s it, you’re ready.' },
];

/** Where a missing control sends the tour: back to the step that brings it up, else on to the next. */
export function stepAfterMissing(steps: CoachStep[], index: number): number {
    const back = steps[index]?.back;
    const to = back ? steps.findIndex(step => step.target === back) : -1;
    return to >= 0 && to < index ? to : index + 1;
}

// The tour's state, shared by every layer that can draw it.
type Tour = { active: boolean; index: number };
let tour: Tour = { active: false, index: 0 };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const getTour = () => tour;
export function subscribeTour(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export function startTour() { tour = { active: true, index: 0 }; notify(); }
export function goToStep(index: number) {
    tour = index >= FIRST_RUN.length ? { active: false, index: 0 } : { active: true, index: Math.max(0, index) };
    notify();
}
export function endTour() { tour = { active: false, index: 0 }; notify(); }

/**
 * Which layer draws the tour: the newest one mounted. The app's own layer
 * sits over every screen; a sheet in its own native modal (a creation sheet)
 * has one inside it, so the tour can light up what is in the sheet.
 */
let layers: number[] = [];
let nextLayer = 1;
export function claimLayer(): { id: number; release: () => void } {
    const id = nextLayer++;
    layers = [...layers, id];
    notify();
    return { id, release: () => { layers = layers.filter(layer => layer !== id); notify(); } };
}
export const topLayer = () => layers[layers.length - 1];
