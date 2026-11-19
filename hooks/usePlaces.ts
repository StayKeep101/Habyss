import { useEffect, useSyncExternalStore } from 'react';
import { currentPlaces, loadPlaces, subscribePlaces } from '@/lib/taskPlaces';

/** Where each task gets done, and the places used lately, kept current. */
export function usePlaces() {
    useEffect(() => { void loadPlaces(); }, []);
    return useSyncExternalStore(subscribePlaces, currentPlaces, currentPlaces);
}
