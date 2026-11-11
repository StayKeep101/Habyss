import { isAsleep, whenAwake } from '../sleepWindow';

const at = (hours: number, minutes = 0, day = 11) => new Date(2026, 10, day, hours, minutes);

describe('your sleep: nothing reaches you inside it', () => {
    const night = { wake: '07:00', sleep: '23:00' };

    it('is asleep after bedtime and before waking, across midnight', () => {
        expect(isAsleep(at(23, 30), night)).toBe(true);
        expect(isAsleep(at(3), night)).toBe(true);
        expect(isAsleep(at(6, 59), night)).toBe(true);
    });

    it('rings bedtime itself and anything from wake-up on', () => {
        expect(isAsleep(at(23), night)).toBe(false);
        expect(isAsleep(at(7), night)).toBe(false);
        expect(isAsleep(at(15), night)).toBe(false);
    });

    it('handles a bedtime after midnight', () => {
        const late = { wake: '09:00', sleep: '01:00' };
        expect(isAsleep(at(0, 30), late)).toBe(false);
        expect(isAsleep(at(4), late)).toBe(true);
        expect(isAsleep(at(9, 30), late)).toBe(false);
    });

    it('moves what can wait to the next wake-up', () => {
        expect(whenAwake(at(23, 30), night)).toEqual(at(7, 0, 12));
        expect(whenAwake(at(3), night)).toEqual(at(7));
        expect(whenAwake(at(15), night)).toEqual(at(15));
    });
});
