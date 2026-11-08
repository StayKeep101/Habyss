import type { DayScore } from './dayScore';

/**
 * Echo's look back at the day, shown beside the day's card in the evening:
 * the score, how it sits among your own days, what ran over, what Echo
 * changed for next time, and the one thing to do better tomorrow.
 *
 * At most three lines and one "tomorrow"; numbers, not paragraphs. Pure.
 */

export interface Adaptation { id: string; title: string; from: number; to: number }

export interface DayReview {
    score: number;
    /** Share (0–1) of your last 30 days this one beat, or null with too few. */
    rank: number | null;
    /** What happened, one short line each. */
    lines: string[];
    /** The one thing to do better tomorrow. */
    tomorrow: string;
}

const minutes = (value: number) => (value >= 60 && value % 60 === 0 ? `${value / 60} h` : value > 60 ? `${Math.floor(value / 60)} h ${value % 60}` : `${value} min`);

export function buildDayReview(input: {
    score: DayScore;
    rank: number | null;
    adapted: Adaptation[];
    /** What is still open, in timeline order. */
    left: string[];
    /** Your best stretch of the day (lib/energyCurve.ts), e.g. "9–12". */
    bestHours?: string | null;
    voice?: string;
}): DayReview {
    const { score, adapted, left } = input;
    const funny = !!input.voice && input.voice !== 'normal';
    const lines: string[] = [];
    const adaptedIds = new Set(adapted.map(item => item.id));
    for (const item of score.over.slice(0, 2)) {
        const change = adapted.find(other => other.id === item.id);
        lines.push(change
            ? `${item.title} took ${minutes(item.extra)} extra. Next time it gets ${minutes(change.to)}.`
            : `${item.title} took ${minutes(item.extra)} extra.`);
    }
    for (const item of adapted.filter(item => !score.over.some(over => over.id === item.id)).slice(0, Math.max(0, 3 - lines.length))) {
        lines.push(item.to < item.from
            ? `${item.title} takes you ${minutes(item.to)}, not ${minutes(item.from)}. Changed for next time.`
            : `${item.title} takes you ${minutes(item.to)}. Changed for next time.`);
    }
    const quick = score.under.find(item => !adaptedIds.has(item.id));
    if (lines.length < 3 && quick) lines.push(`${quick.title}: ${minutes(quick.saved)} faster than usual.`);

    let tomorrow: string;
    const task = score.over.find(item => item.kind === 'task' && !adaptedIds.has(item.id));
    if (left.length) {
        const first = left[0];
        tomorrow = input.bestHours
            ? `${left.length} left. Put ${first} in your best hours, ${input.bestHours}.`
            : `${left.length} left. Start ${first} first tomorrow.`;
    } else if (task) {
        tomorrow = `Give tasks like ${task.title} more room: it ran ${minutes(task.extra)} over.`;
    } else if (score.efficiency !== null && score.efficiency < 0.95) {
        tomorrow = 'Everything done, but slower than usual. Start each thing on time and the score climbs.';
    } else if (score.efficiency !== null && score.efficiency > 1.1) {
        tomorrow = funny ? 'Faster than planned. Tomorrow can carry one more thing. Show-off.' : 'Faster than planned. Tomorrow can carry one more thing.';
    } else {
        tomorrow = funny ? 'Clean day. Do it again, I dare you.' : 'Clean day. Same again tomorrow.';
    }
    return { score: score.score, rank: input.rank, lines: lines.slice(0, 3), tomorrow };
}
