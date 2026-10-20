import { useEffect, useSyncExternalStore } from 'react';
import { currentMeals, loadMeals, subscribeMeals, type Meals } from '@/lib/meals';

/** Your meal times, from the one copy in lib/meals.ts. */
export function useMeals(): Meals {
    useEffect(() => { void loadMeals(); }, []);
    return useSyncExternalStore(subscribeMeals, currentMeals, currentMeals);
}
