import { earnedSince } from '../awayShards';

const move = (t: number, amount: number, title: string, held?: 'late' | 'limit') => ({ t, amount, title, ...(held ? { held } : null) });

describe('earnedSince', () => {
    it('sums what moved while away, each thing once, biggest first', () => {
        const summary = earnedSince([move(5, 20, 'A full night’s sleep'), move(6, 5, 'Run'), move(7, 5, 'Run'), move(1, 10, 'Before')], 2, 10);
        expect(summary).toEqual({ total: 30, lines: [{ title: 'A full night’s sleep', amount: 20 }, { title: 'Run', amount: 10 }] });
    });
    it('keeps a cost in the total but says nothing when nothing was earned', () => {
        expect(earnedSince([move(5, 20, 'Sleep'), move(6, -2, 'Missed: Read')], 0, 10)?.total).toBe(18);
        expect(earnedSince([move(6, -2, 'Missed: Read')], 0, 10)).toBeNull();
    });
    it('leaves out what paid nothing by the fair-play rules', () => {
        expect(earnedSince([move(5, 0, 'Late tick', 'late')], 0, 10)).toBeNull();
    });
});
