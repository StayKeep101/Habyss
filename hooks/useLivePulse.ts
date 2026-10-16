import { useEffect } from 'react';
import { on } from '@/lib/appEvents';
import { announceChange } from '@/lib/livePulse';

/** Anything friends can see changing here is backed up and announced to them. Mounted once. */
export function useLivePulse() {
    useEffect(() => {
        const subscriptions = [
            on('habit_completion_updated', announceChange),
            on('habit_completed', announceChange),
            on('habit_created', announceChange),
            on('habit_updated', announceChange),
            on('habit_deleted', announceChange),
            on('tasks_changed', announceChange),
            on('task_completed', announceChange),
            on('profile_avatar_changed', announceChange),
        ];
        return () => subscriptions.forEach(subscription => subscription.remove());
    }, []);
}
