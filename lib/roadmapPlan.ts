import type { GoalSpec } from './goalParser';

/**
 * Turning a goal into a path.
 *
 * A measurable goal says where you are going. A roadmap says what you do until
 * you get there: one repeating habit that does the work, and a few checkpoints
 * with real dates so progress is visible before the deadline arrives.
 *
 * Everything here is derived arithmetic from the goal the user confirmed. No
 * checkpoint is invented beyond splitting their own target across their own
 * window, so the numbers are theirs and they add up.
 */

export interface RoadmapHabit {
    name: string;
    targetValue: number;
    targetUnit: string;
    trackingMethod: 'boolean' | 'numeric';
}

export interface RoadmapStep {
    /** Stable within a build, so the UI can key and remove rows. */
    id: string;
    title: string;
    /** "YYYY-MM-DD". */
    dueDate: string;
    /** Cumulative amount this checkpoint represents, when the goal has one. */
    targetValue?: number;
    unit?: string;
}

export interface Roadmap {
    habit: RoadmapHabit;
    steps: RoadmapStep[];
}

const dateKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    return next;
};

const parseKey = (key: string): Date => new Date(`${key}T12:00:00`);

/** A tidy number: whole where it can be, one decimal where it cannot. */
export function tidy(value: number): number {
    return Number.isInteger(value) ? value : Math.round(value * 10) / 10;
}

/**
 * The habit that does the work.
 *
 * Counted goals keep their own unit so progress adds up in the thing being
 * measured. Everything else falls back to the minutes the user said they could
 * give, because that is the only honest number available.
 */
export function habitForGoal(spec: GoalSpec, minutesPerDay: number, days: number): RoadmapHabit {
    const name = spec.suggested_habit?.name ?? spec.title;
    const unit = spec.metric_unit;
    const countable = unit && !['percent', 'sessions', 'kg', 'lb'].includes(unit);

    if (countable && spec.target !== null && days > 0 && spec.window?.kind === 'fixed') {
        // Spread the target over the days available, so doing the daily amount
        // actually arrives at the goal rather than approximately near it.
        const perDay = tidy(Math.max(1, spec.target / days));
        return { name, targetValue: perDay, targetUnit: unit!, trackingMethod: 'numeric' };
    }

    return {
        name,
        targetValue: Math.max(1, Math.round(minutesPerDay)),
        targetUnit: 'min',
        trackingMethod: 'numeric',
    };
}

/**
 * Checkpoints between today and the deadline.
 *
 * Only for goals with a real end date and a number to divide; a goal that
 * simply repeats every week has nothing to check off on the way. Returns fewer
 * checkpoints, or none, rather than inventing dates in a window too short to
 * hold them.
 */
export function checkpointsForGoal(spec: GoalSpec, today: Date, wanted = 3): RoadmapStep[] {
    if (spec.window?.kind !== 'fixed') return [];

    const end = parseKey(spec.window.end);
    const start = new Date(Math.max(parseKey(spec.window.start).getTime(), today.getTime()));
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (totalDays < 2) return [];

    // One checkpoint per stretch, and never more stretches than days.
    const count = Math.max(1, Math.min(wanted, totalDays - 1));
    const steps: RoadmapStep[] = [];

    for (let index = 1; index <= count; index += 1) {
        const share = index / (count + 1);
        const due = addDays(start, Math.round(totalDays * share));
        if (due >= end) continue;

        const amount = spec.target !== null && spec.metric_unit && spec.metric_unit !== 'percent'
            ? tidy(spec.target * share)
            : undefined;

        steps.push({
            id: `checkpoint_${index}`,
            title: amount !== undefined
                ? `${spec.direction === 'at_most' ? 'Still under' : 'Reach'} ${amount} ${spec.metric_unit}`
                : `Checkpoint ${index}`,
            dueDate: dateKey(due),
            targetValue: amount,
            unit: spec.metric_unit ?? undefined,
        });
    }

    // The deadline itself is the last step, so the path ends at the goal.
    steps.push({
        id: 'checkpoint_final',
        title: spec.target !== null && spec.metric_unit && spec.metric_unit !== 'percent'
            ? `${spec.direction === 'at_most' ? 'Finish under' : 'Reach'} ${tidy(spec.target)} ${spec.metric_unit}`
            : 'Goal day',
        dueDate: spec.window.end,
        targetValue: spec.target ?? undefined,
        unit: spec.metric_unit ?? undefined,
    });

    return steps;
}

/** Days from today to the end of the goal's window, at least one. */
export function daysAvailable(spec: GoalSpec, today: Date): number {
    if (spec.window?.kind !== 'fixed') return 30;
    const end = parseKey(spec.window.end);
    const start = new Date(Math.max(parseKey(spec.window.start).getTime(), today.getTime()));
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

/** The whole path: the habit that does the work, and the checkpoints along it. */
export function buildRoadmap(
    spec: GoalSpec,
    options: { today: Date; minutesPerDay: number; checkpoints?: number },
): Roadmap {
    const days = daysAvailable(spec, options.today);
    return {
        habit: habitForGoal(spec, options.minutesPerDay, days),
        steps: checkpointsForGoal(spec, options.today, options.checkpoints ?? 3),
    };
}
