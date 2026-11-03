import { dayMoments } from '../dayMoments';

const focus = (date: string, minutes: number) => ({ itemId: 'h', startedAt: `${date}T09:00:00`, date, seconds: minutes * 60, completed: true, mode: 'focus' });
const run = (from: string, days: number) => Array.from({ length: days }, (_, index) => {
    const date = new Date(`${from}T12:00:00`); date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
});

describe('dayMoments', () => {
    it('adds up today’s focus in minutes', () => {
        expect(dayMoments({ today: '2026-11-02', streak: 0, completedDates: [], focus: [focus('2026-11-02', 25), focus('2026-11-02', 50)] }).focusMinutes).toBe(75);
    });

    it('calls it a comeback after three or more empty days', () => {
        const moments = dayMoments({ today: '2026-11-10', streak: 1, completedDates: ['2026-11-10', '2026-11-05'], focus: [] });
        expect(moments.comeback).toBe(4);
        expect(dayMoments({ today: '2026-11-10', streak: 1, completedDates: ['2026-11-10', '2026-11-08'], focus: [] }).comeback).toBeUndefined();
    });

    it('marks a new longest streak, but not a first one', () => {
        const before = run('2026-10-01', 4); // a 4-day run in October
        const now = run('2026-11-01', 5); // 5 days now, today the 5th
        expect(dayMoments({ today: '2026-11-05', streak: 5, completedDates: [...before, ...now], focus: [] }).best).toEqual({ kind: 'streak', days: 5 });
        expect(dayMoments({ today: '2026-11-05', streak: 5, completedDates: now, focus: [] }).best).toBeUndefined();
        // The day after the record fell is not another record post.
        expect(dayMoments({ today: '2026-11-06', streak: 6, completedDates: [...before, ...run('2026-11-01', 6)], focus: [] }).best).toBeUndefined();
    });

    it('marks a focus best from half an hour up', () => {
        expect(dayMoments({ today: '2026-11-02', streak: 0, completedDates: [], focus: [focus('2026-11-01', 40), focus('2026-11-02', 60)] }).best).toEqual({ kind: 'focus', minutes: 60 });
        expect(dayMoments({ today: '2026-11-02', streak: 0, completedDates: [], focus: [focus('2026-11-01', 10), focus('2026-11-02', 20)] }).best).toBeUndefined();
    });

    it('marks round streaks as milestones', () => {
        expect(dayMoments({ today: '2026-11-07', streak: 7, completedDates: run('2026-11-01', 7), focus: [] }).milestone).toBe(7);
        expect(dayMoments({ today: '2026-11-08', streak: 8, completedDates: run('2026-11-01', 8), focus: [] }).milestone).toBeUndefined();
    });
});
