import { useEffect, useSyncExternalStore } from 'react';
import { currentTravel, loadTravel, subscribeTravel, type Travel } from '@/lib/eventTravel';

/** Travel time set for calendar events, by event name (lib/eventTravel.ts). */
export function useEventTravel(): Record<string, Travel> {
    useEffect(() => { void loadTravel(); }, []);
    return useSyncExternalStore(subscribeTravel, currentTravel, currentTravel);
}
