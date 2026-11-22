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
import { rememberDayCard } from '@/lib/dayCardLatest';
import { loadTickPhotos, onTickPhotos, tickPhotoUrl } from '@/lib/tickPhotos';
import { dayNote, loadDayNotes, subscribeDayNotes } from '@/lib/dayNote';

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

    // Photos of what was ticked: the card is sent again once one has uploaded.
    const [photoTick, setPhotoTick] = useState(0);
    useEffect(() => {
        void loadTickPhotos().then(() => setPhotoTick(tick => tick + 1)).catch(() => undefined);
        return onTickPhotos(() => setPhotoTick(tick => tick + 1));
    }, []);

    // Your note on the day: the card goes again when you write it.
    const [noteTick, setNoteTick] = useState(0);
    useEffect(() => {
        void loadDayNotes().then(() => setNoteTick(tick => tick + 1)).catch(() => undefined);
        return subscribeDayNotes(() => setNoteTick(tick => tick + 1));
    }, []);

    // Focus sessions, for the Chronos facts on the card.
    const [focusTick, setFocusTick] = useState(0);
    useEffect(() => {
        void loadFocusRecords().then(() => setFocusTick(tick => tick + 1)).catch(() => undefined);
        return subscribeFocusRecords(() => setFocusTick(tick => tick + 1));
    }, []);

    useEffect(() => {
        if (!habits || !data.tasksLoaded || !data.historyLoaded) return;
        const timer = setTimeout(() => { void (async () => {
            const { streak, completedDates } = streakFrom(habits, data.tasks, data.history, data.skips, data.today);
            // For the deck a friend swipes through: when each was done, and what counted it.
            const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
            const at = new Map<string, string>();
            try {
                const { getCompletionTicks } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
                for (const tick of await getCompletionTicks(1)) if (tick.date === data.today) at.set(tick.habitId, hhmm(tick.at));
            } catch { /* no times, still a card */ }
            for (const task of data.tasks) if (task.completedAt && task.completedAt.slice(0, 10) <= data.today) at.set(task.id, hhmm(task.completedAt));
            const tracked = new Map<string, NonNullable<import('@/lib/dayCard').DayCardLine['tracked']>>();
            try {
                const { getHabitMeasurement } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
                const { getAppTime, appTimeProgress } = require('@/lib/appTime') as typeof import('@/lib/appTime');
                const apps = await getAppTime();
                for (const habit of habits) {
                    if (habit.isGoal || habit.isArchived) continue;
                    if (apps[habit.id]) {
                        const minutes = await appTimeProgress(habit.id);
                        if (minutes !== null) tracked.set(habit.id, { value: minutes, target: apps[habit.id], unit: 'min', source: 'in its apps' });
                        continue;
                    }
                    if (!habit.healthKitMetric && habit.trackingMethod !== 'numeric') continue;
                    const target = habit.healthKitTarget || habit.goalValue || 1;
                    const value = await getHabitMeasurement(habit.id, target, data.today).catch(() => 0);
                    if (value > 0) tracked.set(habit.id, { value, target, unit: habit.unit && habit.unit !== 'time' ? habit.unit : '', source: habit.healthKitMetric ? 'Apple Health' : undefined });
                }
            } catch { /* tracked values are extra */ }
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
                        photoOf: id => tickPhotoUrl(id, day),
                        trackedOf: id => tracked.get(id),
                        atOf: id => at.get(id),
                        // Today's 3 (or 5), the tasks that mattered most (lib/dailyFocus.ts).
                        top: dailyFocus(data.tasks, target, day, day).rows.slice(0, target).map(task => task.id),
                    },
                }),
                // What made today stand out: a comeback, a best, a milestone, the focus (lib/dayMoments.ts).
                ...dayMoments({ today: data.today, streak, completedDates, focus: currentFocusRecords() }),
                ...(dayNote(day) ? { note: dayNote(day) } : null),
            };
            // Kept for the Developer page's preview (lib/dayCardLatest.ts).
            rememberDayCard(data.today, card);
            if (last.current?.day === data.today && sameCard(last.current.card, card)) return;
            void FeedService.publishDayCard(data.today, card).then(result => {
                if (result === 'saved') last.current = { day: data.today, card };
            });
        })(); }, SETTLE_MS);
        return () => clearTimeout(timer);
    }, [habits, data, focusTick, target, names, photoTick, noteTick]);
}
