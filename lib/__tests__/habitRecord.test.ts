import { habitRecord, type RecordDay } from '../habitRecord';

const day = (date: string, completed: boolean, extra: Partial<RecordDay> = {}): RecordDay => ({ date, completed, skipped: false, scheduled: true, ...extra });

describe("a habit's record", () => {
    it('counts the run, the best run and days done; today not done yet does not break the run', () => {
        const record = habitRecord([
            day('2026-10-20', true), day('2026-10-21', true), day('2026-10-22', false),
            day('2026-10-23', true), day('2026-10-24', true), day('2026-10-25', true, { skipped: false }),
            day('2026-10-26', true), day('2026-10-27', false),
        ], '2026-10-27');
        expect(record.streak).toBe(4);
        expect(record.best).toBe(4);
        expect(record.done).toBe(6);
        expect(record.rate).toBe(86);
    });

    it('a skipped day or a day off neither counts nor breaks the run', () => {
        const record = habitRecord([day('2026-10-25', true), day('2026-10-26', false, { skipped: true }), day('2026-10-27', true)], '2026-10-27');
        expect(record.streak).toBe(2);
    });

    it('lays out this week from the day it starts on', () => {
        const record = habitRecord([day('2026-10-26', true), day('2026-10-27', false)], '2026-10-27', '2026-10-26');
        expect(record.week.map(entry => entry.state)).toEqual(['done', 'today', 'future', 'future', 'future', 'future', 'future']);
        expect(habitRecord([], '2026-10-27', undefined, false).week[0].date).toBe('2026-10-25');
    });

    it('names the weekday kept best once it has enough days', () => {
        const days: RecordDay[] = [];
        for (let i = 0; i < 28; i++) {
            const date = new Date('2026-09-28T12:00:00'); date.setDate(date.getDate() + i);
            const key = date.toISOString().slice(0, 10);
            days.push(day(key, date.getDay() === 2));
        }
        expect(habitRecord(days, '2026-10-25').bestWeekday).toBe(2);
    });
});
