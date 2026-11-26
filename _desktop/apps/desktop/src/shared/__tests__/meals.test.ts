import { describe, it, expect } from 'vitest';
import { DEFAULT_MEALS, mealSlots, normalizeMeals } from '../meals';


describe('meal times', () => {
    it('repairs what was stored and keeps only the meals that are on', () => {
        const meals = normalizeMeals({ lunch: { on: true, time: '13:00', minutes: 30 }, supper: { on: true, time: '25:00', minutes: 2 } });
        expect(meals.lunch).toEqual({ id: 'lunch', on: true, time: '13:00', minutes: 30 });
        expect(meals.supper).toEqual({ ...DEFAULT_MEALS.supper, on: true });
        expect(mealSlots(meals)).toEqual([
            { id: 'lunch', name: 'Lunch', start: 780, minutes: 30 },
            { id: 'supper', name: 'Supper', start: 1110, minutes: 45 },
        ]);
        expect(normalizeMeals('junk')).toEqual(DEFAULT_MEALS);
    });
});
