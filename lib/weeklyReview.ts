import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { habitDays, keptRate, shiftDay, type HabitDay, type HistoryDay } from './habitDays';
import type { MemoryNote } from './echoMemory';
import { localDateKey } from './habitSchedule';

/**
 * The week, reviewed: what held, what got harder, where you bounced back,
 * what kept getting in the way, and one or two things to try next week.
 *
 * Every number is counted here from the record; nothing is estimated. A week
 * still in progress is reviewed up to today, and said to be.
 */

export interface HabitWeek { id: string; name: string; kept: number; countable: number; rate: number; before: number | null }

export interface WeeklyReview {
    start: string;
    end: string;
    /** True while the week is not over yet. */
    soFar: boolean;
    rate: number | null;
    previousRate: number | null;
    kept: number;
    countable: number;
    tasksDone: number;
    /** Kept every time it was due (and due at least twice). */
    held: HabitWeek[];
    /** Down 30 points or more on the week before. */
    harder: HabitWeek[];
    /** Times a miss was answered the very next day it was due. */
    bouncedBack: number;
    /** Obstacles the person told Echo about this week. */
    obstacles: string[];
    /** Concrete things to try, at most two. */
    tryNext: string[];
}

export function buildWeeklyReview(input: {
    habits: Habit[];
    tasks: Task[];
    history: HistoryDay[];
    completions: Record<string, boolean>;
    today: string;
    /** First day of the week being reviewed. */
    weekStart: string;
    notes?: MemoryNote[];
}): WeeklyReview {
    const { habits, tasks, history, completions, today, weekStart } = input;
    const weekEnd = shiftDay(weekStart, 6);
    const end = weekEnd < today ? weekEnd : today;
    const length = Math.max(1, dayCount(weekStart, end));
    const week = habitDays(habits, history, completions, length, end, today);
    const before = habitDays(habits, history, completions, 7, shiftDay(weekStart, -1), today);

    const all = keptRate(week);
    const prev = keptRate(before);
    const active = habits.filter(habit => !habit.isGoal && !habit.isArchived);

    const perHabit: HabitWeek[] = active.map(habit => {
        const now = keptRate(only(week, habit.id));
        const then = keptRate(only(before, habit.id));
        return { id: habit.id, name: habit.name, kept: now.kept, countable: now.countable, rate: now.rate, before: then.countable ? then.rate : null };
    }).filter(item => item.countable > 0);

    const held = perHabit.filter(item => item.countable >= 2 && item.kept === item.countable);
    // Down on the week before, with at least two chances on each side: one miss is not a trend.
    const beforeCount = (id: string) => keptRate(only(before, id)).countable;
    const harder = perHabit.filter(item => item.before !== null && item.countable >= 2 && beforeCount(item.id) >= 2 && item.before - item.rate >= 30)
        .sort((a, b) => (b.before! - b.rate) - (a.before! - a.rate));

    // A miss answered on the habit's very next due day, inside this week.
    let bouncedBack = 0;
    for (const habit of active) {
        const due = week.filter(day => day.scheduled.includes(habit.id) && !day.skipped.includes(habit.id));
        for (let i = 1; i < due.length; i++) {
            if (!due[i - 1].done.includes(habit.id) && due[i].done.includes(habit.id)) bouncedBack++;
        }
    }

    // Stamps are UTC: the day they fall on is the local one, so a task done
    // just after midnight is not counted in the day before.
    const inWeek = (stamp?: string) => {
        if (!stamp) return false;
        const at = new Date(stamp);
        const day = Number.isFinite(at.getTime()) && stamp.length > 10 ? localDateKey(at) : stamp.slice(0, 10);
        return day >= weekStart && day <= end;
    };
    const tasksDone = tasks.filter(task => task.status === 'done' && inWeek(task.completedAt ?? task.updatedAt)).length;
    const obstacles = (input.notes ?? []).filter(note => note.kind === 'obstacle' && inWeek(note.createdAt)).map(note => note.text);

    const tryNext: string[] = [];
    if (harder[0]) tryNext.push(`Make ${harder[0].name} smaller next week, or move it to a time that worked before.`);
    const overdue = tasks.filter(task => task.status === 'open' && !!(task.deadline ?? task.dueDate) && (task.deadline ?? task.dueDate)! < weekStart).length;
    if (overdue >= 3) tryNext.push(`${overdue} tasks are from before this week. Drop or reschedule the ones that no longer matter.`);
    if (tryNext.length < 2 && held[0]) tryNext.push(`Keep ${held[0].name} exactly as it is: it worked every time.`);
    if (tryNext.length < 2 && all.countable > 0 && all.rate < 50) tryNext.push('Plan fewer habits per day next week. Doing three is better than half of six.');

    return {
        start: weekStart,
        end,
        soFar: end < weekEnd,
        rate: all.countable ? all.rate : null,
        previousRate: prev.countable ? prev.rate : null,
        kept: all.kept,
        countable: all.countable,
        tasksDone,
        held,
        harder,
        bouncedBack,
        obstacles,
        tryNext: tryNext.slice(0, 2),
    };
}

function only(days: HabitDay[], id: string): HabitDay[] {
    return days.map(day => ({
        date: day.date,
        scheduled: day.scheduled.filter(each => each === id),
        done: day.done.filter(each => each === id),
        skipped: day.skipped.filter(each => each === id),
    }));
}

function dayCount(from: string, to: string): number {
    const [a, b] = [from, to].map(key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); });
    return Math.round((b - a) / 86400000) + 1;
}
