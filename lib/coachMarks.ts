/**
 * The first-run walkthrough's targets: real controls on screen (the + button,
 * a tab, the streak) register how to measure themselves, so the walkthrough
 * can light up exactly where each one is, on any phone (components/ui/CoachMarks).
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
export interface CoachStep { target: string; title: string; body: string }

export const FIRST_RUN: CoachStep[] = [
    { target: 'plus', title: 'Add anything', body: 'Tap + to add a habit, a task or a goal. Hold it to just say it.' },
    { target: 'tab-roadmap', title: 'Your day, planned', body: 'The timeline fits everything into your day and moves it as the day goes.' },
    { target: 'streak', title: 'Keep the streak', body: 'Do one thing a day, a habit or a task, and it grows.' },
    { target: 'tab-settings', title: 'Make it yours', body: 'Echo, focus, reminders and your account are here.' },
];
