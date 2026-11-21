import { heapArea, heapPeak, heapSurface, makeBulbs, solveHeap, solveTop, topArea, topSurface } from '../sandPhysics';
import { readFileSync } from 'fs';

const src = readFileSync(`${__dirname}/../../components/Home/SkiaHourglass.tsx`, 'utf8');
const OUTLINE = JSON.parse(src.match(/const OUTLINE[^=]*= (\[[\s\S]*?\]);/)![1].replace(/\s+/g, '').replace(/,\]$/, ']')) as [number, number, number][];
const b = makeBulbs(OUTLINE, 312, 435, 9);
const REPOSE = 0.62;
const TOTAL = topArea(-175, 0, 0, REPOSE, b);

describe('sand', () => {
    it('fills a full top bulb, not just a sliver (the dimple stays a dimple)', () => {
        const bulb = b.xs.reduce((sum, _x, i) => sum + Math.max(0, b.topHi[i] - b.topLo[i]) * 8, 0);
        expect(TOTAL / bulb).toBeGreaterThan(0.55);
    });

    it('is conserved: whatever the tilt, the top and bottom hold what they should', () => {
        for (const [run, tilt, rest] of [[0.3, 0, 0], [0.5, 0.5, 0.25], [0.7, -0.6, -0.3], [0.9, 0.2, 0]]) {
            const L = solveTop((1 - run) * TOTAL, rest, tilt, REPOSE, b, 87);
            const hP = solveHeap(run * TOTAL, rest, tilt, REPOSE, b, 747);
            expect(topArea(L, rest, tilt, REPOSE, b) / TOTAL).toBeCloseTo(1 - run, 2);
            expect(heapArea(hP, rest, tilt, REPOSE, b) / TOTAL).toBeCloseTo(run, 2);
        }
    });

    it('falls the way gravity points, and piles up on that side', () => {
        // Gravity towards the left of the screen (phone tilted left).
        const tilt = -0.5, rest = -0.3;
        const hP = solveHeap(0.4 * TOTAL, rest, tilt, REPOSE, b, 747);
        const peak = heapPeak(hP, rest, tilt, b);
        expect(peak.x).toBeLessThan(312);
        // More sand against the left wall than the right.
        expect(heapSurface(150, hP, peak.w, rest, REPOSE)).toBeLessThan(heapSurface(475, hP, peak.w, rest, REPOSE));
        // And the top bulb's sand slides to the left too.
        const L = solveTop(0.6 * TOTAL, rest, tilt, REPOSE, b, 87);
        expect(topSurface(140, L, rest, tilt, REPOSE, b)).toBeLessThan(topSurface(480, L, rest, tilt, REPOSE, b));
    });

    it('stands upright with the peak under the neck when the glass is level', () => {
        const hP = solveHeap(0.3 * TOTAL, 0, 0, REPOSE, b, 747);
        expect(heapPeak(hP, 0, 0, b).x).toBeCloseTo(312, 3);
        const left = heapSurface(250, hP, 312, 0, REPOSE), right = heapSurface(374, hP, 312, 0, REPOSE);
        expect(left).toBeCloseTo(right, 3);
    });

    it('has a funnel over the drain', () => {
        const L = solveTop(0.6 * TOTAL, 0, 0, REPOSE, b, 87);
        expect(topSurface(312, L, 0, 0, REPOSE, b)).toBeGreaterThan(topSurface(200, L, 0, 0, REPOSE, b));
    });
});
