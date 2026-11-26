import { longestRun } from '../dayComplete';

describe('longestRun', () => {
    it('finds the longest stretch of days in a row', () => {
        expect(longestRun(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07'])).toBe(3);
    });
    it('runs across months and ignores order and repeats', () => {
        expect(longestRun(['2026-11-01', '2026-10-31', '2026-10-30', '2026-10-31'])).toBe(3);
    });
    it('is nothing with no days', () => {
        expect(longestRun([])).toBe(0);
    });
});
