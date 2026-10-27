import { isPerfect, packFor } from '../dailyPack';
import type { FeedPost } from '../feedService';

const post = (userId: string, done: number, total: number, extra: Partial<FeedPost> = {}): FeedPost => ({
    userId, day: '2026-10-27', postedAt: '', name: userId, username: userId, ackCount: 0, ackedByMe: false, ackUsers: [], mine: false,
    card: { habitsDone: done, habitsTotal: total, tasksDone: 0, tasksTotal: 0, streak: 1 }, ...extra,
});

describe("today's pack", () => {
    it("holds only friends' cards from today, once each", () => {
        const pack = packFor([post('a', 1, 2), post('me', 2, 2, { mine: true }), post('b', 1, 2, { day: '2026-10-26' }), post('a', 0, 2)], '2026-10-27');
        expect(pack.map(card => card.userId)).toEqual(['a']);
    });

    it('builds to the best: quieter days first, a perfect day last', () => {
        const pack = packFor([post('perfect', 3, 3), post('half', 1, 2), post('none', 0, 4)], '2026-10-27');
        expect(pack.map(card => card.userId)).toEqual(['none', 'half', 'perfect']);
        expect(isPerfect(pack[2])).toBe(true);
        expect(isPerfect(post('empty', 0, 0))).toBe(false);
    });
});
