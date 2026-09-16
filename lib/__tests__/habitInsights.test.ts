import {
    computeInsights, occurrencesFor, scaledDownTarget,
    type DayRecord,
} from '../habitInsights';
import type { Habit } from '../habitsSQLite';

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Read', category: 'mind', createdAt: '2026-08-01', type: 'build',
    color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'time', taskDays: [],
    reminders: [], chartType: 'bar', startDate: '2026-08-01', isArchived: false,
    showMemo: false, frequency: 'daily', trackingMethod: 'boolean', ...over,
} as Habit);

/** Builds day records for `days` consecutive days ending the day before `end`. */
const history = (days: number, completedOn: (date: Date, index: number) => boolean, end = new Date(2026, 8, 20)): DayRecord[] => {
    const records: DayRecord[] = [];
    for (let i = days; i >= 1; i -= 1) {
        const date = new Date(end);
        date.setDate(end.getDate() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        records.push({ date: key, completedIds: completedOn(date, i) ? ['h1'] : [] });
    }
    return records;
};

const TODAY = new Date(2026, 8, 20);

describe('evidence thresholds', () => {
    it('says nothing from a couple of days', () => {
        const records = history(3, () => false);
        expect(computeInsights([habit()], records, TODAY)).toEqual([]);
    });

    it('ignores today, which is still in progress', () => {
        const todayKey = '2026-09-20';
        const records: DayRecord[] = [{ date: todayKey, completedIds: [] }];
        expect(computeInsights([habit()], records, TODAY)).toEqual([]);
    });

    it('skips archived habits and goals', () => {
        const records = history(14, () => false);
        expect(computeInsights([habit({ isArchived: true })], records, TODAY)).toEqual([]);
        expect(computeInsights([habit({ isGoal: true })], records, TODAY)).toEqual([]);
    });
});

describe('weekday patterns', () => {
    it('names the day that slips when the gap is large enough', () => {
        // Misses every Monday, keeps every other day.
        const records = history(28, date => date.getDay() !== 1);
        const found = computeInsights([habit()], records, TODAY).find(i => i.kind === 'weekday_gap');
        expect(found?.title).toContain('Mondays');
        expect(found?.detail).toContain('0 of 4 Mondays');
    });

    it('stays quiet when every day is roughly equal', () => {
        const records = history(28, (_date, index) => index % 2 === 0);
        expect(computeInsights([habit()], records, TODAY).some(i => i.kind === 'weekday_gap')).toBe(false);
    });
});

describe('weekend pattern', () => {
    it('reports the drop with the numbers behind it', () => {
        const records = history(28, date => date.getDay() !== 0 && date.getDay() !== 6);
        const found = computeInsights([habit()], records, TODAY).find(i => i.kind === 'weekend_drop');
        expect(found).toBeDefined();
        expect(found!.detail).toMatch(/0% logged at weekends against 100% on weekdays/);
    });

    it('stays quiet when weekends hold up', () => {
        const records = history(28, () => true);
        expect(computeInsights([habit()], records, TODAY).some(i => i.kind === 'weekend_drop')).toBe(false);
    });
});

describe('adaptive difficulty', () => {
    const numeric = habit({ trackingMethod: 'numeric', goalValue: 30, unit: 'min', name: 'Run' });

    it('suggests a smaller target after repeated misses', () => {
        const records = history(10, (_d, index) => index % 3 === 0);
        const found = computeInsights([numeric], records, TODAY).find(i => i.kind === 'scale_down');
        expect(found?.suggestion).toEqual({ habitId: 'h1', fromValue: 30, toValue: 20, unit: 'min' });
        expect(found?.detail).toContain('of the last 7');
    });

    it('does not suggest scaling a yes/no habit', () => {
        const records = history(10, () => false);
        expect(computeInsights([habit()], records, TODAY).some(i => i.kind === 'scale_down')).toBe(false);
    });

    it('does not suggest scaling when the habit is being kept', () => {
        const records = history(10, () => true);
        const insights = computeInsights([numeric], records, TODAY);
        expect(insights.some(i => i.kind === 'scale_down')).toBe(false);
        expect(insights.some(i => i.kind === 'holding_well')).toBe(true);
    });

    it('never proposes a target below 1', () => {
        expect(scaledDownTarget(2)).toBe(1);
        expect(scaledDownTarget(1)).toBe(1);
        expect(scaledDownTarget(30)).toBe(20);
        expect(scaledDownTarget(10)).toBe(6);
    });

    it('only proposes, and carries the values needed to apply it', () => {
        const records = history(10, (_d, index) => index % 3 === 0);
        const found = computeInsights([numeric], records, TODAY).find(i => i.kind === 'scale_down')!;
        // The habit itself is untouched; applying is the caller's job.
        expect(numeric.goalValue).toBe(30);
        expect(found.suggestion!.toValue).toBeLessThan(found.suggestion!.fromValue);
    });
});

describe('language', () => {
    it('describes missing completions as not logged, never as failure', () => {
        const records = history(28, date => date.getDay() !== 1);
        for (const insight of computeInsights([habit({ trackingMethod: 'numeric', goalValue: 10 })], records, TODAY)) {
            expect(`${insight.title} ${insight.detail}`.toLowerCase()).not.toMatch(/you failed|you gave up|lazy|excuses/);
        }
    });
});

describe('occurrencesFor', () => {
    it('only counts days the habit was actually scheduled', () => {
        const weekdayHabit = habit({ taskDays: ['mon', 'tue', 'wed', 'thu', 'fri'] });
        const records = history(14, () => true);
        const occurrences = occurrencesFor(weekdayHabit, records);
        expect(occurrences.every(o => o.date.getDay() !== 0 && o.date.getDay() !== 6)).toBe(true);
    });

    it('ignores malformed dates rather than throwing', () => {
        expect(() => occurrencesFor(habit(), [{ date: 'nonsense', completedIds: [] }])).not.toThrow();
        expect(occurrencesFor(habit(), [{ date: 'nonsense', completedIds: [] }])).toEqual([]);
    });
});
