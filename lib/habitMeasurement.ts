import type { Habit } from './habitsSQLite';

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
    const step = target < 1 ? 0.1 : 1;
    const quickAmounts = target <= 10 ? [step, step * 2, step * 3]
        : target <= 100 ? [1, 5, 10] : target <= 1000 ? [10, 50, 100] : [100, 500, 1000];
    return { kind, target: kind === 'boolean' ? 1 : target, unit, secondsPerUnit, step, quickAmounts } as const;
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
