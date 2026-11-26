import { asTime, endTime, lengthBetween, timeValue } from '@/components/Create/TimeRange';

describe('reading a time', () => {
    it('reads a written time onto today', () => {
        expect(asTime(timeValue('07:30'))).toBe('07:30');
    });

    it('falls back rather than producing nonsense', () => {
        expect(asTime(timeValue(undefined))).toBe('08:00');
        expect(asTime(timeValue('not a time'))).toBe('08:00');
    });
});

describe('where a length ends', () => {
    it('adds the minutes on', () => {
        expect(endTime('06:00', 45)).toBe('06:45');
        expect(endTime('09:30', 90)).toBe('11:00');
    });

    it('rolls past midnight', () => {
        expect(endTime('23:30', 60)).toBe('00:30');
    });
});

describe('how long between two times', () => {
    it('measures forwards', () => {
        expect(lengthBetween('06:00', '06:45')).toBe(45);
        expect(lengthBetween('09:00', '11:30')).toBe(150);
    });

    it('reads an earlier end as the next day, not as a negative length', () => {
        // Somebody setting 23:00 to 00:30 means an hour and a half, not minus
        // twenty-two and a half hours.
        expect(lengthBetween('23:00', '00:30')).toBe(90);
    });

    it('reads the same time as a whole day rather than nothing', () => {
        expect(lengthBetween('08:00', '08:00')).toBe(24 * 60);
    });

    it('round-trips with endTime', () => {
        for (const [start, minutes] of [['06:00', 45], ['23:30', 60], ['12:15', 150]] as const) {
            expect(lengthBetween(start, endTime(start, minutes))).toBe(minutes);
        }
    });
});
