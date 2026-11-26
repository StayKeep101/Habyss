import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Breakfast, lunch and supper: when you eat and for how long.
 *
 * They are fixed points in the day's timeline (lib/dayFlow.ts). Nothing is
 * moved into them: a task running late is pushed past the meal rather than
 * eating into it. Each can be switched off. Kept on this phone, one copy for
 * every screen.
 */
export type MealId = 'breakfast' | 'lunch' | 'supper';
export interface Meal { id: MealId; on: boolean; /** "HH:MM" */ time: string; minutes: number }
export type Meals = Record<MealId, Meal>;

export const MEAL_NAMES: Record<MealId, string> = { breakfast: 'Breakfast', lunch: 'Lunch', supper: 'Supper' };
export const MEAL_LENGTHS = [15, 20, 30, 45, 60];
export const DEFAULT_MEALS: Meals = {
    breakfast: { id: 'breakfast', on: false, time: '07:30', minutes: 20 },
    lunch: { id: 'lunch', on: false, time: '12:30', minutes: 45 },
    supper: { id: 'supper', on: false, time: '18:30', minutes: 45 },
};

const KEY = 'habyss_meals';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
let state: Meals = DEFAULT_MEALS;
let loaded = false;
const listeners = new Set<() => void>();

/** Whatever was stored, made safe: unknown fields dropped, bad values back to defaults. */
export function normalizeMeals(raw: unknown): Meals {
    const out = { ...DEFAULT_MEALS };
    if (!raw || typeof raw !== 'object') return out;
    for (const id of Object.keys(DEFAULT_MEALS) as MealId[]) {
        const value = (raw as Record<string, Partial<Meal>>)[id];
        if (!value || typeof value !== 'object') continue;
        out[id] = {
            id,
            on: value.on === true,
            time: typeof value.time === 'string' && TIME.test(value.time) ? value.time : DEFAULT_MEALS[id].time,
            minutes: typeof value.minutes === 'number' && value.minutes >= 5 && value.minutes <= 180 ? Math.round(value.minutes) : DEFAULT_MEALS[id].minutes,
        };
    }
    return out;
}

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

/** The meals that are on, as minutes from midnight. */
export function mealSlots(meals: Meals): { id: MealId; name: string; start: number; minutes: number }[] {
    return (Object.values(meals) as Meal[]).filter(meal => meal.on).map(meal => {
        const [h, m] = meal.time.split(':').map(Number);
        return { id: meal.id, name: MEAL_NAMES[meal.id], start: h * 60 + m, minutes: meal.minutes };
    });
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
