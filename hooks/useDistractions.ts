import { useEffect, useSyncExternalStore } from 'react';
import { currentDistractions, loadDistractions, subscribeDistractions, type Distraction } from '@/lib/distractions';

/** Every "got distracted", kept current. */
export function useDistractions(): Distraction[] {
    useEffect(() => { void loadDistractions(); }, []);
    return useSyncExternalStore(subscribeDistractions, currentDistractions, currentDistractions);
}
