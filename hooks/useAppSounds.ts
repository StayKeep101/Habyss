import { useEffect } from 'react';
import { on } from '@/lib/appEvents';
import { useSounds } from '@/hooks/useSounds';

/**
 * The app's moments, heard: finishing a task, a goal or the whole day, and
 * reaching the daily target. Taps, choices and sheets have their own quiet
 * sounds, played by the controls themselves (hooks/useUISound.ts).
 *
 * Habit ticks already play from the screen that ticks them (Home, Roadmap,
 * goal page), where the sound lands with the animation.
 */
export function useAppSounds() {
    const { playComplete, playCelebrate, playStreak } = useSounds();

    useEffect(() => {
        const subscriptions = [
            // The same sound as ticking a habit: done is done.
            on('task_completed', () => playComplete()),
            on('daily_target_reached', () => playStreak()),
            on('day_complete', () => playCelebrate()),
            // A reached goal's sound plays on its ceremony's beat (GoalCompleteSequence), not here.
        ];
        return () => subscriptions.forEach(subscription => subscription.remove());
    }, [playComplete, playCelebrate, playStreak]);
}
