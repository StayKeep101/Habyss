import { describe, it, expect } from 'vitest';
import { onceKey, scopeOf, travelKey, travelOf, weekdayKey } from '../eventTravel';

describe('travel around an event', () => {
    const all = { [travelKey('School')]: { before: 60, after: 60 }, [weekdayKey('School', '2026-11-26')]: { before: 30, after: 30 }, [onceKey('E1', '2026-11-26')]: { before: 10, after: 0 } };
    it('the narrowest reach wins: this event today, then this weekday, then every one with the name', () => {
        expect(travelOf(all, { id: 'E1', title: 'School' }, '2026-11-26')).toEqual({ before: 10, after: 0 });
        expect(travelOf(all, { id: 'E2', title: 'school ' }, '2026-11-26')).toEqual({ before: 30, after: 30 });
        expect(travelOf(all, { id: 'E3', title: 'School' }, '2026-11-27')).toEqual({ before: 60, after: 60 });
        expect(scopeOf(all, { id: 'E1', title: 'School' }, '2026-11-26')).toBe('once');
    });
});
