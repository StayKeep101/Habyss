import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { createHabitSchedule, localDateKey, parseHabitDate } from './habitSchedule';
import { addDays, dateAt } from './goalInsights';
import { countedHistory, countedTasks } from './sharedGate';

/**
 * Marks: the record your actions leave.
 *
 * Not points for opening the app. A mark is earned by committing to something
 * (adding it), by keeping it (completing it), and lost by letting it slide
 * (missing it). Keeping is worth five times committing, so a list of good
 * intentions is never worth as much as a week of doing them.
 *
 * Nothing is stored. Marks are read back from what is already recorded — the
 * habits, tasks and goals, every check-in, every due date — so the number can
 * never drift from the history, a restore brings it back exactly, and undoing
 * a tick takes its marks back with it. Deleting something removes what it
 * earned and what it cost, as if it had never been on the list.
 */

export const MARKS = {
    add: { habit: 1, task: 2, goal: 5 },
    complete: { habit: 5, task: 10, goal: 50, sleep: 5 },
    miss: { habit: -2, task: -4, goal: -15 },
} as const;

export interface Rank { name: string; min: number }

export const RANKS: Rank[] = [
    { name: 'Lost', min: 0 },
    { name: 'Beginner', min: 150 },
    { name: 'Growing', min: 400 },
    { name: 'Consistent', min: 800 },
    { name: 'Disciplined', min: 1500 },
    { name: 'Focused', min: 2500 },
    { name: 'Master', min: 4000 },
    { name: 'Unbreakable', min: 6000 },
    { name: 'Timekeeper', min: 8500 },
    { name: 'Eternal', min: 12000 },
];

/** The Marks range of the rank someone is in: from its floor up to the next rank's. */
export function rankBand(marks: number): { name: string; min: number; max: number | null } {
    const { rank, next } = rankFor(marks);
    return { name: rank.name, min: rank.min, max: next ? next.min : null };
}

export function rankFor(marks: number): { rank: Rank; next: Rank | null; progress: number; toNext: number } {
    let index = 0;
    for (let i = 0; i < RANKS.length; i++) if (marks >= RANKS[i].min) index = i;
    const rank = RANKS[index];
    const next = RANKS[index + 1] ?? null;
    if (!next) return { rank, next, progress: 1, toNext: 0 };
    return {
        rank, next,
        progress: Math.max(0, Math.min(1, (marks - rank.min) / (next.min - rank.min))),
        toNext: next.min - marks,
    };
}

export type MarkKind = 'add' | 'complete' | 'miss';
export type MarkItem = 'habit' | 'task' | 'goal' | 'sleep';

export interface MarkEvent {
    date: string;
    points: number;
    kind: MarkKind;
    item: MarkItem;
    title: string;
}

export interface MarksInput {
    /** Habits and goals; goals are habits with `isGoal`. */
    habits: Habit[];
    tasks: Task[];
    /** Completed habit ids by local date. */
    history: Record<string, string[]>;
    /** Skipped habit ids by local date: neither kept nor missed. */
    skips?: Record<string, string[]>;
    /** The day each goal reached 100%, when it has. */
    goalsCompletedOn?: Record<string, string | null | undefined>;
    /** Mornings after a night that reached the sleep goal. A short night costs nothing. */
    goodNights?: string[];
    today: string;
}

export interface MarksResult {
    total: number;
    /** Change so far today. */
    todayChange: number;
    /** Running total by day, oldest first, ending today. */
    series: { date: string; value: number }[];
    /** Newest first, at most `recent` of them. */
    events: MarkEvent[];
}

/** How far back misses are counted. Enough for any real history, bounded for speed. */
const HORIZON_DAYS = 730;

const dayOf = (stamp?: string | null): string | null => {
    if (!stamp) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return stamp;
    const parsed = new Date(stamp);
    return Number.isFinite(parsed.getTime()) ? localDateKey(parsed) : null;
};

export function computeMarks(input: MarksInput, recent = 40): MarksResult {
    // A shared habit or task earns nothing until everybody on it has done it.
    input = { ...input, history: countedHistory(input.history), tasks: countedTasks(input.tasks) };
    const { today } = input;
    const floor = addDays(today, -HORIZON_DAYS);
    const byDay = new Map<string, number>();
    const events: MarkEvent[] = [];
    const record = (date: string | null, points: number, kind: MarkKind, item: MarkItem, title: string) => {
        if (!date || date > today) return;
        byDay.set(date, (byDay.get(date) ?? 0) + points);
        events.push({ date, points, kind, item, title });
    };

    const habits = input.habits.filter(habit => !habit.isGoal);
    const goals = input.habits.filter(habit => habit.isGoal);
    const habitIds = new Map(habits.map(habit => [habit.id, habit]));

    // ---------------------------------------------------------------- habits
    for (const habit of habits) record(dayOf(habit.createdAt), MARKS.add.habit, 'add', 'habit', habit.name);

    for (const [date, ids] of Object.entries(input.history)) {
        if (date > today) continue;
        for (const id of new Set(ids)) {
            const habit = habitIds.get(id);
            if (habit) record(date, MARKS.complete.habit, 'complete', 'habit', habit.name);
        }
    }

    // A miss is a day the habit was due, has ended, and was neither done nor
    // deliberately skipped. Today has not ended, so it is never a miss yet.
    for (const habit of habits) {
        if (habit.isArchived) continue;
        const scheduled = createHabitSchedule(habit);
        const started = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
        const created = dayOf(habit.createdAt);
        let from = started ? localDateKey(started) : created;
        if (!from) continue;
        if (created && created > from) from = created;
        if (from < floor) from = floor;
        for (let day = from; day < today; day = addDays(day, 1)) {
            if (!scheduled(dateAt(day))) continue;
            if (input.history[day]?.includes(habit.id)) continue;
            if (input.skips?.[day]?.includes(habit.id)) continue;
            record(day, MARKS.miss.habit, 'miss', 'habit', habit.name);
        }
    }

    // ----------------------------------------------------------------- tasks
    for (const task of input.tasks) {
        record(dayOf(task.createdAt), MARKS.add.task, 'add', 'task', task.title);
        if (task.status === 'cancelled') continue;
        if (task.status === 'done') record(dayOf(task.completedAt ?? task.updatedAt), MARKS.complete.task, 'complete', 'task', task.title);
        // Missed once, the day after it was due — and that stands even if it is
        // finished later. Late still counts for finishing; it was still late.
        const finished = task.status === 'done' ? dayOf(task.completedAt ?? task.updatedAt) : null;
        if (task.dueDate && task.dueDate < today && (!finished || finished > task.dueDate)) {
            record(addDays(task.dueDate, 1), MARKS.miss.task, 'miss', 'task', task.title);
        }
    }

    // ----------------------------------------------------------------- goals
    for (const goal of goals) {
        record(dayOf(goal.createdAt), MARKS.add.goal, 'add', 'goal', goal.name);
        const reached = input.goalsCompletedOn?.[goal.id] ?? null;
        if (reached) record(reached, MARKS.complete.goal, 'complete', 'goal', goal.name);
        const deadline = dayOf(goal.targetDate);
        if (deadline && deadline < today && (!reached || reached > deadline)) {
            record(addDays(deadline, 1), MARKS.miss.goal, 'miss', 'goal', goal.name);
        }
    }

    // ----------------------------------------------------------------- sleep
    for (const night of input.goodNights ?? []) {
        if (night >= floor) record(night, MARKS.complete.sleep, 'complete', 'sleep', 'A full night’s sleep');
    }

    // ---------------------------------------------------------------- series
    const days = [...byDay.keys()].sort();
    const series: { date: string; value: number }[] = [];
    let total = 0;
    let yesterday = 0;
    if (days.length) {
        for (let day = days[0]; day <= today; day = addDays(day, 1)) {
            // Never below zero: a bad week takes you back to Lost, not into debt.
            total = Math.max(0, total + (byDay.get(day) ?? 0));
            if (day < today) yesterday = total;
            series.push({ date: day, value: total });
        }
    }
    if (!series.length || series[series.length - 1].date !== today) series.push({ date: today, value: total });

    events.sort((a, b) => b.date.localeCompare(a.date) || b.points - a.points);
    return {
        total,
        todayChange: total - (series.length > 1 ? yesterday : 0),
        series,
        events: events.slice(0, recent),
    };
}
