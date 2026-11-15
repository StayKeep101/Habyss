import { daysOff, endedBefore, timeOffLabel, timeOffOn, __resetTimeOff, type TimeOff } from '../timeOff';
import { streakFrom } from '../dayComplete';
import { habitDays } from '../habitDays';
import type { Habit } from '../habitsSQLite';

jest.mock('../streakFreeze', () => ({ frozenDays: () => new Set<string>() }));

const TODAY = '2026-09-22';
const daily = [{ id: 'h', name: 'Run', startDate: '2026-09-01', createdAt: '2026-09-01', taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] } as Habit];
const doneOn = (days: string[]) => Object.fromEntries(days.map(day => [day, ['h']]));

afterEach(() => __resetTimeOff([]));

describe('time off', () => {
    it('covers every day from its first to its last, an open one to today', () => {
        expect([...daysOff([{ kind: 'vacation', from: '2026-09-20', until: '2026-09-22' }])]).toEqual(['2026-09-20', '2026-09-21', '2026-09-22']);
        expect([...daysOff([{ kind: 'sick', from: '2026-09-21', until: null }], TODAY)]).toEqual(['2026-09-21', '2026-09-22']);
    });

    it('never holds more than 60 days at once', () => {
        expect(daysOff([{ kind: 'sick', from: '2026-01-01', until: null }], TODAY).size).toBe(60);
    });

    it("ends the day before you're back; one started today is dropped", () => {
        const list: TimeOff[] = [{ kind: 'sick', from: '2026-09-19', until: null }, { kind: 'vacation', from: TODAY, until: '2026-09-30' }];
        expect(endedBefore(list, TODAY)).toEqual([{ kind: 'sick', from: '2026-09-19', until: '2026-09-21' }]);
    });

    it('says what is running', () => {
        const sick: TimeOff = { kind: 'sick', from: TODAY, until: null };
        expect(timeOffOn([sick], TODAY, TODAY)).toBe(sick);
        expect(timeOffLabel(sick, TODAY)).toBe('Sick today');
        expect(timeOffOn([sick], '2026-09-21', TODAY)).toBeNull();
    });

    it('keeps the streak through days off without adding them', () => {
        // Done the 18th and 19th, sick the 20th and 21st, done today.
        const history = doneOn(['2026-09-18', '2026-09-19', TODAY]);
        expect(streakFrom(daily, [], history, {}, TODAY).streak).toBe(1);
        __resetTimeOff([{ kind: 'sick', from: '2026-09-20', until: '2026-09-21' }]);
        expect(streakFrom(daily, [], history, {}, TODAY).streak).toBe(3);
    });

    it('does not count a day off as missed', () => {
        __resetTimeOff([{ kind: 'vacation', from: '2026-09-20', until: '2026-09-21' }]);
        const days = habitDays(daily, [{ date: '2026-09-19', completedIds: ['h'] }, { date: '2026-09-21', completedIds: ['h'] }], {}, 4, TODAY, TODAY);
        expect(days.map(day => [day.date, day.skipped])).toEqual([
            ['2026-09-19', []], ['2026-09-20', ['h']], ['2026-09-21', []], ['2026-09-22', []],
        ]);
    });
});
