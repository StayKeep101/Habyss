import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The day as one number out of 100: what got done, and how efficiently.
 *
 *   completion  = done / what the day asked for
 *   efficiency  = Σ expected minutes / Σ actual minutes, over the done things
 *                 that were measured (lib/learnedLength.ts), held to 0.5–1.5
 *   score       = 100 × completion × (0.7 + 0.3 × (efficiency − 0.5))
 *
 * So everything done exactly as long as it usually takes is 85; the same day
 * done faster climbs to 100, done slower drops toward 70. Someone who did
 * everything but took longer scores lower than someone who did everything
 * faster than planned.
 *
 * "Expected" is how long it has really been taking you (the learnt length),
 * falling back to the plan only while there is nothing learnt: planning an
 * hour for a 20-minute thing does not buy points. Things that are a length of
 * time ("read 30 minutes") are not part of efficiency: running them faster is
 * not possible, and running them longer is not worse.
 */

export interface ScoreItem {
    id: string;
    title: string;
    kind: 'habit' | 'task';
    done: boolean;
    /** Minutes it usually takes (learnt), else planned. */
    expected: number;
    /** Minutes it took today, when measured. */
    actual: number | null;
    /** A length of time, not a thing to finish: never counts for efficiency. */
    timed?: boolean;
}

export interface DayScore {
    score: number;
    completion: number;
    /** 1 is as expected; above is faster. Null when nothing was measured. */
    efficiency: number | null;
    done: number;
    total: number;
    /** Done things that ran ten minutes or more over what they usually take, biggest first. */
    over: { id: string; title: string; kind: 'habit' | 'task'; extra: number }[];
    /** Done things that took ten minutes or more less, biggest first. */
    under: { id: string; title: string; kind: 'habit' | 'task'; saved: number }[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function scoreDay(items: ScoreItem[]): DayScore {
    const total = items.length;
    const doneItems = items.filter(item => item.done);
    const completion = total ? doneItems.length / total : 0;
    const measured = doneItems.filter(item => !item.timed && item.actual != null && item.actual > 0 && item.expected > 0);
    const expected = measured.reduce((sum, item) => sum + item.expected, 0);
    const actual = measured.reduce((sum, item) => sum + (item.actual as number), 0);
    const efficiency = measured.length && actual > 0 ? expected / actual : null;
    const factor = 0.7 + 0.3 * (clamp(efficiency ?? 1, 0.5, 1.5) - 0.5);
    const score = total ? Math.round(100 * completion * factor) : 0;
    const over = measured
        .map(item => ({ id: item.id, title: item.title, kind: item.kind, extra: Math.round((item.actual as number) - item.expected) }))
        .filter(item => item.extra >= 10)
        .sort((a, b) => b.extra - a.extra);
    const under = measured
        .map(item => ({ id: item.id, title: item.title, kind: item.kind, saved: Math.round(item.expected - (item.actual as number)) }))
        .filter(item => item.saved >= 10)
        .sort((a, b) => b.saved - a.saved);
    return { score, completion, efficiency, done: doneItems.length, total, over, under };
}

/** Share of earlier days (0–1) that scored below this one, or null with fewer than five to compare. */
export function rankAmong(score: number, earlier: number[]): number | null {
    if (earlier.length < 5) return null;
    return earlier.filter(value => value < score).length / earlier.length;
}

/* ------------------------------------------------------------------ store */

const KEY = 'habyss_day_scores';
const KEEP_DAYS = 90;
let scores: Record<string, number> = {};
let loaded = false;

export async function loadScores(): Promise<Record<string, number>> {
    if (loaded) return scores;
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
        if (raw && typeof raw === 'object') scores = raw;
    } catch { /* none yet */ }
    loaded = true;
    return scores;
}

/** Today's score, kept (rewritten as the day goes on); the last 90 days stay. */
export async function keepScore(day: string, score: number): Promise<void> {
    await loadScores();
    if (scores[day] === score) return;
    const days = Object.keys({ ...scores, [day]: score }).sort().slice(-KEEP_DAYS);
    const next: Record<string, number> = {};
    for (const key of days) next[key] = key === day ? score : scores[key];
    scores = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(scores)).catch(() => undefined);
}

/** Scores of the 30 days before `day`. */
export function earlierScores(all: Record<string, number>, day: string): number[] {
    return Object.keys(all).filter(key => key < day).sort().slice(-30).map(key => all[key]);
}

export function resetScoresForTests() { scores = {}; loaded = false; }
