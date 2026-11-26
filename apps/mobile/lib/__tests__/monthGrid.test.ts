import { monthGrid } from '../monthGrid';

describe('the month grid', () => {
    it('starts October 2026 on a Thursday under a Monday week', () => {
        const rows = monthGrid('2026-10-01', true);
        expect(rows[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
        expect(rows.flat().filter(Boolean)).toHaveLength(31);
        expect(rows.every(row => row.length === 7)).toBe(true);
    });
    it('starts on Sunday when the week does', () => {
        expect(monthGrid('2026-10-15', false)[0].slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    });
});
