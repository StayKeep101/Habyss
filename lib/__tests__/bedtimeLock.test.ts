import { isNight, msToNextEdge } from '../bedtimeLock';

const at = (h: number, m = 0) => h * 60 + m;

describe('bedtime lock', () => {
    it('is night from bedtime, through midnight, until wake', () => {
        expect(isNight(at(22, 59), at(7), at(23))).toBe(false);
        expect(isNight(at(23), at(7), at(23))).toBe(true);
        expect(isNight(at(2), at(7), at(23))).toBe(true);
        expect(isNight(at(6, 59), at(7), at(23))).toBe(true);
        expect(isNight(at(7), at(7), at(23))).toBe(false);
    });

    it('handles a bedtime after midnight', () => {
        expect(isNight(at(23, 30), at(8), at(1))).toBe(false);
        expect(isNight(at(1), at(8), at(1))).toBe(true);
        expect(isNight(at(8), at(8), at(1))).toBe(false);
    });

    it('is never night when bedtime and wake are the same', () => {
        expect(isNight(at(7), at(7), at(7))).toBe(false);
    });

    it('times the next edge: bedtime by day, wake by night', () => {
        const evening = new Date(2026, 10, 10, 22, 30, 0, 0);
        expect(msToNextEdge(evening, at(7), at(23))).toBe(30 * 60_000);
        const night = new Date(2026, 10, 10, 23, 15, 0, 0);
        expect(msToNextEdge(night, at(7), at(23))).toBe((45 + 7 * 60) * 60_000);
    });
});
