import { useEffect } from 'react';
import { AppState } from 'react-native';
import { on } from '@/lib/appEvents';
import { announceChange, listenToFriends } from '@/lib/livePulse';
import { loadCachedGate, refreshGate } from '@/lib/sharedGate';
import { reloadData } from '@/lib/dataStore';

/**
 * Anything friends can see changing here is backed up and announced to them,
 * and when a friend's day changes, shared items are re-checked so a streak
 * that was waiting on them counts the moment they finish. Mounted once.
 */
export function useLivePulse() {
    useEffect(() => {
        // Stats recompute when who-did-what on shared items changes.
        const recheck = () => { void refreshGate().then(changed => { if (changed) void reloadData(); }); };
        void loadCachedGate().then(() => { void reloadData(); recheck(); });

        const subscriptions = [
            on('habit_completion_updated', announceChange),
            on('habit_completed', announceChange),
            on('habit_created', announceChange),
            on('habit_updated', announceChange),
            on('habit_deleted', announceChange),
            on('tasks_changed', announceChange),
            on('task_completed', announceChange),
            on('profile_avatar_changed', announceChange),
            on('social_state_updated', recheck),
        ];
        const foreground = AppState.addEventListener('change', state => { if (state === 'active') recheck(); });
        let stopFriends: (() => void) | undefined;
        void listenToFriends(recheck).then(stop => { stopFriends = stop; });

        return () => {
            subscriptions.forEach(subscription => subscription.remove());
            foreground.remove();
            stopFriends?.();
        };
    }, []);
}
