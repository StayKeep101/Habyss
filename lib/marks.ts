import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { createHabitRequirement, localDateKey, parseHabitDate } from './habitSchedule';
import { addDays, dateAt } from './goalInsights';
import { countedHistory, countedTasks } from './sharedGate';

/**
 * Marks: your experience. Earned by committing to something (adding it) and
 * by keeping it (completing it), never lost: a miss costs nothing here. They
 * rank you. The same record, misses and all, is what Shards (the currency,
 * lib/shards.ts) are worked out from: `ledger` is every event, with the moment
 * it happened where that is known.
 *
 * Nothing is stored. Marks are read back from what is already recorded — the
 * habits, tasks and goals, every check-in, every due date — so the number can
 * never drift from the history, a restore brings it back exactly, and undoing
 * a tick takes its marks back with it. Deleting something takes back
 * exactly what it earned (adding it, keeping it), so adding and deleting is
 * always break-even. What it cost stays: the misses are kept when it is
 * deleted (`kept`, lib/marksLedger.ts), so deleting a neglected habit is never
 * a way to climb.
 */

export const MARKS = {
    add: { habit: 1, task: 2, goal: 5 },
    complete: { habit: 5, task: 10, goal: 50, sleep: 20, milestone: 30, exercise: 20 },
    miss: { habit: -2, task: -4, goal: -15, sleep: -20 },
} as const;

/**
 * Marks reward a real day, not a long list. The first habits kept in a day
 * earn in full; past that each tick earns one, so twenty tiny habits are not
 * a way up the leaderboard. Adding things earns at most ten a day (the same
 * ceiling Shards keep). Kept apart from MARKS, which is what each thing is worth.
 */
export const MARKS_LIMITS = {
    /** Habits a day that earn their full Marks; each one after earns this many. */
    fullHabitsPerDay: 8,
    extraHabit: 1,
    /** The most adding habits, tasks and goals can earn in a day. */
    addsPerDay: 10,
} as const;

/** The most the perfect-day multiplier can reach. */
export const MAX_MULTIPLIER = 10;

/**
 * The app-wide multiplier, from the run of perfect days (every habit due and
 * Today's 3 or 5 done) up to yesterday: ×1, then ×2 after seven in a row, ×3
 * after fourteen, up to ×10. A missed day puts it back to ×1. It multiplies
 * what you earn by completing things, never what a miss costs.
 */
export const multiplierFor = (run: number): number => Math.min(MAX_MULTIPLIER, 1 + Math.floor(Math.max(0, run) / 7));

/** Days the daily task target was hit, oldest first: done-that-day ≥ target. */
export function focusHitDays(tasks: Task[], target: number, today: string): string[] {
    const counts = new Map<string, number>();
    for (const task of tasks) {
        if (task.status !== 'done' || !task.completedAt) continue;
        const when = new Date(task.completedAt);
        const day = Number.isFinite(when.getTime()) ? localDateKey(when) : task.completedAt.slice(0, 10);
        if (day <= today) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, done]) => done >= target).map(([day]) => day).sort();
}

/**
 * Each perfect day's run: how many perfect days in a row end on it. A day
 * that asked for nothing neither extends nor breaks the run. Counted with the
 * same tally as the "day complete" celebration, so the two always agree.
 */
export function perfectRuns(input: MarksInput, target: number): Map<string, number> {
    const { tallyDay, isDayComplete } = require('./dayComplete') as typeof import('./dayComplete');
    const runs = new Map<string, number>();
    const dates = [...Object.keys(input.history), ...input.tasks.map(task => (task.completedAt ?? '').slice(0, 10)).filter(Boolean)].sort();
    if (!dates.length) return runs;
    const floor = addDays(input.today, -HORIZON_DAYS);
    let day = dates[0] < floor ? floor : dates[0];
    let run = 0;
    for (; day <= input.today; day = addDays(day, 1)) {
        const completions = Object.fromEntries((input.history[day] ?? []).map(id => [id, true]));
        const skipped = Object.fromEntries((input.skips?.[day] ?? []).map(id => [id, true]));
        const tally = tallyDay(input.habits, completions, skipped, input.tasks, day, target as 3 | 5);
        if (tally.total === 0) { if (run) runs.set(day, run); continue; }
        if (isDayComplete(tally)) { run += 1; runs.set(day, run); }
        else if (day < input.today) run = 0;
    }
    return runs;
}

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
export type MarkItem = 'habit' | 'task' | 'goal' | 'sleep' | 'focus' | 'milestone' | 'exercise';

export interface MarkEvent {
    date: string;
    points: number;
    kind: MarkKind;
    item: MarkItem;
    title: string;
    /** When it happened (ms), where the record says: an item added, a task finished. */
    at?: number;
    /** What it is (a habit's id), so a habit's tick time can be found. */
    id?: string;
    /** Completed the same day it was made: it counts as XP, never as Shards (no farming). */
    sameDay?: boolean;
    /** For a completion, the day the thing was made: a goal pays Shards only if it lived a few days. */
    madeOn?: string;
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
    /** Milestones reached on a goal: +30 each, on the day reached (lib/goalMilestones.ts). */
    milestones?: { title: string; doneAt: string }[];
    /** Days the exercise goal was reached (Apple Health): +20 each. Missing it costs nothing. */
    activeDays?: string[];
    /** Mornings after a night that reached the sleep goal: +20 each (sleep matters that much). */
    goodNights?: string[];
    /** Mornings after a recorded night that fell short of it: −20 each. A night with no data counts for nothing. */
    shortNights?: string[];
    /** Today's 3 (or 5): part of what makes a day perfect, which builds the multiplier. */
    dailyTarget?: number;
    /** Misses of things since deleted: deleting takes back what was earned, never what was lost. */
    kept?: KeptPenalty[];
    today: string;
}

export interface KeptPenalty { date: string; points: number; item: MarkItem; title: string }

export interface MarksResult {
    total: number;
    /** Today's multiplier on everything completed (×1 to ×10). */
    multiplier: number;
    /** Perfect days in a row up to yesterday (today joins once it is perfect). */
    perfectRun: number;
    /** Change so far today. */
    todayChange: number;
    /** Running total by day, oldest first, ending today. */
    series: { date: string; value: number }[];
    /** Newest first, at most `recent` of them. */
    events: MarkEvent[];
    /** Every event, misses included, oldest first: what Shards are worked out from (lib/shards.ts). */
    ledger: MarkEvent[];
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
    // The multiplier each day carried, from the perfect days before it.
    const runs = input.dailyTarget ? perfectRuns(input, input.dailyTarget) : new Map<string, number>();
    const multiplierOn = (date: string) => multiplierFor(runs.get(addDays(date, -1)) ?? 0);
    // What each day has already earned from adding things, and how many habits it has kept.
    const addedOn = new Map<string, number>();
    const keptOn = new Map<string, number>();
    // Events past a daily ceiling: in the record, not in the Marks you are shown.
    const beyond = new Set<number>();
    const record = (date: string | null, points: number, kind: MarkKind, item: MarkItem, title: string, more: { since?: string | null; at?: string | null; id?: string } = {}) => {
        if (!date || date > today) return;
        // Adding past the day's ceiling stays on the record (Shards say why
        // they paid nothing for it) but adds nothing to your Marks.
        let xp = true;
        if (kind === 'add') {
            const before = addedOn.get(date) ?? 0;
            xp = before + points <= MARKS_LIMITS.addsPerDay;
            if (xp) addedOn.set(date, before + points);
        }
        if (kind === 'complete' && item === 'habit') {
            const kept = (keptOn.get(date) ?? 0) + 1;
            keptOn.set(date, kept);
            if (kept > MARKS_LIMITS.fullHabitsPerDay) points = MARKS_LIMITS.extraHabit;
        }
        const times = kind === 'complete' && points > 0 ? multiplierOn(date) : 1;
        const earned = points * times;
        // XP only ever goes up: a miss is on the record (it costs Shards) but not in your Marks.
        if (earned > 0 && xp) byDay.set(date, (byDay.get(date) ?? 0) + earned);
        const at = more.at ? new Date(more.at).getTime() : NaN;
        if (!xp) beyond.add(events.length);
        events.push({
            date, points: earned, kind, item, title: times > 1 ? `${title} · ×${times}` : title,
            ...(Number.isFinite(at) ? { at } : null), ...(more.id ? { id: more.id } : null),
            ...(kind === 'complete' && more.since && more.since >= date ? { sameDay: true } : null),
            ...(kind === 'complete' && more.since ? { madeOn: more.since } : null),
        });
    };

    const habits = input.habits.filter(habit => !habit.isGoal);
    const goals = input.habits.filter(habit => habit.isGoal);
    const habitIds = new Map(habits.map(habit => [habit.id, habit]));

    // ---------------------------------------------------------------- habits
    for (const habit of habits) record(dayOf(habit.createdAt), MARKS.add.habit, 'add', 'habit', habit.name, { id: habit.id, at: habit.createdAt });

    for (const [date, ids] of Object.entries(input.history)) {
        if (date > today) continue;
        for (const id of new Set(ids)) {
            const habit = habitIds.get(id);
            if (habit) record(date, MARKS.complete.habit, 'complete', 'habit', habit.name, { since: dayOf(habit.createdAt), id: habit.id });
        }
    }

    // A miss is a day the habit was due, has ended, and was neither done nor
    // deliberately skipped. Today has not ended, so it is never a miss yet.
    // It is charged the moment it becomes one: as the next day begins, like a
    // task past its date. Dated on the day itself, yesterday's misses landed
    // at the start of yesterday, never in today's transactions.
    for (const habit of habits) {
        if (habit.isArchived) continue;
        // Due that day (a "3 times a week" one only once it could not wait).
        const due = createHabitRequirement(habit);
        const doneOn = (key: string) => !!input.history[key]?.includes(habit.id);
        const started = parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt);
        const created = dayOf(habit.createdAt);
        let from = started ? localDateKey(started) : created;
        if (!from) continue;
        if (created && created > from) from = created;
        if (from < floor) from = floor;
        for (let day = from; day < today; day = addDays(day, 1)) {
            if (!due(day, doneOn)) continue;
            if (input.history[day]?.includes(habit.id)) continue;
            if (input.skips?.[day]?.includes(habit.id)) continue;
            record(addDays(day, 1), MARKS.miss.habit, 'miss', 'habit', habit.name);
        }
    }

    // ----------------------------------------------------------------- tasks
    for (const task of input.tasks) {
        record(dayOf(task.createdAt), MARKS.add.task, 'add', 'task', task.title, { id: task.id, at: task.createdAt });
        if (task.status === 'cancelled') continue;
        // Done early pays more (lib/taskSpeed.ts), said in the transactions.
        if (task.status === 'done') {
            const speed = task.speed && task.speed > 1 ? task.speed : 1;
            record(dayOf(task.completedAt ?? task.updatedAt), Math.round(MARKS.complete.task * speed), 'complete', 'task', speed > 1 ? `${task.title} · early ×${speed}` : task.title, { id: task.id, since: dayOf(task.createdAt), at: task.completedAt ?? task.updatedAt });
        }
        // Missed once, the day after it was due — and that stands even if it is
        // finished later. Late still counts for finishing; it was still late.
        const finished = task.status === 'done' ? dayOf(task.completedAt ?? task.updatedAt) : null;
        // Its deadline when it has one: not done on its planned day is not a miss yet.
        const by = task.deadline ?? task.dueDate;
        if (by && by < today && (!finished || finished > by)) {
            record(addDays(by, 1), MARKS.miss.task, 'miss', 'task', task.title);
        }
    }

    // ----------------------------------------------------------------- goals
    for (const goal of goals) {
        record(dayOf(goal.createdAt), MARKS.add.goal, 'add', 'goal', goal.name, { id: goal.id, at: goal.createdAt });
        const reached = input.goalsCompletedOn?.[goal.id] ?? null;
        if (reached) record(reached, MARKS.complete.goal, 'complete', 'goal', goal.name, { id: goal.id, since: dayOf(goal.createdAt) });
        const deadline = dayOf(goal.targetDate);
        if (deadline && deadline < today && (!reached || reached > deadline)) {
            record(addDays(deadline, 1), MARKS.miss.goal, 'miss', 'goal', goal.name);
        }
    }

    // ----------------------------------------------------------------- sleep
    // ------------------------------------------------------------ milestones
    for (const milestone of input.milestones ?? []) {
        record(dayOf(milestone.doneAt), MARKS.complete.milestone, 'complete', 'milestone', milestone.title, { at: milestone.doneAt });
    }

    for (const day of input.activeDays ?? []) {
        if (day >= floor) record(day, MARKS.complete.exercise, 'complete', 'exercise', 'Exercise goal reached');
    }

    for (const night of input.goodNights ?? []) {
        if (night >= floor) record(night, MARKS.complete.sleep, 'complete', 'sleep', 'A full night’s sleep');
    }
    for (const night of input.shortNights ?? []) {
        if (night >= floor) record(night, MARKS.miss.sleep, 'miss', 'sleep', 'A short night');
    }

    // ------------------------------------------------- misses of deleted things
    for (const penalty of input.kept ?? []) {
        if (penalty.date >= floor && penalty.points < 0) record(penalty.date, penalty.points, 'miss', penalty.item, penalty.title);
    }

    // ---------------------------------------------------------------- series
    const days = [...byDay.keys()].sort();
    const series: { date: string; value: number }[] = [];
    let total = 0;
    let yesterday = 0;
    if (days.length) {
        for (let day = days[0]; day <= today; day = addDays(day, 1)) {
            total += byDay.get(day) ?? 0;
            if (day < today) yesterday = total;
            series.push({ date: day, value: total });
        }
    }
    if (!series.length || series[series.length - 1].date !== today) series.push({ date: today, value: total });

    const counted = events.filter((_, index) => !beyond.has(index));
    const ledger = [...events].sort((a, b) => a.date.localeCompare(b.date) || (a.at ?? 0) - (b.at ?? 0));
    counted.sort((a, b) => b.date.localeCompare(a.date) || b.points - a.points);
    const perfectRun = runs.get(addDays(today, -1)) ?? 0;
    return {
        total,
        multiplier: multiplierOn(today),
        perfectRun: runs.has(today) ? (runs.get(today) ?? 0) : perfectRun,
        todayChange: total - (series.length > 1 ? yesterday : 0),
        series,
        events: counted.filter(event => event.points > 0).slice(0, recent),
        ledger,
    };
}

/**
 * The misses one habit, goal or task has cost so far: what stays on the
 * record when it is deleted.
 */
export function penaltiesOf(input: MarksInput, ids: { habits?: string[]; tasks?: string[] }): KeptPenalty[] {
    const habitIds = new Set(ids.habits ?? []);
    const taskIds = new Set(ids.tasks ?? []);
    if (!habitIds.size && !taskIds.size) return [];
    const only: MarksInput = {
        ...input,
        habits: input.habits.filter(habit => habitIds.has(habit.id)),
        tasks: input.tasks.filter(task => taskIds.has(task.id)),
        goodNights: [], shortNights: [], kept: [],
    };
    return [...computeMarks(only, Number.MAX_SAFE_INTEGER).ledger].reverse()
        // A goal's deadline miss depends on whether it was reached, which only
        // its insights know; goals are left out rather than charged wrongly.
        .filter(event => event.kind === 'miss' && event.item !== 'goal')
        .map(({ date, points, item, title }) => ({ date, points, item, title }));
}
