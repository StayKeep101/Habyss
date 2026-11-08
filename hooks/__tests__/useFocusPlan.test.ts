import { partNow } from '../useFocusPlan';

// A 90-minute task split around lunch: 11:23–12:00, lunch, then 13:00–13:53.
const slot = { start: 683, end: 833, parts: [{ start: 683, end: 720 }, { start: 780, end: 833 }], breaks: ['Lunch'] };

describe('focus on a task split around something fixed', () => {
    it('runs to where this part ends, and says what comes after', () => {
        expect(partNow(slot, 690)).toEqual({ part: { start: 683, end: 720 }, then: { minutes: 53, after: 'Lunch' } });
    });
    it('after the break, it is the last part, with nothing after', () => {
        expect(partNow(slot, 790)).toEqual({ part: { start: 780, end: 833 }, then: null });
    });
    it('during the break, it is the part to come', () => {
        expect(partNow(slot, 740).part).toEqual({ start: 780, end: 833 });
    });
});
