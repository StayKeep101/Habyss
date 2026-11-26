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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/** The meals that are on, as minutes from midnight. */
export function mealSlots(meals: Meals): { id: MealId; name: string; start: number; minutes: number }[] {
    return (Object.values(meals) as Meal[]).filter(meal => meal.on).map(meal => {
        const [h, m] = meal.time.split(':').map(Number);
        return { id: meal.id, name: MEAL_NAMES[meal.id], start: h * 60 + m, minutes: meal.minutes };
    });
}
