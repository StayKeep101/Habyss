import { isAsleep, statusOf, type PresenceFacts } from '../presence';

const now = new Date('2026-10-16T12:00:00Z');
const facts = (over: Partial<PresenceFacts>): PresenceFacts => ({
    presence: 'away', presenceAt: null, focusUntil: null, focusLabel: null,
    timezone: 'UTC', wakeTime: '07:00:00', sleepTime: '23:00:00', ...over,
});

describe('a friend’s status', () => {
    it('is locked in while a focus session runs, above everything else', () => {
        expect(statusOf(facts({ focusUntil: '2026-10-16T12:30:00Z', presence: 'live', presenceAt: '2026-10-16T11:59:00Z' }), now)).toBe('focus');
        expect(statusOf(facts({ focusUntil: '2026-10-16T11:30:00Z' }), now)).toBe('away');
    });

    it('is live only while the app has said so recently', () => {
        expect(statusOf(facts({ presence: 'live', presenceAt: '2026-10-16T11:58:00Z' }), now)).toBe('live');
        expect(statusOf(facts({ presence: 'live', presenceAt: '2026-10-16T11:00:00Z' }), now)).toBe('away');
    });

    it('is asleep inside their own sleep window, in their own time zone', () => {
        // Noon in UTC is 4 am in Los Angeles.
        expect(statusOf(facts({ timezone: 'America/Los_Angeles' }), now)).toBe('asleep');
        expect(statusOf(facts({ timezone: 'UTC' }), now)).toBe('away');
    });

    it('handles a sleep window across midnight, or within one day', () => {
        expect(isAsleep('23:00', '07:00', 60)).toBe(true);
        expect(isAsleep('23:00', '07:00', 12 * 60)).toBe(false);
        expect(isAsleep('01:00', '09:00', 8 * 60)).toBe(true);
        expect(isAsleep(null, '07:00', 60)).toBe(false);
    });
});
