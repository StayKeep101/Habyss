import { periodOf } from '../goalPlanPeriod';

describe('the period a goal plan shows', () => {
    const today = '2026-10-28'; // a Wednesday
    it('a day, and the days either side', () => {
        expect(periodOf('day', 0, today, true)).toEqual({ from: '2026-10-28', to: '2026-10-28' });
        expect(periodOf('day', 1, today, true)).toEqual({ from: '2026-10-29', to: '2026-10-29' });
    });
    it('a week from the chosen week start, then the next', () => {
        expect(periodOf('week', 0, today, true)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
        expect(periodOf('week', 0, today, false)).toEqual({ from: '2026-10-25', to: '2026-10-31' });
        expect(periodOf('week', 1, today, true)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    });
    it('a whole month, and the one after', () => {
        expect(periodOf('month', 0, today, true)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
        expect(periodOf('month', 2, today, true)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });
});
