import { BASE, DAILY_CAP, OPENING_BALANCE, earnedFor, earnedForDay, formatEmbers, streakBonus } from '../ember';

describe('what one kept habit is worth', () => {
    it('pays the base for a tick nobody checked', () => {
        expect(earnedFor('self')).toBe(BASE);
    });

    it('pays more for a claim that was actually checked', () => {
        expect(earnedFor('context')).toBeGreaterThan(earnedFor('self'));
        expect(earnedFor('verified')).toBeGreaterThan(earnedFor('context'));
    });

    it('pays a little more for a long run, and stops caring after a month', () => {
        expect(earnedFor('self', 10)).toBeGreaterThan(earnedFor('self', 0));
        expect(earnedFor('self', 30)).toBe(earnedFor('self', 365));
    });

    it('never pays for a negative or nonsense streak', () => {
        expect(streakBonus(-5)).toBe(1);
        expect(earnedFor('self', -5)).toBe(BASE);
    });
});

describe('what a day is worth', () => {
    it('pays nothing for a day with nothing kept', () => {
        expect(earnedForDay([])).toBe(0);
    });

    it('adds up what was kept', () => {
        expect(earnedForDay([{ evidence: 'self' }, { evidence: 'self' }])).toBe(BASE * 2);
    });

    it('refuses to pay more than a day is worth, however much is tracked', () => {
        // Otherwise the way to get rich is forty trivial habits, and a currency
        // anybody can print is not a currency.
        const forty = Array.from({ length: 40 }, () => ({ evidence: 'self' as const }));
        expect(earnedForDay(forty)).toBe(DAILY_CAP);
    });

    it('counts the strongest claims first, so the cap costs you the cheapest', () => {
        const mixed = [
            { evidence: 'self' as const },
            { evidence: 'verified' as const },
            { evidence: 'self' as const },
            { evidence: 'self' as const },
            { evidence: 'self' as const },
        ];
        // Verified is counted, and the day is still capped.
        expect(earnedForDay(mixed)).toBe(DAILY_CAP);
        expect(earnedForDay([{ evidence: 'verified' }])).toBe(earnedFor('verified'));
    });
});

describe('the opening balance', () => {
    it('is enough for a first pact and little enough to run out', () => {
        expect(OPENING_BALANCE).toBeGreaterThan(0);
        // About a fortnight of keeping most of what you set.
        expect(OPENING_BALANCE).toBeLessThan(DAILY_CAP * 14);
    });
});

describe('reading a balance', () => {
    it('reads as a number, not a score out of something', () => {
        expect(formatEmbers(1240)).toBe((1240).toLocaleString());
        expect(formatEmbers(12.4)).toBe('12');
    });
});
