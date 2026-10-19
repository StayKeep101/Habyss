import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { isHabitScheduledForDate } from './habitsSQLite';

/**
 * The one thing for right now, wherever it is filed.
 *
 * A habit at 9:30 for two hours used to sit inside its goal's card, folded
 * away. This picks what is due now (from ten minutes before it starts until
 * it ends), or else what is next in the coming hours, from timed habits and
 * timed tasks alike, so it can be pinned at the top with one tap to focus.
 */
export interface NowItem {
    kind: 'habit' | 'task';
    id: string;
    title: string;
    /** Minutes since midnight. */
    start: number;
    end: number;
    state: 'now' | 'next';
    icon?: string;
    color?: string;
}

const EARLY = 10;
const LOOKAHEAD = 180;
const minutesOf = (time?: string) => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

export function pickNow(input: { habits: Habit[]; tasks: Task[]; done: Record<string, boolean>; today: string; now: Date }): NowItem | null {
    const { habits, tasks, done, today, now } = input;
    const minute = now.getHours() * 60 + now.getMinutes();
    const date = new Date(`${today}T12:00:00`);
    const items: NowItem[] = [];
    for (const habit of habits) {
        if (habit.isGoal || habit.isArchived || done[habit.id]) continue;
        const start = minutesOf(habit.startTime);
        if (start === null || !isHabitScheduledForDate(habit, date)) continue;
        items.push({ kind: 'habit', id: habit.id, title: habit.name, start, end: start + (habit.durationMinutes || 30), state: 'next', icon: habit.icon, color: habit.color });
    }
    for (const task of tasks) {
        if (task.status !== 'open' || task.dueDate !== today) continue;
        const start = minutesOf(task.dueTime);
        if (start === null) continue;
        items.push({ kind: 'task', id: task.id, title: task.title, start, end: start + (task.estimatedMinutes || 30), state: 'next' });
    }
    const current = items.filter(item => minute >= item.start - EARLY && minute <= item.end).sort((a, b) => a.start - b.start);
    if (current.length) return { ...current[0], state: 'now' };
    const upcoming = items.filter(item => item.start > minute && item.start - minute <= LOOKAHEAD).sort((a, b) => a.start - b.start);
    return upcoming[0] ?? null;
}

export const clockOf = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
