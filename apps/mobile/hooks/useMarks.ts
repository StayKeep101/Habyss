import { useDeferredValue, useMemo } from 'react';
import { useSleep } from '@/hooks/useSleep';
import { goodNights, shortNights } from '@/lib/sleepLog';
import { useActivity } from '@/hooks/useActivity';
import { activeDays } from '@/lib/activityLog';
import type { DayData } from '@/hooks/useDayData';
import { computeMarks, rankFor, type MarksResult } from '@/lib/marks';
import { useMarksKept } from '@/hooks/useMarksKept';
import { useDailyTarget } from '@/hooks/useDailyFocus';

export type Marks = MarksResult & ReturnType<typeof rankFor>;

/**
 * Your Marks, from the same data Home already holds, so nothing is read twice
 * and the number moves the instant something is ticked.
 */
export function useMarks(data: Pick<DayData, 'habits' | 'tasks' | 'history' | 'skips' | 'today'>): Marks {
    // Marks read the whole history (about 20 ms on a laptop, several times that
    // on a phone), so they follow a tick in a low-priority render: the tick is
    // drawn first and the number catches up a moment later, never in its way.
    const habits = useDeferredValue(data.habits);
    const tasks = useDeferredValue(data.tasks);
    const history = useDeferredValue(data.history);
    const skips = useDeferredValue(data.skips);
    const today = data.today;
    // Sleep counts too: +5 for a night at your goal, −5 for one short of it (lib/sleepLog.ts).
    const sleep = useSleep();
    const nights = goodNights(sleep).sort().join(',');
    const short = shortNights(sleep).sort().join(',');
    // Days you reached your exercise goal: +20 each (lib/activityLog.ts).
    const activity = useActivity();
    const moved = activeDays(activity).sort().join(',');
    // Misses of deleted things still count: deleting is break-even, not a way up.
    const kept = useMarksKept();
    // Today's 3 (or 5): +10 a day for finishing them, times the run multiplier.
    const dailyTarget = useDailyTarget();
    return useMemo(() => {
        const result = computeMarks({ habits, tasks, history, skips, goodNights: nights ? nights.split(',') : [], shortNights: short ? short.split(',') : [], activeDays: moved ? moved.split(',') : [], kept, dailyTarget, today });
        return { ...result, ...rankFor(result.total) };
    }, [habits, tasks, history, skips, today, nights, short, moved, kept, dailyTarget]);
}
