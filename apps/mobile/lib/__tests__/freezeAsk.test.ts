import { friendToSave } from '../freezeAsk';

const friend = (id: string, streak: number, done: number, total = 4) => ({ userId: id, username: id, displayName: id.toUpperCase(), currentStreak: streak, todayCompleted: done, todayTotal: total });
const evening = new Date(2026, 10, 14, 19, 30);

describe('when Echo asks to send a streak freeze', () => {
    it('asks in the evening about the friend with the longest streak who has done nothing today', () => {
        const friends = [friend('ana', 5, 0), friend('bo', 23, 0), friend('cy', 40, 2), friend('di', 2, 0)];
        expect(friendToSave(friends, evening, new Set())).toEqual({ id: 'bo', name: 'BO', avatarUrl: undefined, streak: 23 });
    });
    it('does not ask before the evening, for a short streak, or for someone with nothing planned', () => {
        expect(friendToSave([friend('bo', 23, 0)], new Date(2026, 10, 14, 15), new Set())).toBeNull();
        expect(friendToSave([friend('di', 2, 0)], evening, new Set())).toBeNull();
        expect(friendToSave([friend('ed', 9, 0, 0)], evening, new Set())).toBeNull();
    });
    it('asks once a day per friend', () => {
        expect(friendToSave([friend('bo', 23, 0)], evening, new Set(['bo:2026-11-14']))).toBeNull();
        expect(friendToSave([friend('bo', 23, 0), friend('ana', 5, 0)], evening, new Set(['bo:2026-11-14']))?.id).toBe('ana');
    });
});
