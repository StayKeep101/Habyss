import { useEffect, useRef, useState } from 'react';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { useData } from '@/hooks/useData';
import { streakFrom } from '@/lib/dayComplete';
import { buildDayCard, sameCard, type DayCardData } from '@/lib/dayCard';
import { FeedService } from '@/lib/feedService';
import { dayMoments } from '@/lib/dayMoments';
import { currentFocusRecords, loadFocusRecords, subscribeFocusRecords } from '@/lib/focusStats';

/** Waits for a burst of ticks to settle before writing, so one card goes up, not ten. */
const SETTLE_MS = 4000;

/**
 * Keeps today's day card current. Friends' stats are read from it, and the
 * server posts it to the feed at the time you chose. Mounted once, under the tabs.
 */
export function useDayCardPublisher() {
    const data = useData();
    const [habits, setHabits] = useState<Habit[] | null>(null);
    const last = useRef<{ day: string; card: DayCardData } | null>(null);

    useEffect(() => {
        let stop: (() => void) | undefined;
        void subscribeToHabits(setHabits).then(unsubscribe => { stop = unsubscribe; });
        return () => stop?.();
    }, []);

    // Focus sessions, for the Chronos facts on the card.
    const [focusTick, setFocusTick] = useState(0);
    useEffect(() => {
        void loadFocusRecords().then(() => setFocusTick(tick => tick + 1)).catch(() => undefined);
        return subscribeFocusRecords(() => setFocusTick(tick => tick + 1));
    }, []);

    useEffect(() => {
        if (!habits || !data.tasksLoaded || !data.historyLoaded) return;
        const timer = setTimeout(() => {
            const { streak, completedDates } = streakFrom(habits, data.tasks, data.history, data.skips, data.today);
            const card = {
                ...buildDayCard({ habits, tasks: data.tasks, history: data.history, skips: data.skips, day: data.today, streak }),
                // What made today stand out: a comeback, a best, a milestone, the focus (lib/dayMoments.ts).
                ...dayMoments({ today: data.today, streak, completedDates, focus: currentFocusRecords() }),
            };
            if (last.current?.day === data.today && sameCard(last.current.card, card)) return;
            void FeedService.publishDayCard(data.today, card).then(result => {
                if (result === 'saved') last.current = { day: data.today, card };
            });
        }, SETTLE_MS);
        return () => clearTimeout(timer);
    }, [habits, data, focusTick]);
}
