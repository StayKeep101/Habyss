import { useEffect, useRef, useState } from 'react';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { useData } from '@/hooks/useData';
import { streakFrom } from '@/lib/dayComplete';
import { buildDayCard, sameCard, type DayCardData } from '@/lib/dayCard';
import { FeedService } from '@/lib/feedService';

/** Waits for a burst of ticks to settle before writing, so one card goes up, not ten. */
const SETTLE_MS = 4000;

/**
 * Keeps today's day card current until it is posted to the feed at the time
 * you chose (the server posts it). Mounted once, under the tabs.
 */
export function useDayCardPublisher() {
    const data = useData();
    const [habits, setHabits] = useState<Habit[] | null>(null);
    const last = useRef<{ day: string; card: DayCardData } | null>(null);
    const posted = useRef<string | null>(null);

    useEffect(() => {
        let stop: (() => void) | undefined;
        void subscribeToHabits(setHabits).then(unsubscribe => { stop = unsubscribe; });
        return () => stop?.();
    }, []);

    useEffect(() => {
        if (!habits || !data.tasksLoaded || !data.historyLoaded) return;
        const timer = setTimeout(() => {
            const { streak } = streakFrom(habits, data.tasks, data.history, data.skips, data.today);
            const card = buildDayCard({ habits, tasks: data.tasks, history: data.history, skips: data.skips, day: data.today, streak });
            if (posted.current === data.today) return;
            if (last.current?.day === data.today && sameCard(last.current.card, card)) return;
            void FeedService.publishDayCard(data.today, card).then(result => {
                if (result === 'saved') last.current = { day: data.today, card };
                // Posted is published: stop sending updates for today.
                if (result === 'posted') posted.current = data.today;
            });
        }, SETTLE_MS);
        return () => clearTimeout(timer);
    }, [habits, data]);
}
