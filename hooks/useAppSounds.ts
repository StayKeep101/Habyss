import { useEffect } from 'react';
import { on } from '@/lib/appEvents';
import { useSounds } from '@/hooks/useSounds';

/**
 * The app's moments, heard: one place that turns what happened into a sound,
 * so every screen sounds the same and none has to remember to.
 *
 * Habit ticks already play from the screen that ticks them (Home, Roadmap,
 * goal page), where the sound lands with the animation.
 */
export function useAppSounds() {
    const { playSuccess, playCelebrate, playLevelUp, playToggle, playStreak } = useSounds();

    useEffect(() => {
        const subscriptions = [
            on('task_completed', () => playSuccess()),
            on('habit_created', () => playSuccess()),
            on('show_creation_modal', () => playToggle()),
            on('daily_target_reached', () => playStreak()),
            on('day_complete', () => playCelebrate()),
            on('goal_complete', () => playLevelUp()),
        ];
        return () => subscriptions.forEach(subscription => subscription.remove());
    }, [playSuccess, playCelebrate, playLevelUp, playToggle, playStreak]);
}
