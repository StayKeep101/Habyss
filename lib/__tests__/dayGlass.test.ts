import { clockLabel, flipDue, glassAt } from '../dayGlass';

const day = { wake: '07:00', sleep: '23:00' };
const at = (hour: number, minute = 0, second = 0) => new Date(2026, 10, 12, hour, minute, second);

describe('the day as an hourglass', () => {
    it('is full on waking, half run at mid-day, empty at bedtime', () => {
        expect(glassAt(at(7), day)).toMatchObject({ ran: 0, past: 0, left: 16 * 3600, resting: null });
        expect(glassAt(at(15), day).ran).toBeCloseTo(0.5);
        expect(glassAt(at(23), day)).toMatchObject({ ran: 1, left: 0, resting: 'night' });
    });
    it('sits run out through the night, waiting for the morning flip', () => {
        expect(glassAt(at(5), day)).toMatchObject({ ran: 1, left: 0, resting: 'night' });
    });
    it('counts a bedtime after midnight as the same day', () => {
        const late = { wake: '09:00', sleep: '01:00' };
        expect(glassAt(at(0, 30), late)).toMatchObject({ resting: null, left: 30 * 60 });
        expect(glassAt(at(2), late).resting).toBe('night');
        expect(glassAt(at(8), late).resting).toBe('night');
    });
    it('reads the clocks to the second', () => {
        expect(clockLabel(9 * 3600 + 27 * 60 + 8)).toBe('9:27:08');
        expect(clockLabel(27 * 60 + 8)).toBe('27:08');
        expect(clockLabel(-5)).toBe('0:00');
    });
});

describe('the morning flip', () => {
    it('turns over on the first open after waking, before noon, once', () => {
        expect(flipDue(at(8), day, '2026-11-12', '2026-11-11')).toBe(true);
        expect(flipDue(at(8), day, '2026-11-12', '2026-11-12')).toBe(false);
        expect(flipDue(at(8), day, '2026-11-12', null)).toBe(true);
    });
    it('is gone after noon, and never before waking', () => {
        expect(flipDue(at(12, 1), day, '2026-11-12', '2026-11-11')).toBe(false);
        expect(flipDue(at(6), day, '2026-11-12', '2026-11-11')).toBe(false);
    });
});
