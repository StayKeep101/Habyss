import { averageSleepHours, hoursOf, planRatio, topRateNote } from '../weekNumbers';

const sample = (day: string, minutes: number, planned: number) => ({ day, minutes, planned, source: 'timeline' as const });

describe('the week in five numbers', () => {
    it('says how long things take against the plan, only within the week and with enough samples', () => {
        const samples = {
            a: [sample('2026-11-16', 60, 40), sample('2026-11-17', 30, 30)],
            b: [sample('2026-11-18', 50, 30), sample('2026-11-02', 500, 10)],
        };
        expect(planRatio(samples, '2026-11-16', '2026-11-22')).toBe(1.4);
        expect(planRatio({ a: [sample('2026-11-16', 60, 40)] }, '2026-11-16', '2026-11-22')).toBeNull();
    });

    it('averages sleep over the nights Health could read', () => {
        expect(averageSleepHours([420, null, 480, 0])).toBe(7.5);
        expect(averageSleepHours([null, null])).toBeNull();
    });

    it('says plan less below 70%, plan more at 100%, nothing in between or too early', () => {
        expect(topRateNote(50, 5)).toBe('Plan less');
        expect(topRateNote(100, 5)).toBe('Plan more');
        expect(topRateNote(80, 5)).toBeNull();
        expect(topRateNote(0, 2)).toBeNull();
    });

    it('turns seconds into hours to one decimal', () => {
        expect(hoursOf(23400)).toBe(6.5);
    });
});
