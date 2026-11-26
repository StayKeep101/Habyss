import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { monthDays } from './progressMonth';
import type { DayMoments } from './dayMoments';

/**
 * Your day as a card a friend sees in your chat.
 *
 * Built from the same day summary the Streak page uses, so the card, the
 * calendar and the day sheet never disagree about what was done. The card is
 * rewritten as the day goes on — one per day, not one per tick — so a chat
 * shows how each day ended, not a stream of updates.
 */

export interface DayCardLine {
    name: string;
    done: boolean;
    skipped?: boolean;
    /** Minutes focused on it that day. */
    minutes?: number;
    /** Friends it is shared with, by first name. */
    with?: string[];
    /** Shared, your part done, the others' not yet: shown with a minus and not counted as done. */
    waiting?: boolean;
    /** The photo taken when it was ticked (lib/tickPhotos.ts), for friends to see. */
    photo?: string;
    /** A habit or a task (older cards: unknown). */
    kind?: 'habit' | 'task';
    /** Minutes it was planned to take: a habit's length, a task's estimate. */
    planned?: number;
    /** What counted it, when something did: "6240 of 10000 steps, from Apple Health". */
    tracked?: { value: number; target: number; unit: string; source?: string };
    /** "HH:MM" it was done. */
    at?: string;
}

/** What the card can say about each item beyond done or not, read by the poster's phone. */
export interface DayCardFacts {
    minutesOf?: (id: string) => number;
    withOf?: (id: string) => string[];
    /** Done by you on a shared item, still waiting on someone else that day. */
    waitingOf?: (id: string) => boolean;
    /** The photo of it that day, if one was taken and uploaded. */
    photoOf?: (id: string) => string | undefined;
    /** The day's most important tasks (Today's 3 or 5, lib/dailyFocus.ts), in order. */
    top?: string[];
    /** What counted it that day (Apple Health, its apps, a number typed in). */
    trackedOf?: (id: string) => DayCardLine['tracked'] | undefined;
    /** "HH:MM" it was ticked or finished. */
    atOf?: (id: string) => string | undefined;
}

/** The card, plus what made the day stand out (lib/dayMoments.ts): optional, so older cards still read. */
export interface DayCardData extends DayMoments {
    habits?: DayCardLine[];
    tasks?: DayCardLine[];
    habitsDone: number;
    habitsTotal: number;
    tasksDone: number;
    tasksTotal: number;
    streak: number;
    /** Every habit being kept, scheduled today or not. */
    habitsActive?: number;
    /** Today's 3 (or 5): the tasks that mattered most, with how long each took. */
    top?: DayCardLine[];
    /** Your few words about the day (lib/dayNote.ts), on the pack's last card. */
    note?: string;
}

export function buildDayCard(input: {
    habits: Habit[];
    tasks: Task[];
    history: Record<string, string[]>;
    skips: Record<string, string[]>;
    day: string;
    streak: number;
    facts?: DayCardFacts;
}): DayCardData {
    const summary = monthDays({
        habits: input.habits, tasks: input.tasks, history: input.history, skips: input.skips,
        month: new Date(`${input.day}T12:00:00`), today: input.day,
        // Friends see what you actually ticked, shared or not.
        raw: true,
    }).find(entry => entry.date === input.day);

    const habitName = new Map(input.habits.map(habit => [habit.id, habit.name]));
    const taskName = new Map(input.tasks.map(task => [task.id, task.title]));
    // What each was planned to take: a habit's length, a task's estimate.
    const plannedFor = new Map<string, number>([
        ...input.habits.filter(habit => habit.durationMinutes).map(habit => [habit.id, habit.durationMinutes!] as [string, number]),
        ...input.tasks.filter(task => task.estimatedMinutes).map(task => [task.id, task.estimatedMinutes!] as [string, number]),
    ]);
    const kindOf = (id: string): 'habit' | 'task' => (habitName.has(id) ? 'habit' : 'task');
    const facts = input.facts ?? {};
    // A line, with the minutes focused on it and who it was with when there is
    // anything to say. A shared one only you have done waits (not counted).
    const line = (id: string, name: string, extra: Partial<DayCardLine>): DayCardLine => {
        const minutes = Math.round(facts.minutesOf?.(id) ?? 0);
        const people = facts.withOf?.(id) ?? [];
        const waiting = !!extra.done && !!facts.waitingOf?.(id);
        const photo = extra.done ? facts.photoOf?.(id) : undefined;
        const planned = plannedFor.get(id);
        const tracked = facts.trackedOf?.(id);
        const at = extra.done ? facts.atOf?.(id) : undefined;
        return {
            name, done: false, ...extra, ...(waiting ? { done: false, waiting: true } : null),
            kind: kindOf(id),
            ...(minutes > 0 ? { minutes } : null), ...(people.length ? { with: people } : null),
            ...(photo ? { photo } : null), ...(planned ? { planned } : null),
            ...(tracked ? { tracked } : null), ...(at ? { at } : null),
        };
    };
    const named = (ids: string[], names: Map<string, string>, extra: Partial<DayCardLine>) =>
        ids.flatMap(id => { const name = names.get(id); return name ? [line(id, name, extra)] : []; });

    const live = input.habits.filter(habit => !habit.isArchived);
    const counts = { habitsActive: live.length };

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
    const finished = new Set(summary.tasks);
    const top = (facts.top ?? []).flatMap(id => {
        const name = taskName.get(id);
        return name ? [line(id, name, { done: finished.has(id) })] : [];
    });
    return {
        habits,
        tasks,
        // Only what counts is done: a shared one waiting on a friend is not yet.
        habitsDone: habits.filter(item => item.done).length,
        habitsTotal: summary.done.length + summary.missed.length,
        tasksDone: tasks.filter(item => item.done).length,
        tasksTotal: summary.tasks.length + summary.tasksOpen.length,
        streak: input.streak,
        ...counts,
        ...(top.length ? { top } : null),
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
