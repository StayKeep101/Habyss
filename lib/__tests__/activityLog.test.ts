import { activeDays } from '../activityLog';
import { computeMarks } from '../marks';

describe('activity', () => {
    it('a day counts once the exercise goal is reached', () => {
        expect(activeDays({ target: 30, connected: true, days: { '2026-11-01': { minutes: 31, steps: 9000 }, '2026-11-02': { minutes: 12, steps: 4000 } } }))
            .toEqual(['2026-11-01']);
    });
    it('reaching it earns 20 Marks; missing it costs nothing', () => {
        const base = computeMarks({ habits: [], tasks: [], history: {}, today: '2026-11-03' });
        const moved = computeMarks({ habits: [], tasks: [], history: {}, today: '2026-11-03', activeDays: ['2026-11-02'] });
        expect(moved.total - base.total).toBe(20);
    });
});
