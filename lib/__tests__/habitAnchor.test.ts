import { flowDay, flowInputs } from '../dayFlow';
import { anchoredStart, anchorLabel, anchorMatches, parseAnchor, storeAnchor } from '../habitAnchor';
import type { Habit } from '../habitsSQLite';

const study = (extra: Partial<Habit> = {}): Habit => ({
    id: 'study', name: 'Study Accounting', durationMinutes: 60, anchor: { to: 'Accounting', side: 'before', gap: 0 }, ...extra,
} as Habit);
const window = { wake: 7 * 60, sleep: 23 * 60 };
const placed = (habits: Habit[], events: { id: string; title: string; start: number; minutes: number }[], extra: Record<string, unknown> = {}) =>
    flowDay(flowInputs({ habits, tasks: [], done: {}, events, ...extra }), null, window).timeline.find(item => item.id === 'study');

describe('a habit held to a class', () => {
    it('Monday, class at 2 PM: it ends right as the class begins', () => {
        const row = placed([study()], [{ id: 'm', title: 'ACCT 2010 Accounting Lecture', start: 14 * 60, minutes: 90 }]);
        expect([row?.start, row?.end, row?.locked]).toEqual([13 * 60, 14 * 60, true]);
        expect(row?.anchoredTo).toBe('Right before Accounting');
    });
    it('Thursday, class at noon: it moves with it, nothing to change', () => {
        const row = placed([study()], [{ id: 't', title: 'Accounting', start: 12 * 60, minutes: 90 }]);
        expect([row?.start, row?.end]).toEqual([11 * 60, 12 * 60]);
    });
    it('a day without the class: an ordinary flexible habit', () => {
        const row = placed([study()], [{ id: 'x', title: 'Marketing', start: 12 * 60, minutes: 60 }]);
        expect(row?.locked).toBeFalsy();
        expect(row?.anchoredTo).toBeUndefined();
    });
    it('with travel, it ends before you leave; after, it starts once you are back', () => {
        const events = [{ id: 'm', title: 'Accounting', start: 14 * 60, minutes: 60 }];
        const travel = { accounting: { before: 20, after: 15 } };
        expect(placed([study()], events, { travel })?.end).toBe(14 * 60 - 20);
        expect(placed([study({ anchor: { to: 'accounting', side: 'after', gap: 30 } })], events, { travel })?.start).toBe(15 * 60 + 15 + 30);
    });
    it('after a meal, with a gap', () => {
        const row = flowDay(flowInputs({ habits: [study({ anchor: { to: 'Lunch', side: 'after', gap: 15 } })], tasks: [], done: {}, meals: [{ id: 'l', name: 'Lunch', start: 12 * 60, minutes: 30 }] }), null, window)
            .timeline.find(item => item.id === 'study');
        expect(row?.start).toBe(12 * 60 + 45);
    });
    it('pinned at an exact time wins over the class', () => {
        const row = placed([study({ startTime: '09:00', flexible: false })], [{ id: 'm', title: 'Accounting', start: 14 * 60, minutes: 60 }]);
        expect(row?.start).toBe(9 * 60);
        expect(row?.anchoredTo).toBeUndefined();
    });
    it('two classes in a day: before the first', () => {
        expect(anchoredStart({ to: 'Accounting', side: 'before', gap: 0 }, 30, [
            { title: 'Accounting tutorial', start: 16 * 60, minutes: 60 }, { title: 'Accounting', start: 10 * 60, minutes: 60 },
        ])).toBe(9 * 60 + 30);
    });
});

describe('stored and named', () => {
    it('round-trips, and anything broken is none', () => {
        expect(parseAnchor(storeAnchor({ to: ' Accounting ', side: 'after', gap: 15 }))).toEqual({ to: 'Accounting', side: 'after', gap: 15 });
        expect(parseAnchor('{oops')).toBeUndefined();
        expect(parseAnchor({ to: '' })).toBeUndefined();
        expect(storeAnchor(null)).toBeNull();
    });
    it('matches by name, any case and spacing', () => {
        expect(anchorMatches('ACCT  2010 accounting LECTURE', { to: 'Accounting', side: 'before', gap: 0 })).toBe(true);
        expect(anchorMatches('Marketing', { to: 'Accounting', side: 'before', gap: 0 })).toBe(false);
    });
    it('says it plainly', () => {
        expect(anchorLabel({ to: 'Lunch', side: 'after', gap: 30 })).toBe('30 min after Lunch');
        expect(anchorLabel({ to: 'Gym', side: 'before', gap: 60 })).toBe('1 hr before Gym');
    });
});
