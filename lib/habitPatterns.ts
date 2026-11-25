import { twoProportionZ } from './behaviorPatterns';
import type { Pattern } from './echoPatterns';
import { SOURCE_WORDS, sourceShares, type TickSource } from './tickSource';

/**
 * One habit's patterns, for its own page: the layer under the streak and the
 * heat map that says *how* this habit goes, not just how often.
 *
 *  weekday  the day of the week it is hardest (or easiest) to keep
 *  time     when it usually gets done, and the hour after which it rarely does
 *  miss     what one miss does to the next due day ("never miss twice", measured)
 *  source   how it is kept: by hand, by its timer, by Health…
 *
 * plus whatever Echo's app-wide read (lib/behaviorPatterns.ts,
 * lib/echoPatterns.ts) found about this habit in particular: what it goes
 * with, whether it is rising or slipping, whether it is at risk today.
 *
 * The same floors as Echo: a comparison is only said when it passes a
 * two-proportion test (|z| ≥ 1.96) on enough days, so nothing is claimed on a
 * handful of days or a coin-flip gap. Pure.
 */
export type HabitPattern = Pick<Pattern, 'id' | 'text' | 'evidence'>;

export interface HabitPatternInput {
    habitId: string;
    /** The habit's days, oldest first: whether each was due, done, skipped. */
    days: { date: string; scheduled: boolean; completed: boolean; skipped: boolean }[];
    /** When it was ticked, for ticks made on the day they count for. */
    ticks: { date: string; at: string }[];
    /** What logged each check-in, by date. */
    sources: Record<string, TickSource>;
    /** Echo's app-wide patterns; the ones about this habit are kept. */
    global?: Pattern[];
    today: string;
}

const WINDOW = 90;
const Z95 = 1.96;
const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
/** Echo's kinds that can be about one habit (its id is in the pattern's id). */
const ABOUT_ONE = new Set(['chain', 'relapse', 'trend', 'keystone', 'mood_habit', 'risk_today']);

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const weekdayOf = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day, 12).getDay();
};
const hourOf = (at: string) => { const date = new Date(at); return date.getHours() + date.getMinutes() / 60; };
export const hourLabel = (hour: number) => {
    const whole = ((Math.round(hour) % 24) + 24) % 24;
    if (whole === 0) return 'midnight';
    if (whole === 12) return 'noon';
    return whole < 12 ? `${whole} am` : `${whole - 12} pm`;
};

export function habitPatterns(input: HabitPatternInput): HabitPattern[] {
    const { habitId, today } = input;
    const recent = input.days.filter(day => day.date < today).slice(-WINDOW);
    // Due and decided: kept or missed. A skip is neither.
    const due = recent.filter(day => day.scheduled && !day.skipped);
    const out: HabitPattern[] = [];

    // -------------------------------------------------------------- weekday
    const byDay = Array.from({ length: 7 }, () => ({ hit: 0, n: 0 }));
    for (const day of due) {
        const slot = byDay[weekdayOf(day.date)];
        slot.n++;
        if (day.completed) slot.hit++;
    }
    const total = { hit: due.filter(day => day.completed).length, n: due.length };
    let weekday: { pattern: HabitPattern; gap: number } | null = null;
    for (let dow = 0; dow < 7; dow++) {
        const slot = byDay[dow];
        const rest = { hit: total.hit - slot.hit, n: total.n - slot.n };
        if (slot.n < 4 || rest.n < 8) continue;
        const z = twoProportionZ(slot, rest);
        if (Math.abs(z) < Z95) continue;
        const mine = pct(slot.hit, slot.n);
        const others = pct(rest.hit, rest.n);
        const gap = Math.abs(mine - others);
        if (weekday && weekday.gap >= gap) continue;
        weekday = {
            gap,
            pattern: {
                id: `weekday:${dow}`,
                text: z < 0
                    ? `${WEEKDAY_NAMES[dow]} are the hard ones: ${mine}% kept, against ${others}% on other days.`
                    : `${WEEKDAY_NAMES[dow]} are your best: ${mine}% kept, against ${others}% on other days.`,
                evidence: `${slot.n} ${WEEKDAY_NAMES[dow]}, last ${WINDOW} days.`,
            },
        };
    }
    if (weekday) out.push(weekday.pattern);

    // ----------------------------------------------------------------- time
    const since = recent[0]?.date ?? today;
    const hours = input.ticks.filter(tick => tick.date >= since && tick.date < today).map(tick => hourOf(tick.at)).filter(Number.isFinite).sort((a, b) => a - b);
    if (hours.length >= 8) {
        const usual = hours[Math.floor(hours.length / 2)];
        const late = hours[Math.max(0, Math.ceil(hours.length * 0.9) - 1)];
        const cutoff = Math.ceil(late);
        const before = pct(hours.filter(hour => hour < cutoff).length, hours.length);
        out.push({
            id: 'time',
            text: cutoff < 22 && cutoff - usual >= 1
                ? `Usually done around ${hourLabel(usual)}. Past ${hourLabel(cutoff)} it rarely happens: ${before}% of the times you do it are before then.`
                : `Usually done around ${hourLabel(usual)}.`,
            evidence: `${hours.length} check-ins, last ${WINDOW} days.`,
        });
    }

    // ----------------------------------------------------------------- miss
    // The due day after a miss, against the due day after a keep.
    const afterMiss = { hit: 0, n: 0 };
    const afterKeep = { hit: 0, n: 0 };
    for (let i = 1; i < due.length; i++) {
        const slot = due[i - 1].completed ? afterKeep : afterMiss;
        slot.n++;
        if (due[i].completed) slot.hit++;
    }
    if (afterMiss.n >= 5 && afterKeep.n >= 5 && twoProportionZ(afterMiss, afterKeep) <= -Z95) {
        out.push({
            id: 'miss',
            text: `One miss tends to become two: after a miss you keep the next one ${pct(afterMiss.hit, afterMiss.n)}% of the time, ${pct(afterKeep.hit, afterKeep.n)}% otherwise. The day after a miss is the one that matters.`,
            evidence: `${afterMiss.n} misses, last ${WINDOW} days.`,
        });
    }

    // --------------------------------------------------------------- source
    const logged = Object.entries(input.sources).filter(([date]) => date >= since && date <= today).map(([, source]) => source);
    if (logged.length >= 5) {
        const shares = sourceShares(logged);
        const [first, second] = shares;
        out.push({
            id: 'source',
            text: first.share >= 0.95
                ? `Always logged ${SOURCE_WORDS[first.source]}.`
                : `Logged ${SOURCE_WORDS[first.source]} ${Math.round(first.share * 100)}% of the time${second ? `, ${SOURCE_WORDS[second.source]} ${Math.round(second.share * 100)}%` : ''}.`,
            evidence: `${logged.length} check-ins, last ${WINDOW} days.`,
        });
    }

    // ------------------------------------------------------------ from Echo
    for (const pattern of input.global ?? []) {
        if (ABOUT_ONE.has(pattern.kind) && pattern.id.split(':').includes(habitId)) {
            out.push({ id: `echo:${pattern.id}`, text: pattern.text, evidence: pattern.evidence });
        }
    }

    return out.slice(0, 6);
}
