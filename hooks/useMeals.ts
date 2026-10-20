import { useEffect, useSyncExternalStore } from 'react';
import { currentMeals, currentMealsFlexible, loadMeals, loadMealsFlexible, subscribeMeals, type Meals } from '@/lib/meals';

/** Your meal times, from the one copy in lib/meals.ts. */
export function useMeals(): Meals {
    useEffect(() => { void loadMeals(); }, []);
    return useSyncExternalStore(subscribeMeals, currentMeals, currentMeals);
}

/** Whether meals may wait for a full day (Settings → Timeline). */
export function useMealsFlexible(): boolean {
    useEffect(() => { void loadMealsFlexible(); }, []);
    return useSyncExternalStore(subscribeMeals, currentMealsFlexible, currentMealsFlexible);
}
