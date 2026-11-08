import { useEffect, useRef, useState } from 'react';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { useData } from '@/hooks/useData';
import { streakFrom } from '@/lib/dayComplete';
import { buildDayCard, sameCard, type DayCardData } from '@/lib/dayCard';
import { FeedService } from '@/lib/feedService';
import { dayMoments } from '@/lib/dayMoments';
import { currentFocusRecords, loadFocusRecords, subscribeFocusRecords } from '@/lib/focusStats';
import { counts, othersOn } from '@/lib/sharedGate';
import { dailyFocus } from '@/lib/dailyFocus';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { FriendsService } from '@/lib/friendsService';

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
    const target = useDailyTarget();
    // Friends' first names, for "with Sam" beside a shared line. Read once.
    const [names, setNames] = useState<Record<string, string>>({});
    useEffect(() => {
        void FriendsService.getFriends().then(friends => setNames(Object.fromEntries(friends.map(friend =>
            [friend.userId, (friend.displayName || friend.username).split(' ')[0]])))).catch(() => undefined);
    }, []);

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
            const day = data.today;
            // Minutes focused on each thing today, from the focus sessions.
            const minutes = new Map<string, number>();
            for (const record of currentFocusRecords()) {
                if (record.date === day) minutes.set(record.itemId, (minutes.get(record.itemId) ?? 0) + record.seconds / 60);
            }
            const card = {
                ...buildDayCard({
                    habits, tasks: data.tasks, history: data.history, skips: data.skips, day, streak,
                    facts: {
                        minutesOf: id => minutes.get(id) ?? 0,
                        withOf: id => othersOn(id).flatMap(person => (names[person] ? [names[person]] : [])),
                        waitingOf: id => !counts(id, day),
                        // Today's 3 (or 5), the tasks that mattered most (lib/dailyFocus.ts).
                        top: dailyFocus(data.tasks, target, day, day).rows.slice(0, target).map(task => task.id),
                    },
                }),
                // What made today stand out: a comeback, a best, a milestone, the focus (lib/dayMoments.ts).
                ...dayMoments({ today: data.today, streak, completedDates, focus: currentFocusRecords() }),
            };
            if (last.current?.day === data.today && sameCard(last.current.card, card)) return;
            void FeedService.publishDayCard(data.today, card).then(result => {
                if (result === 'saved') last.current = { day: data.today, card };
            });
        }, SETTLE_MS);
        return () => clearTimeout(timer);
    }, [habits, data, focusTick, target, names]);
}
