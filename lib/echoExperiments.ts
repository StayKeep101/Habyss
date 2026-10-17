import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from './habitsSQLite';
import { habitDays, keptRate, shiftDay, type HabitDay, type HistoryDay } from './habitDays';
import { measurementFor } from './habitMeasurement';

/**
 * Seven-day experiments: try one change to a habit that has been hard, and
 * see what the record says.
 *
 * - Echo proposes; nothing changes until the person confirms.
 * - The baseline is the habit's own last 14 days; the result is the 7 days of
 *   the test. Both are counted, not estimated.
 * - The verdict says how sure it is. A week is a small sample and the change
 *   is not the only thing that differed, so it is a hint, never proof.
 * - Going back restores exactly what was there before.
 */

export type ExperimentType = 'morning' | 'smaller';

export interface Experiment {
    id: string;
    habitId: string;
    habitName: string;
    type: ExperimentType;
    /** What the habit had before, to put back. */
    before: { startTime?: string | null; goalValue?: number | null };
    /** What the experiment set. */
    after: { startTime?: string; goalValue?: number };
    startedOn: string;
    days: number;
    baseline: { kept: number; countable: number; rate: number };
    status: 'running' | 'kept' | 'reverted';
}

export interface Proposal {
    habitId: string;
    habitName: string;
    type: ExperimentType;
    title: string;
    why: string;
    after: Experiment['after'];
    before: Experiment['before'];
}

export interface Verdict {
    done: boolean;
    daysIn: number;
    result: { kept: number; countable: number; rate: number };
    change: number;
    call: 'better' | 'worse' | 'unclear' | 'too_early';
    text: string;
}

const KEY = 'habyss_echo_experiments';
const LENGTH = 7;

/** What to try for a habit that has been hard: earlier if it is set late, else a smaller version. */
export function proposeExperiment(habit: Habit): Proposal | null {
    const hour = habit.startTime ? Number(habit.startTime.split(':')[0]) : null;
    if (hour !== null && Number.isFinite(hour) && hour >= 12) {
        return {
            habitId: habit.id, habitName: habit.name, type: 'morning',
            title: `Do ${habit.name} in the morning for 7 days`,
            why: `It is set for ${habit.startTime}. Earlier often means fewer things get in the way first.`,
            before: { startTime: habit.startTime }, after: { startTime: '08:00' },
        };
    }
    const measure = measurementFor(habit);
    if (measure.kind !== 'boolean' && measure.target > 1) {
        const smaller = Math.max(1, Math.ceil(measure.target / 2));
        return {
            habitId: habit.id, habitName: habit.name, type: 'smaller',
            title: `Halve ${habit.name} for 7 days`,
            why: `${measure.target} ${measure.unit} might be the hard part. ${smaller} done beats ${measure.target} skipped.`,
            before: { goalValue: habit.goalValue ?? null }, after: { goalValue: smaller },
        };
    }
    return null;
}

export function baselineFor(habitId: string, habits: Habit[], history: HistoryDay[], completions: Record<string, boolean>, today: string) {
    const days = habitDays(habits, history, completions, 14, shiftDay(today, -1), today);
    return keptRate(only(days, habitId));
}

export function evaluate(experiment: Experiment, habits: Habit[], history: HistoryDay[], completions: Record<string, boolean>, today: string): Verdict {
    const last = shiftDay(experiment.startedOn, experiment.days - 1);
    const end = last < today ? last : shiftDay(today, -1);
    const daysIn = Math.max(0, dayCount(experiment.startedOn, end));
    const done = last < today;
    const days = daysIn > 0 ? habitDays(habits, history, completions, daysIn, end, today) : [];
    const result = keptRate(only(days, experiment.habitId));
    const change = result.countable && experiment.baseline.countable ? result.rate - experiment.baseline.rate : 0;
    const call: Verdict['call'] = result.countable < 3 ? 'too_early'
        : change >= 15 ? 'better' : change <= -10 ? 'worse' : 'unclear';
    const caution = 'One week is a small sample, and other things changed too, so treat it as a hint.';
    const text = call === 'too_early' ? `Not enough days yet: ${result.kept} of ${result.countable} kept so far.`
        : call === 'better' ? `${result.rate}% kept, up from ${experiment.baseline.rate}%. Looks like it helps. ${caution}`
        : call === 'worse' ? `${result.rate}% kept, down from ${experiment.baseline.rate}%. Probably not the fix. ${caution}`
        : `${result.rate}% kept against ${experiment.baseline.rate}% before: no clear difference. ${caution}`;
    return { done, daysIn, result, change, call, text };
}

// -------------------------------------------------------------------- store

let experiments: Experiment[] = [];
let loaded = false;
const listeners = new Set<() => void>();
export const currentExperiments = (): Experiment[] => experiments;
export function subscribeExperiments(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
async function commit(next: Experiment[]) {
    experiments = next;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}
export async function loadExperiments(): Promise<Experiment[]> {
    if (loaded) return experiments;
    loaded = true;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length) { experiments = parsed; listeners.forEach(listener => listener()); }
    } catch { /* none yet */ }
    return experiments;
}

/** Starts it: applies the change to the habit (the caller has the person's confirmation). */
export async function startExperiment(proposal: Proposal, baseline: Experiment['baseline'], today: string): Promise<Experiment> {
    await loadExperiments();
    const { updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    await updateHabit({ id: proposal.habitId, ...proposal.after });
    const experiment: Experiment = {
        id: `${proposal.habitId}:${today}`, habitId: proposal.habitId, habitName: proposal.habitName, type: proposal.type,
        before: proposal.before, after: proposal.after, startedOn: today, days: LENGTH, baseline, status: 'running',
    };
    await commit([experiment, ...experiments.filter(item => item.habitId !== proposal.habitId || item.status !== 'running')]);
    return experiment;
}

/** Keeps the change. */
export async function keepExperiment(id: string): Promise<void> {
    await loadExperiments();
    await commit(experiments.map(item => item.id === id ? { ...item, status: 'kept' } : item));
}

/** Puts the habit back exactly as it was. */
export async function revertExperiment(id: string): Promise<void> {
    await loadExperiments();
    const experiment = experiments.find(item => item.id === id);
    if (!experiment) return;
    const { updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const restore: Record<string, unknown> = {};
    if ('startTime' in experiment.after) restore.startTime = experiment.before.startTime ?? undefined;
    if ('goalValue' in experiment.after) restore.goalValue = experiment.before.goalValue ?? undefined;
    await updateHabit({ id: experiment.habitId, ...restore });
    await commit(experiments.map(item => item.id === id ? { ...item, status: 'reverted' } : item));
}

/** Seven more days on the same change. */
export async function extendExperiment(id: string): Promise<void> {
    await loadExperiments();
    await commit(experiments.map(item => item.id === id ? { ...item, days: item.days + LENGTH } : item));
}

function only(days: HabitDay[], id: string): HabitDay[] {
    return days.map(day => ({
        date: day.date,
        scheduled: day.scheduled.filter(each => each === id),
        done: day.done.filter(each => each === id),
        skipped: day.skipped.filter(each => each === id),
    }));
}

function dayCount(from: string, to: string): number {
    if (to < from) return 0;
    const [a, b] = [from, to].map(key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); });
    return Math.round((b - a) / 86400000) + 1;
}
