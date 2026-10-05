import type { Habit } from './habitsSQLite';
import { type Task, taskRank, tasksForDay } from './tasks';
import { createHabitSchedule, parseHabitDate } from './habitSchedule';
import { addDays, buildGoalInsights, goalProgress } from './goalInsights';

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
    goals: { id: string; name: string; progress: number; color: string; taskWeights: Record<string, number>;
        points: { date: string; actual: number }[] }[];
}

export function buildWidgetDashboard({ habits, tasks, history, skips, today, accent, streak = 0 }: {
    habits: Habit[]; tasks: Task[]; history: Record<string, string[]>; skips: Record<string, string[]>;
    today: string; accent: WidgetDashboard['accent']; streak?: number;
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
            Number(a.status === 'done') - Number(b.status === 'done') || taskRank(a, date) - taskRank(b, date) || a.createdAt.localeCompare(b.createdAt));
        return { date, total: due.length, completed: due.filter(task => task.status === 'done').length,
            items: due.slice(0, 12).map(task => ({ id: `task:${task.id}`, name: task.title, isCompleted: task.status === 'done', time: task.dueTime, dueDate: task.dueDate })) };
    });
    const visibleIds = new Set(days.flatMap(day => day.items.map(item => item.id.slice(5))));
    const goals = habits.filter(habit => habit.isGoal && !habit.isArchived).map(goal => {
        const progress = goalProgress({ goal, habits, tasks, history, skips, today }, false);
        // What ticking each task on the widget adds, worked out by the same
        // measure the app uses rather than a formula of its own: progress with
        // that task done, less progress now. Right for a project (one task of
        // N), a number goal (its count) and a time goal (its minutes) alike.
        const stamp = `${today}T12:00:00`;
        const weightOf = (task: Task) => {
            const ticked = tasks.map(item => item.id === task.id
                ? { ...item, status: 'done' as const, completedAt: item.completedAt ?? stamp, updatedAt: stamp }
                : item);
            return Math.max(0, goalProgress({ goal, habits, tasks: ticked, history, skips, today }, false) - progress);
        };
        return {
            id: goal.id, name: goal.name, color: goal.color || accent.from,
            progress,
            points: sampleGoalPoints(buildGoalInsights({ goal, habits, tasks, history, skips, today }).series),
            taskWeights: Object.fromEntries(tasks
                .filter(task => visibleIds.has(task.id) && task.goalId === goal.id && task.status === 'open')
                .map(task => [`task:${task.id}`, weightOf(task)])),
        };
    });
    return { version: 1, generatedAt: new Date().toISOString(), dayKey: today, accent, days, heatmap, goals, streak };
}

/** Bound widget memory while retaining the start, latest value and actual dates. */
function sampleGoalPoints(points: { date: string; actual: number }[], limit = 90) {
    if (points.length <= limit) return points.map(({ date, actual }) => ({ date, actual }));
    return Array.from({ length: limit }, (_, index) => {
        const { date, actual } = points[Math.round(index * (points.length - 1) / (limit - 1))];
        return { date, actual };
    });
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
