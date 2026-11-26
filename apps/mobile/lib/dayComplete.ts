import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';
import { emit } from './appEvents';
// Shared with the Mac: packages/core/src/dayComplete.ts (the rules). What stays here is the phone's own part.
import { setKeptDaysSource, streakFrom, tallyDay } from '@habyss/core/dayComplete';
export * from '@habyss/core/dayComplete';

// The days that keep a run without adding to it, from this phone: those a freeze covered, and time off.
setKeptDaysSource(() => ({
    freezes: (require('./streakFreeze') as typeof import('./streakFreeze')).frozenDays(),
    off: (require('./timeOff') as typeof import('./timeOff')).offDays(),
}));

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
