import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';
import { emit } from './appEvents';

/**
 * The moments worth stopping for, and the promise that each is stopped for
 * once.
 *
 * A celebration that fires twice is worse than one that never fires: the first
 * time it means something, the second time it tells you the app is not paying
 * attention. Every milestone here is claimed before it is announced, and a
 * claim that has already been made is silently refused.
 *
 * Failure is always silent. Nothing here is worth an error in front of someone
 * who has just done something well.
 */

const DAILY_TARGET_KEY = 'habyss_focus_celebrated';
const GOAL_KEY = 'habyss_goal_celebrated';

/** True the first time today's promise is kept, and never again that day. */
export async function claimDailyTarget(today = localDateKey(new Date())): Promise<boolean> {
    try {
        if ((await AsyncStorage.getItem(DAILY_TARGET_KEY)) === today) return false;
        await AsyncStorage.setItem(DAILY_TARGET_KEY, today);
        return true;
    } catch {
        return false;
    }
}

/** The goals already celebrated, so finishing one is announced exactly once. */
/** Dropping back under the target clears today's claim, so reaching it again celebrates again. */
export async function releaseDailyTarget(today = localDateKey(new Date())): Promise<void> {
    try {
        if ((await AsyncStorage.getItem(DAILY_TARGET_KEY)) === today) await AsyncStorage.removeItem(DAILY_TARGET_KEY);
    } catch {
        // The worst case is one missed celebration.
    }
}

async function celebratedGoals(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(GOAL_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

/**
 * True the first time this goal is finished.
 *
 * Progress can cross a hundred, fall back when a habit is un-ticked, and cross
 * again; the goal is still the same goal finished once.
 */
export async function claimGoal(goalId: string): Promise<boolean> {
    if (!goalId) return false;
    try {
        const already = await celebratedGoals();
        if (already.includes(goalId)) return false;
        // Bounded: the tail is only there to stop a re-finish announcing again.
        await AsyncStorage.setItem(GOAL_KEY, JSON.stringify([...already, goalId].slice(-200)));
        return true;
    } catch {
        return false;
    }
}

/** Lets a deleted or reopened goal be celebrated again if it is finished again. */
export async function forgetGoal(goalId: string): Promise<void> {
    try {
        const already = await celebratedGoals();
        if (!already.includes(goalId)) return;
        await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(already.filter(id => id !== goalId)));
    } catch {
        // Nothing to do; the worst case is one missed celebration.
    }
}

/**
 * Announces the day's promise being kept, each time the day reaches it: a
 * task unticked and ticked again (or swapped for another) gets the moment
 * again, rather than only the first time today.
 *
 * This is the smaller of the two moments — three things, or five — and it is
 * deliberately separate from finishing the whole day, which also asks for
 * every habit.
 */
export async function announceDailyTarget(done: number, target: number): Promise<void> {
    if (target <= 0) return;
    if (done < target) { await releaseDailyTarget(); return; }
    if (!(await claimDailyTarget())) return;
    emit('daily_target_reached', { done, target });
}

/** A goal no longer reached (read again, see lib/goalFinish.ts): reaching it later is celebrated afresh. */
export async function releaseGoal(goalId: string): Promise<void> {
    try {
        const already = await celebratedGoals();
        if (already.includes(goalId)) await AsyncStorage.setItem(GOAL_KEY, JSON.stringify(already.filter(id => id !== goalId)));
    } catch { /* a celebration missed or repeated is not worth an error */ }
}

/** Announces a goal being finished, the first time it is; `count` is how many goals are done now, this one included. */
export async function announceGoalComplete(goalId: string, name: string, count?: number): Promise<void> {
    if (!(await claimGoal(goalId))) return;
    emit('goal_complete', { goalId, name, ...(count ? { count } : null) });
}

/**
 * Looks for either milestone after anything is ticked off.
 *
 * Run from the same place the day is checked, so one pass over the data
 * answers every "has something just been finished" question the app has.
 * Quiet on any failure.
 */
export async function checkMilestones(): Promise<void> {
    try {
        const { getHabits, getCompletions, getSkipped } =
            require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { loadedData } = require('./dataStore') as typeof import('./dataStore');
        const { getDailyTarget, dailyFocus } = require('./dailyFocus') as typeof import('./dailyFocus');
        const { buildGoalInsights, goalCompletedOn, goalDoneOn } = require('./goalInsights') as typeof import('./goalInsights');
        const { finishGoal, rereadSpec } = require('./goalFinish') as typeof import('./goalFinish');
        const { currentGoalLogs } = require('./goalLogs') as typeof import('./goalLogs');
        const { tallyDay, isDayComplete } = require('./dayComplete') as typeof import('./dayComplete');

        const today = localDateKey(new Date());
        const [stored, completions, skipped, data, target] = await Promise.all([
            getHabits(), getCompletions(today), getSkipped(today), loadedData(), getDailyTarget(),
        ]);
        const tasks = data.tasks;

        // Goals written before "reach it" and "add it up" were told apart (a
        // 7 CGPA, a 10 km run) are read again from their words, once: the
        // latest or best number counts, and whether it is reached is asked again.
        const { updateHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const habits = await Promise.all(stored.map(async habit => {
            if (!habit.isGoal || habit.isArchived) return habit;
            const goalSpec = rereadSpec(habit);
            if (!goalSpec) return habit;
            await updateHabit({ id: habit.id, goalSpec }).catch(() => undefined);
            await releaseGoal(habit.id);
            return { ...habit, goalSpec };
        }));

        // The day's promise: three things, or five.
        //
        // If the same tick also finished every habit due, the whole day is
        // won and that has its own card. Two celebrations stacked on one
        // action is worse than either alone, so the smaller one steps aside —
        // but still claims the day, or it would arrive late on the next tick.
        const focus = dailyFocus(tasks, target, today, today);
        const wholeDay = isDayComplete(tallyDay(habits, completions, skipped, tasks, today, target));
        if (wholeDay) {
            if (focus.done >= target) await claimDailyTarget(today);
            else await releaseDailyTarget(today);
        } else {
            await announceDailyTarget(focus.done, target);
        }

        const goals = habits.filter(habit => habit.isGoal && !habit.isArchived);
        if (goals.length === 0) return;

        // The whole shared history, the same span the goal's own page reads.
        const history: Record<string, string[]> = { ...data.history };
        const skips: Record<string, string[]> = { ...data.skips };
        history[today] = Object.keys(completions).filter(id => completions[id]);
        skips[today] = Object.keys(skipped).filter(id => skipped[id]);

        // Read the way every goal screen reads it (logs included), so the
        // count here is the count on the profile.
        const logs = currentGoalLogs();
        const doneOn = new Map<string, string>();
        for (const goal of habits.filter(habit => habit.isGoal)) {
            const on = goalDoneOn(buildGoalInsights({ goal, habits, tasks, history, skips, logs: logs[goal.id], today }), goal);
            if (on) doneOn.set(goal.id, on);
        }
        const doneIds = [...doneOn.keys()];
        for (const goal of goals) {
            const on = doneOn.get(goal.id);
            if (!on) continue;
            // Reached: written onto the goal, so it stays done whatever happens
            // next, and its habits and open tasks are let go for other goals.
            if (!goalCompletedOn(goal) || habits.some(habit => habit.goalId === goal.id && !habit.isGoal)) {
                await finishGoal(goal, goalCompletedOn(goal) ?? on, habits, tasks).catch(() => undefined);
            }
            await announceGoalComplete(goal.id, goal.name, doneIds.length);
        }
    } catch {
        // A missed celebration is not worth an error.
    }
}
