import type { Task } from './tasks';

/**
 * Next week's big rocks: the few tasks that move the goals in focus, picked
 * in the weekly review and placed on next week's days before anything else
 * fills them (the weekly review's "plan" half; goal-setting and planning
 * research both point here). Pure.
 */
export const MAX_ROCKS = 5;

/** Open tasks worth a place next week: goals in focus first, then the most urgent and hardest. */
export function rockCandidates(tasks: Task[], focusGoals: Set<string>, limit = 8): Task[] {
    const score = (task: Task) => (task.goalId && focusGoals.has(task.goalId) ? 0 : task.goalId ? 1 : 2);
    return tasks
        .filter(task => task.status === 'open')
        .sort((a, b) => score(a) - score(b)
            || (a.priority ?? 2) - (b.priority ?? 2)
            || (b.difficulty ?? 2) - (a.difficulty ?? 2)
            || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')
            || a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit);
}

/** One rock a weekday, Monday on, from the start of next week (a Sunday start begins on its Monday). */
export function spreadOverWeek(ids: string[], nextWeekStart: string): Record<string, string> {
    const first = new Date(`${nextWeekStart}T12:00:00`);
    if (first.getDay() === 0) first.setDate(first.getDate() + 1);
    const out: Record<string, string> = {};
    ids.slice(0, MAX_ROCKS).forEach((id, index) => {
        const day = new Date(first);
        day.setDate(first.getDate() + index);
        out[id] = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    });
    return out;
}
