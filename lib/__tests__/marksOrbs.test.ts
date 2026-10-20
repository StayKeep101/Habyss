import { MAX_ORBS, burstMarks, habitDone, marksRange, measureMarksTarget, noteMarksTotal, noteTouch, onMarksBurst, orbCount, registerMarksTarget, resetMarksOrbs } from '../marksOrbs';
import { MARKS } from '../marks';

beforeEach(() => resetMarksOrbs());

describe('Marks orbs', () => {
    it('sends one orb per Mark, capped', () => {
        expect(orbCount(MARKS.complete.habit)).toBe(5);
        expect(orbCount(MARKS.complete.task)).toBe(10);
        expect(orbCount(MARKS.complete.goal)).toBe(MAX_ORBS);
    });

    it('leave from the last touch', () => {
        const seen: unknown[] = [];
        const stop = onMarksBurst(burst => seen.push(burst));
        noteTouch(120, 400);
        burstMarks(5);
        expect(seen[0]).toMatchObject({ count: 5, marks: 5, from: { x: 120, y: 400 } });
        expect(burstMarks(0)).toBeNull();
        stop();
    });

    it('a habit bursts once when done, and again only after being undone', () => {
        expect(habitDone('h', '2026-10-19', true)).toBe(5);
        expect(habitDone('h', '2026-10-19', true)).toBe(0);
        expect(habitDone('h', '2026-10-19', false)).toBe(0);
        expect(habitDone('h', '2026-10-19', true)).toBe(5);
        expect(habitDone('h', '2026-10-20', true)).toBe(5);
    });

    it('lands on the registered counter, or nowhere once it is gone', () => {
        const found: unknown[] = [];
        const off = registerMarksTarget('bar', done => done({ x: 10, y: 20 }));
        measureMarksTarget(point => found.push(point));
        off();
        measureMarksTarget(point => found.push(point));
        expect(found).toEqual([{ x: 10, y: 20 }, null]);
    });

    it('counts the real total up by what was earned, whichever comes first', () => {
        // Nothing known yet: no total to show.
        expect(marksRange(10, 0)).toBeNull();
        noteMarksTotal(100, 0);
        // The data has not caught up yet: up from what it shows.
        expect(marksRange(10, 10_000)).toEqual({ from: 100, to: 110 });
        // Two in a row add up, and the data catching up later changes nothing.
        expect(marksRange(5, 10_100)).toEqual({ from: 110, to: 115 });
        noteMarksTotal(115, 10_200);
        // The data updated a moment before the orbs left: not counted twice.
        noteMarksTotal(125, 20_000);
        expect(marksRange(10, 20_300)).toEqual({ from: 115, to: 125 });
        expect(marksRange(10, 20_400)).toEqual({ from: 125, to: 135 });
    });
});
