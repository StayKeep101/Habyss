import { localDateKey } from './habitSchedule';
import { removeHabitEverywhere, setSkipped, updateHabit, type Habit } from './habitsSQLite';

/**
 * Taking a repeating habit away, the three ways people mean it: just today
 * (a skip, never counted as a miss), from today on (it ends yesterday, so
 * every day already kept still counts in streaks and stats), or everything,
 * history included. Lists show a habit only on the days it is due, so an
 * ended habit leaves every screen from today without touching the past.
 */
export type HabitRemoval = 'today' | 'from-today' | 'everything';

/** The last day a habit stopped "from today" was due: yesterday. */
export function endDateFromToday(now = new Date()): string {
    return localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12));
}

/** Ending it yesterday would leave nothing to keep when it began today. */
export function hasHistoryToKeep(habit: Pick<Habit, 'startDate' | 'createdAt'>, now = new Date()): boolean {
    const began = (habit.startDate || habit.createdAt || '').slice(0, 10);
    return !!began && began < localDateKey(now);
}

export async function removeHabit(habit: Pick<Habit, 'id'>, how: HabitRemoval, now = new Date()): Promise<void> {
    if (how === 'today') return setSkipped(habit.id, true, localDateKey(now));
    if (how === 'from-today') return updateHabit({ id: habit.id, endDate: endDateFromToday(now) });
    return removeHabitEverywhere(habit.id);
}
