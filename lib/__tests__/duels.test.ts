import { daysLeft, leader, shareOf } from '../duels';

describe('duels', () => {
    it('scores each person on the share of their own plan', () => {
        expect(shareOf({ done: 3, total: 4, days: 2 })).toBe(0.75);
        expect(shareOf({ done: 0, total: 0, days: 0 })).toBe(0);
    });
    it('puts ahead whoever kept more of their plan, then whoever showed up on more days', () => {
        expect(leader({ me: { done: 3, total: 3, days: 3 }, them: { done: 8, total: 10, days: 3 } })).toBe('me');
        expect(leader({ me: { done: 2, total: 4, days: 2 }, them: { done: 1, total: 2, days: 1 } })).toBe('me');
        expect(leader({ me: { done: 0, total: 0, days: 0 }, them: { done: 0, total: 0, days: 0 } })).toBe('even');
    });
    it('counts the days left, today included', () => {
        expect(daysLeft('2026-11-08', new Date(2026, 10, 2, 15))).toBe(7);
        expect(daysLeft('2026-11-01', new Date(2026, 10, 2))).toBe(0);
    });
});
