import type { CheckIn } from './checkIns';
import type { FocusRecord } from './focusStats';

/**
 * Your energy through the day, learnt hour by hour, so hard things go where
 * you are actually at your best — and the picture sharpens the more you
 * answer, and follows you when your days change.
 *
 * Each signal lands on the hour it happened:
 * - an energy answer (1–5), at full weight;
 * - a mood answer, at a third of that (mood follows the day more than the hour);
 * - a focus session: finished counts as a 4, stopped early as a 2, at half weight.
 *
 * Then, per hour:
 * 1. Recent counts more: a signal's weight halves every 21 days, so a change
 *    in routine shows within a few weeks and old habits fade out.
 * 2. Neighbouring hours share: each signal also counts for the hours around
 *    it (a bell curve, σ = 1.5 h), so 9:00 and 10:00 answers both speak for 9:30.
 * 3. Few signals stay modest: each hour is pulled toward your overall average
 *    by two signals' worth of it (`(Σ weight·value + 2·average) / (Σ weight + 2)`),
 *    so one great morning is not a "morning person".
 *
 * Your best hours are the three-hour stretch between waking and bedtime with
 * the highest score — named only once there is enough behind it (signals
 * worth six full answers, spread over three hours of the day or more) and it
 * stands out (0.3 above the weakest stretch). Until then, null.
 */
export interface EnergyCurve {
    /** 0–23: the learnt score (1–5), or null for an hour with nothing near it. */
    hours: (number | null)[];
    /** 0–1: how much is behind it (1 = signals worth 20 recent full answers). */
    confidence: number;
    /** The best three hours, in minutes from midnight, or null until it is clear. */
    peak: { start: number; end: number } | null;
}

const HALF_LIFE_DAYS = 21;
const WINDOW_DAYS = 90;
const SIGMA = 1.5;
const PRIOR = 2;
const PEAK_HOURS = 3;
const MIN_WEIGHT = 6;
const MIN_HOURS = 3;
const MIN_LIFT = 0.3;

interface Signal { hour: number; value: number; weight: number }

export function energyCurve(input: {
    checkIns: CheckIn[];
    focus?: FocusRecord[];
    now: Date;
    /** Waking and bedtime in minutes from midnight; the peak is looked for between them. */
    wake?: number;
    sleep?: number;
}): EnergyCurve {
    const now = input.now.getTime();
    const age = (iso: string) => (now - new Date(iso).getTime()) / 86400000;
    const recency = (days: number) => Math.pow(0.5, days / HALF_LIFE_DAYS);
    const signals: Signal[] = [];
    for (const entry of input.checkIns) {
        const days = age(entry.at);
        if (days < 0 || days > WINDOW_DAYS) continue;
        signals.push({ hour: new Date(entry.at).getHours(), value: entry.value, weight: recency(days) * (entry.kind === 'energy' ? 1 : 1 / 3) });
    }
    for (const session of input.focus ?? []) {
        const days = age(session.startedAt);
        if (days < 0 || days > WINDOW_DAYS || session.seconds < 300) continue;
        signals.push({ hour: new Date(session.startedAt).getHours(), value: session.completed ? 4 : 2, weight: recency(days) * 0.5 });
    }
    const total = signals.reduce((sum, signal) => sum + signal.weight, 0);
    if (!total) return { hours: Array(24).fill(null), confidence: 0, peak: null };
    const average = signals.reduce((sum, signal) => sum + signal.weight * signal.value, 0) / total;

    const sums = Array(24).fill(0) as number[];
    const weights = Array(24).fill(0) as number[];
    for (const signal of signals) {
        for (let hour = 0; hour < 24; hour++) {
            const distance = Math.min(Math.abs(hour - signal.hour), 24 - Math.abs(hour - signal.hour));
            if (distance > 4) continue;
            const share = signal.weight * Math.exp(-(distance * distance) / (2 * SIGMA * SIGMA));
            sums[hour] += share * signal.value;
            weights[hour] += share;
        }
    }
    const hours = sums.map((sum, hour) => weights[hour] > 0.05 ? Math.round(((sum + PRIOR * average) / (weights[hour] + PRIOR)) * 100) / 100 : null);
    const confidence = Math.min(1, total / 20);

    const covered = new Set(signals.map(signal => signal.hour)).size;
    if (total < MIN_WEIGHT || covered < MIN_HOURS) return { hours, confidence, peak: null };
    const first = Math.ceil((input.wake ?? 7 * 60) / 60);
    const last = Math.floor((input.sleep ?? 23 * 60) / 60) - PEAK_HOURS;
    const stretches: { start: number; score: number }[] = [];
    for (let start = first; start <= last; start++) {
        const values = hours.slice(start, start + PEAK_HOURS).filter((value): value is number => value !== null);
        if (values.length === PEAK_HOURS) stretches.push({ start, score: values.reduce((a, b) => a + b, 0) / PEAK_HOURS });
    }
    if (stretches.length < 2) return { hours, confidence, peak: null };
    const best = stretches.reduce((a, b) => (b.score > a.score ? b : a));
    const worst = stretches.reduce((a, b) => (b.score < a.score ? b : a));
    if (best.score - worst.score < MIN_LIFT) return { hours, confidence, peak: null };
    return { hours, confidence, peak: { start: best.start * 60, end: (best.start + PEAK_HOURS) * 60 } };
}
