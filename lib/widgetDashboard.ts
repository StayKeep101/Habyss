import type { Habit } from './habitsSQLite';
import { type Task, tasksForDay } from './tasks';
import { createHabitSchedule, parseHabitDate } from './habitSchedule';
import { addDays, goalProgress } from './goalInsights';

export interface DashboardTask { id: string; name: string; isCompleted: boolean; time?: string; dueDate?: string; }
export interface DashboardDay { date: string; total: number; completed: number; items: DashboardTask[]; }
export interface WidgetDashboard {
    version: 1;
    generatedAt: string;
    dayKey: string;
    accent: { from: string; to: string };
    days: DashboardDay[];
    heatmap: { date: string; completed: number; total: number }[];
    goals: { id: string; name: string; progress: number; color: string; taskWeights: Record<string, number> }[];
}

export function buildWidgetDashboard({ habits, tasks, history, skips, today, accent }: {
    habits: Habit[]; tasks: Task[]; history: Record<string, string[]>; skips: Record<string, string[]>;
    today: string; accent: WidgetDashboard['accent'];
}): WidgetDashboard {
    const active = habits.filter(habit => !habit.isGoal && !habit.isArchived)
        .map(habit => ({ habit, scheduled: createHabitSchedule(habit) }));
    const heatmap = Array.from({ length: 98 }, (_, index) => {
        const date = addDays(today, index - 90);
        const skipped = new Set(skips[date]);
        const done = new Set(history[date]);
        const due = active.filter(({ habit, scheduled }) => scheduled(new Date(`${date}T12:00:00`)) && !skipped.has(habit.id));
        return { date, completed: due.filter(({ habit }) => done.has(habit.id)).length, total: due.length };
    });
    const days = Array.from({ length: 8 }, (_, offset) => {
        const date = addDays(today, offset);
        const due = tasksForDay(tasks, date, date).sort((a, b) =>
            Number(a.status === 'done') - Number(b.status === 'done') || a.priority - b.priority || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'));
        return { date, total: due.length, completed: due.filter(task => task.status === 'done').length,
            items: due.slice(0, 12).map(task => ({ id: `task:${task.id}`, name: task.title, isCompleted: task.status === 'done', time: task.dueTime, dueDate: task.dueDate })) };
    });
    const visibleIds = new Set(days.flatMap(day => day.items.map(item => item.id.slice(5))));
    const goals = habits.filter(habit => habit.isGoal && !habit.isArchived).map(goal => ({
        id: goal.id, name: goal.name, color: goal.color || accent.from,
        progress: goalProgress({ goal, habits, tasks, history, skips, today }, false),
        taskWeights: Object.fromEntries(tasks.filter(task => visibleIds.has(task.id) && task.goalId === goal.id && task.status !== 'cancelled')
            .map(task => [`task:${task.id}`, 100 / Math.max(1, tasks.filter(item => item.goalId === goal.id && item.status !== 'cancelled').length + active.filter(({ habit }) => habit.goalId === goal.id).length)])),
    }));
    return { version: 1, generatedAt: new Date().toISOString(), dayKey: today, accent, days, heatmap, goals };
}

export interface WidgetEvent { eventId: string; id: string; day: string; done: boolean; timestamp: number; }
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
