import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { monthDays } from './progressMonth';

/**
 * Your day as a card a friend sees in your chat.
 *
 * Built from the same day summary the Streak page uses, so the card, the
 * calendar and the day sheet never disagree about what was done. The card is
 * rewritten as the day goes on — one per day, not one per tick — so a chat
 * shows how each day ended, not a stream of updates.
 */

export interface DayCardLine { name: string; done: boolean; skipped?: boolean }

export interface DayCardData {
    habits?: DayCardLine[];
    tasks?: DayCardLine[];
    habitsDone: number;
    habitsTotal: number;
    tasksDone: number;
    tasksTotal: number;
    streak: number;
    /** Every habit being kept, scheduled today or not. */
    habitsActive?: number;
    goalsActive?: number;
    /** Goals something happened under today: a habit ticked or a task finished. */
    goalsMoved?: number;
}

export function buildDayCard(input: {
    habits: Habit[];
    tasks: Task[];
    history: Record<string, string[]>;
    skips: Record<string, string[]>;
    day: string;
    streak: number;
}): DayCardData {
    const summary = monthDays({
        habits: input.habits, tasks: input.tasks, history: input.history, skips: input.skips,
        month: new Date(`${input.day}T12:00:00`), today: input.day,
        // Friends see what you actually ticked, shared or not.
        raw: true,
    }).find(entry => entry.date === input.day);

    const habitName = new Map(input.habits.map(habit => [habit.id, habit.name]));
    const taskName = new Map(input.tasks.map(task => [task.id, task.title]));
    const named = (ids: string[], names: Map<string, string>, extra: Partial<DayCardLine>) =>
        ids.map(id => ({ name: names.get(id) ?? '', ...extra })).filter(line => line.name) as DayCardLine[];

    const live = input.habits.filter(habit => !habit.isArchived);
    const goals = live.filter(habit => habit.isGoal);
    const doneToday = new Set(input.history[input.day] ?? []);
    const finishedToday = new Set(summary?.tasks ?? []);
    const counts = {
        habitsActive: live.filter(habit => !habit.isGoal).length,
        goalsActive: goals.length,
        goalsMoved: goals.filter(goal =>
            live.some(habit => habit.goalId === goal.id && doneToday.has(habit.id))
            || input.tasks.some(task => task.goalId === goal.id && finishedToday.has(task.id))).length,
    };

    if (!summary) {
        return { habits: [], tasks: [], habitsDone: 0, habitsTotal: 0, tasksDone: 0, tasksTotal: 0, streak: input.streak, ...counts };
    }

    const habits = [
        ...named(summary.done, habitName, { done: true }),
        ...named(summary.missed, habitName, { done: false }),
        ...named(summary.skipped, habitName, { done: false, skipped: true }),
    ];
    const tasks = [
        ...named(summary.tasks, taskName, { done: true }),
        ...named(summary.tasksOpen, taskName, { done: false }),
    ];
    return {
        habits,
        tasks,
        habitsDone: summary.done.length,
        habitsTotal: summary.done.length + summary.missed.length,
        tasksDone: summary.tasks.length,
        tasksTotal: summary.tasks.length + summary.tasksOpen.length,
        streak: input.streak,
        ...counts,
    };
}

/** Same card, same text: nothing to send. */
export const sameCard = (a: DayCardData | null, b: DayCardData): boolean =>
    !!a && JSON.stringify(a) === JSON.stringify(b);

/** 0–1 for the ring on the card: habits and tasks together. */
export function cardShare(card: DayCardData): number {
    const total = card.habitsTotal + card.tasksTotal;
    return total === 0 ? 0 : (card.habitsDone + card.tasksDone) / total;
}
