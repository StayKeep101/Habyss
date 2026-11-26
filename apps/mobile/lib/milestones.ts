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

/** Dropping back under the target clears today's claim, so reaching it again celebrates again. */
export async function releaseDailyTarget(today = localDateKey(new Date())): Promise<void> {
    try {
        if ((await AsyncStorage.getItem(DAILY_TARGET_KEY)) === today) await AsyncStorage.removeItem(DAILY_TARGET_KEY);
    } catch {
        // The worst case is one missed celebration.
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

/**
 * Looks for the day's promise being kept after anything is ticked off.
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
        const { tallyDay, isDayComplete } = require('./dayComplete') as typeof import('./dayComplete');

        const today = localDateKey(new Date());
        const [stored, completions, skipped, data, target] = await Promise.all([
            getHabits(), getCompletions(today), getSkipped(today), loadedData(), getDailyTarget(),
        ]);
        // Read from storage, not the in-memory copy: that one reloads after a change,
        // and reading it first left the promise kept by the task just ticked
        // unannounced until the next tick.
        const { getTasks } = require('./tasks') as typeof import('./tasks');
        const tasks = await getTasks({ includeDone: true }).catch(() => data.tasks);

        // The day's promise: three things, or five.
        //
        // If the same tick also finished every habit due, the whole day is
        // won and that has its own card. Two celebrations stacked on one
        // action is worse than either alone, so the smaller one steps aside —
        // but still claims the day, or it would arrive late on the next tick.
        const focus = dailyFocus(tasks, target, today, today);
        const wholeDay = isDayComplete(tallyDay(stored, completions, skipped, tasks, today, target));
        if (wholeDay) {
            if (focus.done >= target) await claimDailyTarget(today);
            else await releaseDailyTarget(today);
        } else {
            await announceDailyTarget(focus.done, target);
        }
    } catch {
        // A missed celebration is not worth an error.
    }
}
