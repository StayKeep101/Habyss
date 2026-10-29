import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { createHabitRequirement, isHabitScheduledForDate, isQuotaHabit, localDateKey } from './habitSchedule';
import { DEFAULT_TARGET, doneOnDay, type DailyTarget } from './dailyFocus';
import { tasksForDay } from './tasks';
import { emit } from './appEvents';
import { counts, countedHistory, countedTasks } from './sharedGate';

/**
 * Whether everything the day asked for is done.
 *
 * Habits scheduled today and tasks due today, counted together. A skipped
 * habit is not part of the day, because the user already decided about it.
 * A day that asked for nothing is not an achievement, so it never counts.
 */
export interface DayTally { done: number; total: number; habits: number; tasks: number }

export function tallyDay(
    habits: Habit[],
    completions: Record<string, boolean>,
    skipped: Record<string, boolean>,
    tasks: Task[],
    today: string,
    target: DailyTarget = DEFAULT_TARGET,
): DayTally {
    const date = new Date(`${today}T12:00:00`);
    // A "3 times a week" habit is part of the day once it cannot wait, or when done today.
    const due = habits.filter(habit => {
        if (habit.isGoal || habit.isArchived || skipped[habit.id] || !isHabitScheduledForDate(habit, date)) return false;
        return !isQuotaHabit(habit) || completions[habit.id] || createHabitRequirement(habit)(today);
    });

    // The task half of a day is the promise the user made — three things, or
    // five — not every task that happens to carry today's date. Those were two
    // different definitions of a finished day, and they disagreed: the card
    // could say the day was won while the streak said it was lost.
    // A shared habit or task you have done counts only once everybody on it
    // has (lib/sharedGate.ts): until then the day's circle does not move for it.
    const counted = countedTasks(tasks);
    const finished = counted.filter(task => doneOnDay(task, today)).length;
    const open = tasksForDay(counted, today, today).filter(task => task.status === 'open').length;
    // Nobody can be asked for work that does not exist, so a day with only one
    // task on it asks for one, and finishing it keeps the day.
    const asked = Math.min(target, finished + open);

    return {
        habits: due.length,
        tasks: asked,
        total: due.length + asked,
        done: due.filter(habit => completions[habit.id] && counts(habit.id, today)).length + Math.min(finished, asked),
    };
}

export const isDayComplete = (tally: DayTally): boolean => tally.total > 0 && tally.done >= tally.total;

/**
 * The run of finished days ending today, and which days those were.
 *
 * A day with nothing scheduled neither adds to the run nor breaks it: the app
 * cannot ask for credit for a day it asked nothing of, and it must not punish
 * one either.
 */
/**
 * The streak: days in a row on which you finished at least one thing.
 *
 * One habit or one task is enough. It used to need the whole day — every habit
 * plus the 3 (or 5) tasks — which made a single slip end a month-long run and
 * gave nothing back for showing up on a hard day. Each habit still keeps its
 * own streak; this one is about coming back.
 *
 * Today joins the run the moment something is done, and an empty today does
 * not break it until the day is over. Skipping is not doing.
 */
export function streakFrom(
    habits: Habit[],
    tasks: Task[],
    history: Record<string, string[]>,
    skips: Record<string, string[]>,
    today: string,
    back?: number,
    _target: DailyTarget = DEFAULT_TARGET,
    /** Days a streak freeze covered: they keep the run going without adding to it. */
    frozen: Set<string> = (require('./streakFreeze') as typeof import('./streakFreeze')).frozenDays(),
): { streak: number; completedDates: string[] } {
    // A shared habit or task counts only once everybody on it has done it.
    history = countedHistory(history);
    tasks = countedTasks(tasks);
    const known = new Set(habits.filter(habit => !habit.isGoal).map(habit => habit.id));
    const completedDates: string[] = [];
    let streak = 0;
    let counting = true;
    // As far back as anything was recorded. It used to stop at 70 days, so a
    // run longer than that read as 70 on every screen.
    // The days a task was finished, worked out once rather than per day.
    const taskDays = new Set<string>();
    for (const task of tasks) {
        if (task.status !== 'done' || !task.completedAt) continue;
        const when = new Date(task.completedAt);
        taskDays.add(Number.isFinite(when.getTime()) ? localDateKey(when) : task.completedAt.slice(0, 10));
    }
    const earliest = [...Object.keys(history), ...Object.keys(skips), ...taskDays].sort()[0] ?? today;
    const limit = back ?? Math.max(1, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${earliest}T12:00:00`).getTime()) / 86400000) + 1);

    for (let offset = 0; offset < limit; offset++) {
        const date = new Date(`${today}T12:00:00`);
        date.setDate(date.getDate() - offset);
        const day = localDateKey(date);
        const skipped = new Set(skips[day] ?? []);
        const did = (history[day] ?? []).some(id => known.has(id) && !skipped.has(id))
            || taskDays.has(day);

        if (did) {
            completedDates.push(day);
            if (counting) streak++;
        } else if (offset > 0 && !frozen.has(day)) {
            counting = false;
        }
    }

    return { streak, completedDates };
}

/**
 * The longest run ever kept: the most days in a row with something done,
 * from the same days `streakFrom` counts. For the profile.
 */
export function bestStreakFrom(completedDates: string[]): number {
    const days = [...new Set(completedDates)].sort();
    let best = 0;
    let run = 0;
    let previous: number | null = null;
    for (const day of days) {
        const at = Math.round(new Date(`${day}T12:00:00`).getTime() / 86400000);
        run = previous !== null && at - previous === 1 ? run + 1 : 1;
        best = Math.max(best, run);
        previous = at;
    }
    return best;
}

const KEY = 'habyss_day_celebrated';

/** True the first time a day counts towards the streak, and never again that day. */
export async function claimCelebration(today = localDateKey(new Date())): Promise<boolean> {
    try {
        if ((await AsyncStorage.getItem(KEY)) === today) return false;
        await AsyncStorage.setItem(KEY, today);
        return true;
    } catch {
        return false;
    }
}

/**
 * Checks the day after anything is ticked off, and announces the streak the
 * first time something is finished that day. Quiet on any failure: a celebration is never worth
 * an error in front of the user.
 */
export async function checkDayComplete(): Promise<void> {
    try {
        const { getHabits, getCompletions, getSkipped } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { loadedData } = require('./dataStore') as typeof import('./dataStore');
        const today = localDateKey(new Date());
        const { getDailyTarget } = require('./dailyFocus') as typeof import('./dailyFocus');
        const [habits, completions, skipped, data, target] = await Promise.all([
            getHabits(), getCompletions(today), getSkipped(today), loadedData(), getDailyTarget(),
        ]);
        // From storage, not the in-memory copy, which reloads after a change: the
        // task just ticked counts on this pass, not the next.
        const { getTasks } = require('./tasks') as typeof import('./tasks');
        const tasks = await getTasks({ includeDone: true }).catch(() => data.tasks);
        const tally = tallyDay(habits, completions, skipped, tasks, today, target);
        // The first thing finished keeps the streak, so that is the moment
        // worth marking, not the last. Cheap check first, before any history.
        // Today counts the way the streak counts it (a shared habit once
        // everybody on it has done it), so the card never says 0: it shows when
        // today has really joined the run, with the run it made.
        const history: Record<string, string[]> = { ...data.history };
        const skips: Record<string, string[]> = { ...data.skips };
        history[today] = Object.keys(completions).filter(id => completions[id]);
        skips[today] = Object.keys(skipped).filter(id => skipped[id]);
        const run = streakFrom(habits, tasks, history, skips, today, undefined, target);
        if (!run.completedDates.includes(today) || run.streak < 1) return;
        if (!(await claimCelebration(today))) return;
        emit('day_complete', { tally, ...run });
    } catch {
        // Nothing to celebrate is not an error.
    }
}

/** The longest run of days in a row among these dates (YYYY-MM-DD, any order): your best streak. */
export function longestRun(dates: string[]): number {
    const sorted = [...new Set(dates)].sort();
    let best = 0;
    let run = 0;
    let previous: string | null = null;
    for (const date of sorted) {
        const next = previous ? new Date(`${previous}T12:00:00`) : null;
        next?.setDate(next.getDate() + 1);
        const follows = next && `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}` === date;
        run = follows ? run + 1 : 1;
        best = Math.max(best, run);
        previous = date;
    }
    return best;
}
