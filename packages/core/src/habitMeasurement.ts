import type { Habit } from './types';
import { kindOf, quickAmountsFor, stepFor, type UnitKind } from './unitKind';

const TIME_UNITS: Record<string, number> = {
    second: 1, seconds: 1, sec: 1, secs: 1,
    minute: 60, minutes: 60, min: 60, mins: 60,
    hour: 3600, hours: 3600, hr: 3600, hrs: 3600,
};

/** One measurement contract for the dial, manual entry and saved focus sessions. */
export function measurementFor(habit: Pick<Habit, 'unit' | 'goalValue' | 'durationMinutes' | 'type' | 'trackingMethod'>) {
    const unit = habit.unit?.trim().toLowerCase() || 'times';
    const secondsPerUnit = TIME_UNITS[unit] || 0;
    const target = Number.isFinite(habit.goalValue) && habit.goalValue > 0 ? habit.goalValue
        : secondsPerUnit && habit.durationMinutes ? habit.durationMinutes * 60 / secondsPerUnit : 1;
    // Quit habits are a positive daily check-in, never an invitation to add the unwanted behavior.
    const kind = habit.type === 'quit' ? 'boolean' : secondsPerUnit ? 'timer'
        : target > 1 || (habit.trackingMethod === 'numeric' && !['times', 'count'].includes(unit)) ? 'counter' : 'boolean';
    // What the unit measures decides the buttons: a glass of water is 250ml
    // whatever the target, and 500 pages is nothing like 500 millilitres. Only
    // a unit the app does not recognise falls back to the target's magnitude.
    const step = stepFor(unit, target);
    const quickAmounts = quickAmountsFor(unit, target);
    /** Which control this habit deserves, rather than one bespoke per unit. */
    const unitKind: UnitKind = kindOf(unit);
    return { kind, target: kind === 'boolean' ? 1 : target, unit, unitKind, secondsPerUnit, step, quickAmounts } as const;
}

export const localHabitDate = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const formatMeasurement = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function parseMeasurement(input: string): number | null {
    const normalized = input.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
    const value = Number(normalized);
    return Number.isFinite(value) && value <= 100000000 ? value : null;
}

/**
 * A length of time the way you would say it: "4 hours", "1 hour 30 minutes",
 * "45 minutes", "30 seconds" — never "240 minutes". `short` gives "1 h 30 min".
 */
export function formatDuration(totalSeconds: number, short = false): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    const word = (n: number, one: string, many: string, abbr: string) => short ? `${n} ${abbr}` : `${n} ${n === 1 ? one : many}`;
    const parts: string[] = [];
    if (hours) parts.push(word(hours, 'hour', 'hours', 'h'));
    if (minutes) parts.push(word(minutes, 'minute', 'minutes', 'min'));
    if (!hours && !minutes) parts.push(word(rest, 'second', 'seconds', 's'));
    return parts.join(' ');
}

/** A running clock: "3:59:58" past an hour, "45:00" under it. */
export function formatClock(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/** A habit's amount in its own words: "4 hours" for time, "20 pages" otherwise. */
export function describeAmount(habit: Pick<Habit, 'unit' | 'goalValue' | 'durationMinutes' | 'type' | 'trackingMethod'>, amount: number, short = false): string {
    const { secondsPerUnit, unit } = measurementFor(habit);
    if (secondsPerUnit) return formatDuration(amount * secondsPerUnit, short);
    return `${formatMeasurement(amount)} ${unit}`;
}
