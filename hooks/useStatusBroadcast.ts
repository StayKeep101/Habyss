import { useEffect } from 'react';
import { AppState } from 'react-native';
import { FeedService } from '@/lib/feedService';
import { HEARTBEAT_MS } from '@/lib/presence';
import { getDayWindow } from '@/lib/echo';
import { announceChange } from '@/lib/livePulse';
import { hostOf, linkTo, linkedHost, setFocusWith } from '@/lib/focusTogether';
import { peekFocusEnd, peekFocusTimeLeft, useFocusSession } from '@/context/FocusTimeContext';

/**
 * Tells friends whether you are here: "live" while the app is open (refreshed
 * every few minutes, so a phone that dies does not stay live), "away" when it
 * goes to the background. Your time zone and sleep window ride along, so
 * friends see you as asleep at your bedtime, not theirs. Mounted once.
 */
export function useStatusBroadcast() {
    useEffect(() => {
        let beat: ReturnType<typeof setInterval> | null = null;

        const live = async () => {
            const day = await getDayWindow().catch(() => null);
            await FeedService.setStatus({
                presence: 'live',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                ...(day ? { wakeTime: day.wake, sleepTime: day.sleep } : {}),
            }).catch(() => undefined);
        };
        const start = () => {
            void live().then(() => announceChange());
            if (!beat) beat = setInterval(() => { void live(); }, HEARTBEAT_MS);
        };
        const stop = () => {
            if (beat) { clearInterval(beat); beat = null; }
            void FeedService.setStatus({ presence: 'away' }).catch(() => undefined);
        };

        if (AppState.currentState === 'active') start();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') start();
            else if (state === 'background') stop();
        });
        return () => { subscription.remove(); if (beat) clearInterval(beat); };
    }, []);
}

/**
 * "Locked in" while a focus session runs: written when it starts, pauses or
 * ends, never every second. A session joined from a friend also says whose
 * it is, so they see you beside them. A flow session has no end, so it is
 * given two hours and renewed when it is resumed.
 */
export function useFocusStatus() {
    // The session only: this runs in the tab layout, which must not redraw every second.
    const focus = useFocusSession();
    const running = focus.isRunning && !focus.isPaused;
    // A session over (not paused): any "together" it had ends with it.
    const over = !focus.isRunning && !focus.isPaused;
    useEffect(() => { if (over) linkTo(null); }, [over, focus.activeHabitId]);
    useEffect(() => {
        const seconds = focus.activeMode === 'flow' ? 2 * 3600 : peekFocusTimeLeft() || focus.totalDuration;
        // The countdown's own end, to the millisecond, so a friend who joins
        // ends on the same second; a stopwatch has none, so two hours from now.
        const exact = focus.activeMode === 'flow' ? null : peekFocusEnd();
        const until = running ? new Date(exact ?? Date.now() + Math.max(60, seconds) * 1000).toISOString() : null;
        void FeedService.setStatus({ focusUntil: until, focusLabel: running ? focus.activeHabitName ?? null : null })
            // Whose session this is, when you joined a friend's (lib/focusTogether.ts).
            // or whose you said you are in with, focusing at the same time by chance.
            .then(() => setFocusWith(running ? hostOf(focus.activeHabitId) ?? linkedHost() : null).catch(() => undefined))
            .then(() => announceChange())
            .catch(() => undefined);
        // Only on start, pause, resume and stop — not on every tick of timeLeft.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, focus.activeHabitId]);
}
