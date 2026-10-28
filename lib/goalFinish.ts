import type { Habit } from './habitsSQLite';

/**
 * What happens to a goal when it is reached, and how older goals are read
 * again so they count the way the goal means.
 */

const readSpec = (goal: Habit): Record<string, any> => {
    try { return goal.goalSpec ? JSON.parse(goal.goalSpec) ?? {} : {}; } catch { return {}; }
};

/**
 * A goal written before Habyss knew to tell "reach it" from "add it up"
 * ("Get a 7 CGPA", "Run 10 km without stopping"), read again from its own
 * words: the new spec to save, or null when it already counts the right way.
 * Only ever moves an added-up goal to the latest number logged (a level) or
 * the best one (one go); it never touches a goal that already says either.
 */
export function rereadSpec(goal: Habit, today: Date = new Date()): string | null {
    const spec = readSpec(goal);
    if (spec.counting_chosen) return null;
    if (spec.aggregation && spec.aggregation !== 'sum') return null;
    const { parseGoalText } = require('./goalParser') as typeof import('./goalParser');
    const parsed = parseGoalText(goal.name, { today, habits: [] }).goal;
    if (parsed.aggregation !== 'latest' && parsed.aggregation !== 'max') return null;
    const next: Record<string, any> = { ...spec, kind: 'number', type: parsed.type, aggregation: parsed.aggregation, direction: parsed.direction ?? spec.direction };
    if (!(Number(next.target) > 0) && parsed.target) next.target = parsed.target;
    if (!next.metric_unit && parsed.metric_unit) next.metric_unit = parsed.metric_unit;
    // Its old "done" came from adding up; whether it is reached is asked again.
    delete next.completed_on;
    return JSON.stringify(next);
}

/**
 * Reached: the day is written onto the goal (so it stays reached), and its
 * habits and open tasks are let go, free for another goal. Done tasks keep
 * their goal, as the record of what was done for it.
 */
export async function finishGoal(goal: Habit, day: string, habits: Habit[], tasks: { id: string; goalId?: string | null; status: string }[]): Promise<void> {
    const { updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { updateTask } = require('./tasks') as typeof import('./tasks');
    const spec = readSpec(goal);
    const mine = habits.filter(habit => habit.goalId === goal.id && !habit.isGoal);
    const kept: string[] = Array.isArray(spec.finished_with) ? spec.finished_with : [];
    const withHabits = [...new Set([...kept, ...mine.map(habit => habit.id)])];
    if (spec.completed_on !== day || withHabits.length !== kept.length) {
        await updateHabit({ id: goal.id, goalSpec: JSON.stringify({ ...spec, completed_on: day, finished_with: withHabits }) });
    }
    for (const habit of mine) await updateHabit({ id: habit.id, goalId: null as unknown as undefined }).catch(() => undefined);
    for (const task of tasks) {
        if (task.goalId === goal.id && task.status !== 'done') await updateTask(task.id, { goalId: null }).catch(() => undefined);
    }
}
