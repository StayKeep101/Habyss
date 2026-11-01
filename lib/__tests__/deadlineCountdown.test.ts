import { deadlineCountdown, deadlineInstant } from '../deadlineCountdown';

describe('goal deadline countdown', () => {
    it('counts days, hours, minutes and seconds independently', () => {
        const end = deadlineInstant('2026-10-30');
        expect(deadlineCountdown('2026-10-30', end - (86400 + 7200 + 180 + 4) * 1000)).toBe('1d 2h 3m 4s left');
    });
    it('includes the whole deadline day and never goes negative', () => {
        expect(new Date(deadlineInstant('2026-10-30')).getDate()).toBe(31);
        expect(deadlineCountdown('2026-10-30', deadlineInstant('2026-10-30') + 1)).toBe('Deadline reached');
    });
    it('respects an explicit timestamp', () => {
        expect(deadlineCountdown('2026-10-30T10:00:00Z', Date.parse('2026-10-30T09:59:58Z'))).toBe('0d 0h 0m 2s left');
        expect(deadlineCountdown('bad')).toBe('No deadline');
    });
});
