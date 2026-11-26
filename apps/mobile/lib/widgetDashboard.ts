import type { Habit } from './habitsSQLite';
import { type Task, taskRank, tasksForDay } from './tasks';
import { createHabitSchedule, localDateKey as localKey, parseHabitDate } from './habitSchedule';
import { addDays } from './habitSummary';
import { doneOnDay } from './dailyFocus';
import { habitDays, habitRun } from './habitStreak';

export interface DashboardTask { id: string; name: string; isCompleted: boolean; time?: string; dueDate?: string; }
export interface DashboardDay { date: string; total: number; completed: number; items: DashboardTask[]; }
export interface WidgetDashboard {
    version: 1;
    generatedAt: string;
    dayKey: string;
    accent: { from: string; to: string };
    days: DashboardDay[];
    heatmap: { date: string; completed: number; total: number }[];
    streak: number;
    /**
     * Each habit on its own, for the streak widget set to one habit: its
     * streak (lib/habitStreak.ts) and the heatmap's days as one character
     * each, oldest first: "1" done, "0" due and not done, "-" not due.
     */
    habits: { id: string; name: string; streak: number; days: string }[];
    /** Always empty: kept because widgets from builds before goals were removed require the field. */
    goals: never[];
}

export function buildWidgetDashboard({ habits, tasks, history, skips, today, accent, streak = 0 }: {
    habits: Habit[]; tasks: Task[]; history: Record<string, string[]>; skips: Record<string, string[]>;
    today: string; accent: WidgetDashboard['accent']; streak?: number;
}): WidgetDashboard {
    const active = habits.filter(habit => !habit.isArchived)
        .map(habit => ({ habit, scheduled: createHabitSchedule(habit) }));
    const heatmap = Array.from({ length: 98 }, (_, index) => {
        const date = addDays(today, index - 90);
        const skipped = new Set(skips[date]);
        const done = new Set(history[date]);
        const due = active.filter(({ habit, scheduled }) => scheduled(new Date(`${date}T12:00:00`)) && !skipped.has(habit.id));
        return { date, completed: due.filter(({ habit }) => done.has(habit.id)).length, total: due.length };
    });
    const heatStart = heatmap[0].date;
    const habitRows = active.map(({ habit, scheduled }) => {
        const done = new Set<string>();
        const skipped = new Set<string>();
        for (const [date, ids] of Object.entries(history)) if (ids.includes(habit.id)) done.add(date);
        for (const [date, ids] of Object.entries(skips)) if (ids.includes(habit.id)) skipped.add(date);
        const start = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
        const from = start ? localKey(start) : heatStart;
        const isDue = (date: string) => date >= from && scheduled(new Date(`${date}T12:00:00`));
        const run = habitRun(habitDays(from < heatStart ? from : heatStart, today, isDue, done, skipped), today);
        const cells = habitDays(heatStart, heatmap[heatmap.length - 1].date, isDue, done, skipped)
            .map(day => (!day.scheduled ? '-' : day.completed ? '1' : '0')).join('');
        return { id: habit.id, name: habit.name, streak: run.currentStreak, days: cells };
    });
    const days = Array.from({ length: 8 }, (_, offset) => {
        const date = addDays(today, offset);
        // What the day holds, plus anything finished on it: a task ticked
        // today stays on today's widget, struck through, even if it was due
        // another day.
        const listed = tasksForDay(tasks, date, date);
        const listedIds = new Set(listed.map(task => task.id));
        const due = [...listed, ...tasks.filter(task => !listedIds.has(task.id) && doneOnDay(task, date))].sort((a, b) =>
            Number(a.status === 'done') - Number(b.status === 'done') || taskRank(a, date) - taskRank(b, date) || a.createdAt.localeCompare(b.createdAt));
        return { date, total: due.length, completed: due.filter(task => task.status === 'done').length,
            items: due.slice(0, 12).map(task => ({ id: `task:${task.id}`, name: task.title, isCompleted: task.status === 'done', time: task.dueTime, dueDate: task.dueDate })) };
    });
    return { version: 1, generatedAt: new Date().toISOString(), dayKey: today, accent, days, heatmap, goals: [], streak, habits: habitRows };
}

export interface WidgetEvent { eventId: string; id: string; day: string; done: boolean; timestamp: number; /** "focus": finished by the watch's focus timer. */ source?: string }
export function parseWidgetEvent(raw: string): WidgetEvent | null {
    try {
        const event = JSON.parse(raw);
        if (typeof event.eventId !== 'string' || !event.eventId || typeof event.id !== 'string'
            || !/^(habit|task):.+/.test(event.id) || typeof event.done !== 'boolean'
            || typeof event.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.day) || !parseHabitDate(event.day)
            || !Number.isFinite(event.timestamp)) return null;
        return event;
    } catch { return null; }
}
