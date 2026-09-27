import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from './habitsSQLite';
import { evidenceFor, type Evidence } from './proof';

/**
 * Working out how today's completions were actually evidenced.
 *
 * `lib/proof.ts` holds the rule; this is the part that goes and looks. Two
 * signals, both already recorded by the app for its own reasons:
 *
 *   Health   — the habit reads a Health metric, so its value came from the
 *              watch rather than from a keyboard.
 *   Timer    — a focus session ran against that habit today.
 *
 * Everything else is `self`, which is most things and is not a complaint.
 */

const SESSION_PREFIX = 'focus_session_';

/** Habit ids that had a focus session today, read from the sessions the timer saves. */
export async function timedToday(day: string): Promise<Set<string>> {
    const timed = new Set<string>();
    try {
        const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(SESSION_PREFIX));
        if (keys.length === 0) return timed;
        for (const [, raw] of await AsyncStorage.multiGet(keys)) {
            if (!raw) continue;
            try {
                const session = JSON.parse(raw);
                // A session that was abandoned is not evidence of anything.
                if (session?.date === day && session?.habit_id && session?.completed !== false) {
                    timed.add(String(session.habit_id));
                }
            } catch {
                // One unreadable session should not cost the others.
            }
        }
    } catch {
        // No sessions readable: nothing is timed, which is a safe answer.
    }
    return timed;
}

/** True when this habit's value comes from Health rather than from a tap. */
export const readsHealth = (habit: Habit): boolean => !!habit.healthKitMetric;

/**
 * The evidence for each habit completed today.
 *
 * Keyed by habit id so a caller can show a badge per row, and reducible with
 * `strongest`/`describeDay` for a single line about the day.
 */
export async function evidenceToday(
    habits: Habit[],
    completedIds: string[],
    day: string,
): Promise<Record<string, Evidence>> {
    const timed = await timedToday(day);
    const byId = new Map(habits.map(habit => [habit.id, habit]));

    const out: Record<string, Evidence> = {};
    for (const id of completedIds) {
        const habit = byId.get(id);
        if (!habit) continue;
        out[id] = evidenceFor({ fromHealth: readsHealth(habit), timed: timed.has(id) });
    }
    return out;
}

/** The same, flattened — what the feed and the day summary read. */
export async function evidenceListToday(
    habits: Habit[],
    completedIds: string[],
    day: string,
): Promise<Evidence[]> {
    return Object.values(await evidenceToday(habits, completedIds, day));
}
