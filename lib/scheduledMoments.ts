import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { createHabitSchedule, localDateKey, parseHabitDate } from './habitSchedule';
import { measurementFor } from './habitMeasurement';

export interface ScheduledMoment {
    key: string;
    kind: 'habit' | 'task';
    id: string;
    title: string;
    day: string;
    start: Date;
    end: Date;
    url: string;
}

/** The same occurrences drive Echo and scheduled Live Activities. */
export function scheduledMoments(habits: Habit[], tasks: Task[], now = new Date(),
    completed: Record<string, boolean> = {}, skipped: Record<string, boolean> = {}, days = 7,
    /** Today's timeline: what is on it is timed from where it sits there. */
    todayTimes?: Record<string, { start: number; end: number }>): ScheduledMoment[] {
    const today = localDateKey(now);
    const moments: ScheduledMoment[] = [];
    const add = (kind: 'habit' | 'task', id: string, title: string, date: Date, time: string | undefined, minutes?: number) => {
        if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
        const day = localDateKey(date);
        const [hour, minute] = time.split(':').map(Number);
        const placed = day === today ? todayTimes?.[id] : undefined;
        // Today, only what is on today's timeline is reminded of (at its place there): nothing that is not planned.
        if (day === today && todayTimes && !placed) return;
        const start = new Date(date);
        if (placed) start.setHours(0, placed.start, 0, 0); else start.setHours(hour, minute, 0, 0);
        const duration = placed ? placed.end - placed.start : Number.isFinite(minutes) && minutes! > 0 ? Math.min(480, minutes!) : 30;
        const end = new Date(start.getTime() + duration * 60000);
        moments.push({ kind, id, title, day, start, end, key: `${kind}:${id}:${day}:${time}`,
            url: kind === 'habit' ? `/habit-detail?habitId=${encodeURIComponent(id)}` : '/(root)/(tabs)/roadmap' });
    };
    for (const habit of habits) {
        if (habit.isGoal || habit.isArchived || !habit.startTime) continue;
        const scheduled = createHabitSchedule(habit);
        for (let offset = 0; offset < days; offset++) {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
            if (!scheduled(date) || (localDateKey(date) === today && (completed[habit.id] || skipped[habit.id]))) continue;
            const measurement = measurementFor(habit);
            const duration = habit.durationMinutes ?? (measurement.secondsPerUnit ? measurement.target * measurement.secondsPerUnit / 60 : undefined);
            add('habit', habit.id, habit.name, date, habit.startTime, duration);
        }
    }
    const lastDay = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12));
    for (const task of tasks) {
        if (task.status !== 'open' || !task.dueDate || task.dueDate < today || task.dueDate >= lastDay) continue;
        const date = parseHabitDate(task.dueDate);
        if (date) add('task', task.id, task.title, date, task.dueTime, task.estimatedMinutes);
    }
    return moments.sort((a, b) => a.start.getTime() - b.start.getTime() || a.key.localeCompare(b.key));
}
