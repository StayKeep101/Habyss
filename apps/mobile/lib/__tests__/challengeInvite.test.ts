import { canAnswer, inviteLine } from '../challenges';

const run = { myStatus: 'invited' as const, status: 'open' as const, starts: '2026-11-19', days: 7, reward: 250 };

describe('challenge invites', () => {
    it('can be answered before the start and on the first day, not after', () => {
        expect(canAnswer(run, '2026-11-18')).toBe(true);
        expect(canAnswer({ ...run, status: 'active' }, '2026-11-19')).toBe(true);
        expect(canAnswer({ ...run, status: 'active' }, '2026-11-20')).toBe(false);
    });

    it('is closed once answered or ended', () => {
        expect(canAnswer({ ...run, myStatus: 'joined' }, '2026-11-18')).toBe(false);
        expect(canAnswer({ ...run, status: 'cancelled' }, '2026-11-18')).toBe(false);
    });

    it('says when it starts on the day it is read', () => {
        expect(inviteLine(run, '2026-11-18')).toBe('7 days · starts tomorrow · 250 Shards each if you all make it');
        expect(inviteLine(run, '2026-11-19')).toBe('7 days · starts today · 250 Shards each if you all make it');
    });
});
