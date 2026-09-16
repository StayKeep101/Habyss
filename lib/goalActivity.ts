import type { Habit } from './habitsSQLite';
import { isHabitScheduledForDate, localDateKey, parseHabitDate } from './habitSchedule';

export interface ActivityDay { date: string; scheduledIds: string[]; completedIds: string[]; complete: boolean; }

export function goalActivityDays(habits: Habit[], history: { date: string; completedIds: string[] }[], completions: Record<string, boolean>, today = new Date()): ActivityDay[] {
    const todayKey = localDateKey(today);
    const byDate = new Map(history.map(day => [day.date, day.completedIds]));
    byDate.set(todayKey, Object.keys(completions).filter(id => completions[id]));
    const active = habits.filter(habit => !habit.isGoal && !habit.isArchived);
    return [...byDate.entries()].filter(([date]) => date <= todayKey).sort(([a], [b]) => a.localeCompare(b)).map(([date, ids]) => {
        const parsed = parseHabitDate(date);
        const scheduledIds = parsed ? active.filter(habit => isHabitScheduledForDate(habit, parsed)).map(habit => habit.id) : [];
        const completedIds = scheduledIds.filter(id => ids.includes(id));
        return { date, scheduledIds, completedIds, complete: scheduledIds.length > 0 && completedIds.length === scheduledIds.length };
    });
}

export function activityStreaks(days: ActivityDay[], todayKey: string) {
    let best = 0, run = 0, current = 0;
    for (const day of days) {
        if (!day.scheduledIds.length) continue;
        run = day.complete ? run + 1 : 0;
        best = Math.max(best, run);
    }
    for (const day of [...days].reverse()) {
        if (!day.scheduledIds.length || (day.date === todayKey && !day.complete)) continue;
        if (!day.complete) break;
        current++;
    }
    return { best, current };
}
