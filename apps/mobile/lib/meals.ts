import AsyncStorage from '@react-native-async-storage/async-storage';
// Shared with the Mac: packages/core/src/meals.ts (the rules). What stays here is the phone's own part.
import { DEFAULT_MEALS, normalizeMeals, type MealId, type Meal, type Meals } from '@habyss/core/meals';
export * from '@habyss/core/meals';

const KEY = 'habyss_meals';
let state: Meals = DEFAULT_MEALS;
let loaded = false;
const listeners = new Set<() => void>();

export const currentMeals = (): Meals => state;
export function subscribeMeals(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export async function loadMeals(): Promise<Meals> {
    if (loaded) return state;
    try { state = normalizeMeals(JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null')); } catch { state = DEFAULT_MEALS; }
    loaded = true;
    listeners.forEach(listener => listener());
    return state;
}

/** The stored meals changed underneath (another device): read them again. */
export async function reloadMeals(): Promise<void> {
    loaded = false;
    flexLoaded = false;
    await loadMeals();
    await loadMealsFlexible();
}

export async function saveMeal(id: MealId, patch: Partial<Omit<Meal, 'id'>>): Promise<void> {
    state = normalizeMeals({ ...state, [id]: { ...state[id], ...patch } });
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
    void (require('./dayInputsSync') as typeof import('./dayInputsSync')).markDayInputsDirty('habyss_meals');
}

/**
 * Flexible meals: on a full day a meal may wait (up to two hours) so more
 * fits in; you still get all three. Off, meals never move.
 */
const FLEX_KEY = 'habyss_meals_flexible';
let flexible = false;
let flexLoaded = false;

export const currentMealsFlexible = (): boolean => flexible;

export async function loadMealsFlexible(): Promise<boolean> {
    if (flexLoaded) return flexible;
    flexLoaded = true;
    flexible = (await AsyncStorage.getItem(FLEX_KEY).catch(() => null)) === 'true';
    listeners.forEach(listener => listener());
    return flexible;
}

export async function setMealsFlexible(on: boolean): Promise<void> {
    flexible = on;
    flexLoaded = true;
    listeners.forEach(listener => listener());
    await AsyncStorage.setItem(FLEX_KEY, String(on)).catch(() => undefined);
    void (require('./dayInputsSync') as typeof import('./dayInputsSync')).markDayInputsDirty('habyss_meals_flexible');
}
