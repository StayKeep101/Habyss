import { useEffect } from 'react';
import { on } from '@/lib/appEvents';
import { useSounds } from '@/hooks/useSounds';

/**
 * The app's moments, heard — and only those: finishing a task, a goal or the
 * whole day, and reaching the daily target. Taps and menus are silent, so a
 * sound always means something was achieved.
 *
 * Habit ticks already play from the screen that ticks them (Home, Roadmap,
 * goal page), where the sound lands with the animation.
 */
export function useAppSounds() {
    const { playComplete, playCelebrate, playLevelUp, playStreak } = useSounds();

    useEffect(() => {
        const subscriptions = [
            // The same sound as ticking a habit: done is done.
            on('task_completed', () => playComplete()),
            on('daily_target_reached', () => playStreak()),
            on('day_complete', () => playCelebrate()),
            on('goal_complete', () => playLevelUp()),
        ];
        return () => subscriptions.forEach(subscription => subscription.remove());
    }, [playComplete, playCelebrate, playLevelUp, playStreak]);
}
