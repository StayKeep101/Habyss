import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import { DEFAULT_TARGET, doneOnDay, type DailyTarget } from './dailyFocus';
import { tasksForDay } from './tasks';
import { emit } from './appEvents';

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
    const due = habits.filter(habit =>
        !habit.isGoal && !habit.isArchived && !skipped[habit.id] && isHabitScheduledForDate(habit, date));

    // The task half of a day is the promise the user made — three things, or
    // five — not every task that happens to carry today's date. Those were two
    // different definitions of a finished day, and they disagreed: the card
    // could say the day was won while the streak said it was lost.
    const finished = tasks.filter(task => doneOnDay(task, today)).length;
    const open = tasksForDay(tasks, today, today).filter(task => task.status === 'open').length;
    // Nobody can be asked for work that does not exist, so a day with only one
    // task on it asks for one, and finishing it keeps the day.
    const asked = Math.min(target, finished + open);

    return {
        habits: due.length,
        tasks: asked,
        total: due.length + asked,
        done: due.filter(habit => completions[habit.id]).length + Math.min(finished, asked),
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
    back = 70,
    _target: DailyTarget = DEFAULT_TARGET,
): { streak: number; completedDates: string[] } {
    const known = new Set(habits.filter(habit => !habit.isGoal).map(habit => habit.id));
    const completedDates: string[] = [];
    let streak = 0;
    let counting = true;

    for (let offset = 0; offset < back; offset++) {
        const date = new Date(`${today}T12:00:00`);
        date.setDate(date.getDate() - offset);
        const day = localDateKey(date);
        const skipped = new Set(skips[day] ?? []);
        const did = (history[day] ?? []).some(id => known.has(id) && !skipped.has(id))
            || tasks.some(task => doneOnDay(task, day));

        if (did) {
            completedDates.push(day);
            if (counting) streak++;
        } else if (offset > 0) {
            counting = false;
        }
    }

    return { streak, completedDates };
}

const KEY = 'habyss_day_celebrated';

/** True the first time a day is finished, and never again that day. */
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
 * Checks the day after anything is ticked off, and announces it the first
 * time everything is done. Quiet on any failure: a celebration is never worth
 * an error in front of the user.
 */
export async function checkDayComplete(): Promise<void> {
    try {
        const { getHabits, getCompletions, getSkipped, getLastNDaysCompletions } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { getTasks } = require('./tasks') as typeof import('./tasks');
        const today = localDateKey(new Date());
        const { getDailyTarget } = require('./dailyFocus') as typeof import('./dailyFocus');
        const [habits, completions, skipped, tasks, target] = await Promise.all([
            getHabits(), getCompletions(today), getSkipped(today), getTasks({ includeDone: true }), getDailyTarget(),
        ]);
        const tally = tallyDay(habits, completions, skipped, tasks, today, target);
        if (!isDayComplete(tally)) return;
        if (!(await claimCelebration(today))) return;

        // The card shows the run this day just extended.
        const rows = await getLastNDaysCompletions(70).catch(() => []);
        const history: Record<string, string[]> = {};
        const skips: Record<string, string[]> = {};
        for (const row of rows) {
            history[row.date] = row.completedIds;
            if (row.skippedIds?.length) skips[row.date] = row.skippedIds;
        }
        history[today] = Object.keys(completions).filter(id => completions[id]);
        skips[today] = Object.keys(skipped).filter(id => skipped[id]);

        const run = streakFrom(habits, tasks, history, skips, today, 70, target);
        emit('day_complete', { tally, ...run });
    } catch {
        // Nothing to celebrate is not an error.
    }
}
