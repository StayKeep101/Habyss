/**
 * Finished faster than you gave it: a task with a length (its estimate, or
 * the minutes of a time task) earns more Shards when it is done within that
 * length, counted from when it was due to start (where the timeline had it
 * today, else its set time):
 *   - in half the time or less (or before it was even due to start): ×2;
 *   - within the time: ×1.5;
 *   - later, or with no length or no start to count from: the usual amount.
 * Worked out once, as it is ticked, and kept on the task (`speed`), so the
 * wallet (lib/marks.ts) pays it the same every time it adds up.
 */
export const SPEED = { fast: 2, onTime: 1.5 } as const;

export function taskSpeed(input: {
    /** The task's length in minutes. */
    minutes?: number;
    /** When it was due to start, minutes into the day it was done. */
    start?: number | null;
    /** When it was done, minutes into the day. */
    doneAt: number;
}): number {
    const { minutes, start, doneAt } = input;
    if (!minutes || minutes <= 0 || start === null || start === undefined || !Number.isFinite(start)) return 1;
    const took = doneAt - start;
    if (took <= minutes / 2) return SPEED.fast;
    if (took <= minutes) return SPEED.onTime;
    return 1;
}

/** "Early ×1.5", "Early ×2", or null at the usual rate. */
export const speedLabel = (speed: number | undefined): string | null => (speed && speed > 1 ? `Early ×${speed}` : null);

const toMinutes = (time?: string | null): number | null => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
};

/**
 * A task's speed as it is ticked now: its length, and its start from today's
 * timeline memory (lib/dayMemory.ts: where it sat before the tick), else its
 * set time.
 */
export function speedForTask(task: { id: string; estimatedMinutes?: number; dueTime?: string; measure?: string; target?: number }, now = new Date()): number {
    const minutes = task.measure === 'time' && task.target ? task.target : task.estimatedMinutes;
    let start: number | null = null;
    try {
        const { currentMemory } = require('./dayMemory') as typeof import('./dayMemory');
        const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
        const memory = currentMemory();
        if (memory.day === localDateKey(now)) {
            const slot = memory.planned?.[task.id] ?? memory.slots[task.id];
            if (slot) start = slot.start;
        }
    } catch { /* no timeline memory: the set time */ }
    if (start === null) start = toMinutes(task.dueTime);
    return taskSpeed({ minutes, start, doneAt: now.getHours() * 60 + now.getMinutes() });
}
