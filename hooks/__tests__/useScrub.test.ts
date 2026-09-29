import { centreOf, indexAt } from '../useScrub';

/**
 * The gesture cannot be exercised here — it runs on a thread Jest does not
 * have — but the arithmetic under it can be, and an off-by-one in this is a
 * chart that reads out the wrong day.
 */

describe('which point a finger is on', () => {
    describe('a line chart, where the ends sit on the edges', () => {
        const at = (px: number) => indexAt(px, 300, 31, 'points');

        it('puts the first and last points on the edges', () => {
            expect(at(0)).toBe(0);
            expect(at(300)).toBe(30);
        });

        it('rounds to the nearest point rather than the one before', () => {
            const step = 300 / 30;
            expect(at(step * 1.4)).toBe(1);
            expect(at(step * 1.6)).toBe(2);
        });

        it('clamps a finger dragged off either end', () => {
            expect(at(-40)).toBe(0);
            expect(at(900)).toBe(30);
        });
    });

    describe('a bar chart, where each day owns a slot', () => {
        const at = (px: number) => indexAt(px, 300, 30, 'slots');

        it('gives every bar an equal share of the width', () => {
            expect(at(0)).toBe(0);
            expect(at(9)).toBe(0);
            expect(at(10)).toBe(1);
            expect(at(299)).toBe(29);
        });

        it('never reads past the last bar, however far the finger goes', () => {
            expect(at(300)).toBe(29);
            expect(at(4000)).toBe(29);
        });
    });

    it('reads nothing at all before the chart has been measured', () => {
        expect(indexAt(50, 0, 30, 'slots')).toBe(-1);
        expect(indexAt(50, 300, 0, 'points')).toBe(-1);
    });
});

describe('where the mark goes', () => {
    it('sits on the point, for a line', () => {
        expect(centreOf(0, 300, 31, 'points')).toBe(0);
        expect(centreOf(30, 300, 31, 'points')).toBe(300);
        expect(centreOf(15, 300, 31, 'points')).toBe(150);
    });

    it('sits in the middle of the bar, for a slot', () => {
        expect(centreOf(0, 300, 30, 'slots')).toBe(5);
        expect(centreOf(29, 300, 30, 'slots')).toBe(295);
    });

    it('centres a chart with only one point rather than pinning it left', () => {
        expect(centreOf(0, 300, 1, 'points')).toBe(150);
    });

    it('stays put when there is nothing to read', () => {
        expect(centreOf(0, 300, 0, 'points')).toBe(0);
    });
});

describe('bars with gaps between them', () => {
    const width = 300;
    const count = 30;
    const gap = 2;

    it('puts the mark in the middle of the bar it names, at both ends', () => {
        for (const index of [0, 7, 15, 29]) {
            const centre = centreOf(index, width, count, 'slots', gap);
            expect(indexAt(centre, width, count, 'slots', gap)).toBe(index);
        }
    });

    it('lands the mark inside the bar rather than near it', () => {
        // The correction is small at this size — about a point by the end of a
        // month — but it is the difference between a crosshair on the bar and a
        // crosshair beside it, and it grows with the gap.
        const bar = (width - gap * (count - 1)) / count;
        const pitch = bar + gap;
        for (const index of [0, 15, 29]) {
            const centre = centreOf(index, width, count, 'slots', gap);
            expect(centre).toBeGreaterThanOrEqual(index * pitch);
            expect(centre).toBeLessThanOrEqual(index * pitch + bar);
        }
    });

    it('reads every point of the width as some day, gaps included', () => {
        for (let px = 0; px < width; px += 3) {
            const found = indexAt(px, width, count, 'slots', gap);
            expect(found).toBeGreaterThanOrEqual(0);
            expect(found).toBeLessThan(count);
        }
    });

    it('rises with the finger and never goes backwards', () => {
        let previous = -1;
        for (let px = 0; px <= width; px += 1) {
            const found = indexAt(px, width, count, 'slots', gap);
            expect(found).toBeGreaterThanOrEqual(previous);
            previous = found;
        }
    });
});
