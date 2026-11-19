import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * How long things really take you, learnt from what happened, so the plan is
 * about the outcome and not the clock: one person finishes "Clean the
 * kitchen" in 20 minutes, another in 50, and each one's day is laid out for
 * them.
 *
 * One sample per habit or task per day, the first answer that holds:
 *   1. Minutes focused on it that day (lib/focusStats.ts), when there was a
 *      session: the most exact measure there is.
 *   2. Otherwise from the timeline: from where it was planned to start
 *      (lib/dayMemory.ts `planned`) to the minute it was ticked. Only when
 *      that lands between a quarter of and three times its planned length:
 *      ticked hours later because you forgot is not how long it took.
 *
 * The learnt length (`learnedMinutes`):
 *   - recent counts more: a sample's weight halves every 21 days;
 *   - the weighted median, so one bad day does not move it;
 *   - pulled toward the planned length by two samples' worth of it, so three
 *     quick days do not halve a habit;
 *   - rounded to 5 minutes, and nothing at all below three samples.
 *
 * Pure apart from the small store at the bottom; tested without a phone.
 */

export interface LengthSample {
    /** Local day (YYYY-MM-DD). */
    day: string;
    /** How long it took. */
    minutes: number;
    /** What it was planned to take that day. */
    planned: number;
    source: 'focus' | 'timeline';
}

export const MIN_SAMPLES = 3;
const HALF_LIFE_DAYS = 21;
const PRIOR_WEIGHT = 2;
const KEEP = 12;

const daysBetween = (from: string, to: string) =>
    Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000);

/** One day's sample for one item, or null when the day says nothing reliable. */
export function sampleFor(input: {
    day: string;
    /** Planned slot that day, minutes from midnight. */
    planned?: { start: number; end: number } | null;
    /** When it was ticked, minutes from midnight. */
    doneAt?: number | null;
    /** Seconds focused on it that day. */
    focusSeconds?: number;
}): LengthSample | null {
    const plannedLength = input.planned ? input.planned.end - input.planned.start : 0;
    const focused = Math.round((input.focusSeconds ?? 0) / 60);
    if (focused >= 5) return { day: input.day, minutes: focused, planned: plannedLength || focused, source: 'focus' };
    if (!input.planned || plannedLength <= 0 || input.doneAt == null) return null;
    const took = input.doneAt - input.planned.start;
    if (took < plannedLength * 0.25 || took > plannedLength * 3) return null;
    return { day: input.day, minutes: Math.round(took), planned: plannedLength, source: 'timeline' };
}

/** The learnt length, in minutes, or null with too little to go on. */
export function learnedMinutes(samples: LengthSample[], planned: number, today: string): number | null {
    if (samples.length < MIN_SAMPLES || planned <= 0) return null;
    const weighted = samples
        .map(sample => ({ minutes: sample.minutes, weight: Math.pow(0.5, Math.max(0, daysBetween(sample.day, today)) / HALF_LIFE_DAYS) }))
        .sort((a, b) => a.minutes - b.minutes);
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let run = 0;
    let median = weighted[weighted.length - 1].minutes;
    for (const item of weighted) {
        run += item.weight;
        if (run >= total / 2) { median = item.minutes; break; }
    }
    const pulled = (total * median + PRIOR_WEIGHT * planned) / (total + PRIOR_WEIGHT);
    return Math.max(5, Math.round(pulled / 5) * 5);
}

/**
 * Whether the learnt length is far enough from the plan to change the plan:
 * ten minutes or more, and at least 15% of it. Smaller is the day breathing.
 */
export function worthAdapting(planned: number, learned: number | null): learned is number {
    if (learned === null || planned <= 0) return false;
    const gap = Math.abs(learned - planned);
    return gap >= 10 && gap >= planned * 0.15;
}

/** A sample added for its day, replacing that day's earlier one, newest kept. */
export function addSample(list: LengthSample[], sample: LengthSample): LengthSample[] {
    return [...list.filter(item => item.day !== sample.day), sample]
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-KEEP);
}

/* ------------------------------------------------------------------ store */

const KEY = 'habyss_learned_lengths';
let state: Record<string, LengthSample[]> = {};
let loaded = false;

export async function loadSamples(): Promise<Record<string, LengthSample[]>> {
    if (loaded) return state;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        if (raw && typeof raw === 'object') state = raw;
    } catch { /* none yet */ }
    loaded = true;
    return state;
}

export const samplesOf = (id: string): LengthSample[] => state[id] ?? [];

export async function recordSamples(samples: Record<string, LengthSample>): Promise<void> {
    await loadSamples();
    const ids = Object.keys(samples);
    if (!ids.length) return;
    const next = { ...state };
    for (const id of ids) next[id] = addSample(next[id] ?? [], samples[id]);
    state = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}

/** Forgets what was learnt for one item (its change was taken back). */
export async function clearSamples(id: string): Promise<void> {
    await loadSamples();
    if (!state[id]) return;
    const next = { ...state };
    delete next[id];
    state = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
}

export function resetLearnedLengthsForTests() { state = {}; loaded = false; }

/**
 * Planned against how long it really takes, said only when the gap is real
 * (worthAdapting): "Planned 30 min · takes you 45 min". Calibration is the
 * point of measuring it (planning fallacy); a silent fix teaches nothing. Pure.
 */
export function lengthLine(planned: number, learned: number | null, label: (minutes: number) => string): string | null {
    if (!worthAdapting(planned, learned)) return null;
    return `Planned ${label(planned)} · takes you ${label(learned)}`;
}
