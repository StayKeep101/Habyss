import { curveY, dayAt, faceAt, placeOn, raceLines, racersShown, spread, type RaceFrame } from '../marksRace';

const frame: RaceFrame = { width: 300, height: 200, days: 5, gutter: 40, top: 20, bottom: 180, gap: 30 };

describe('marksRace', () => {
    it('puts the leader at the top and the newest day on the right', () => {
        const lines = raceLines([
            { id: 'a', name: 'A', marks: 100, series: [10, 40, 70, 100] },
            { id: 'b', name: 'B', marks: 10, series: [10, 10, 10, 10] },
        ], frame);
        expect(lines[0].end).toEqual({ x: 260, y: 20 });
        expect(lines[1].end.y).toBe(180);
        expect(lines[0].path).toMatch(/^M /);
    });

    it('keeps a racer without history as a face at their total, with no line', () => {
        const [line] = raceLines([{ id: 'a', name: 'A', marks: 50 }], frame);
        expect(line.path).toBeNull();
        expect(line.face.x).toBe(260);
    });

    it('spreads faces apart without changing their order', () => {
        const ys = spread([100, 101, 102], 30, 0, 300);
        expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(30);
        expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(30);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    });

    it('keeps faces inside the frame when they crowd an edge', () => {
        const ys = spread([300, 300, 300], 30, 0, 300);
        expect(Math.max(...ys)).toBeLessThanOrEqual(300);
    });

    it('shows the leaders and you, wherever you stand', () => {
        const racers = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: String(i), marks: 100 - i }));
        const shown = racersShown([...racers, { id: 'me', name: 'Me', marks: 1, me: true }], 8);
        expect(shown).toHaveLength(9);
        expect(shown.some(racer => racer.me)).toBe(true);
    });
});

describe('reading a day', () => {
    const lines = raceLines([
        { id: 'a', name: 'A', marks: 100, series: [10, 40, 70, 100] },
        { id: 'me', name: 'Me', marks: 120, series: [20, 50, 120], me: true },
    ], frame);

    it('lines up each day on one grid, empty before a history starts', () => {
        expect(lines[0].days[0]).toBeNull();
        expect(lines[0].days[1]?.value).toBe(10);
        expect(lines[1].days[1]).toBeNull();
        expect(lines[1].days[4]?.value).toBe(120);
    });

    it('finds the day under a finger', () => {
        expect(dayAt(0, frame)).toBe(0);
        expect(dayAt(260, frame)).toBe(4);
        expect(dayAt(999, frame)).toBe(4);
    });

    it('works out your place on a day', () => {
        expect(placeOn(lines, 3)).toEqual({ place: 2, of: 2 });
        expect(placeOn(lines, 4)).toEqual({ place: 1, of: 2 });
        expect(placeOn(lines, 1)).toBeNull();
    });
});

describe('following a line', () => {
    it('puts each face on the end of its line and follows the curve', () => {
        const [line] = raceLines([{ id: 'a', name: 'A', marks: 100, series: [10, 40, 70, 100] }], frame);
        expect(line.face).toEqual(line.end);
        expect(curveY(line.curve, line.end.x)).toBeCloseTo(line.end.y);
        expect(curveY(line.curve, 0)).toBeCloseTo(line.curve.ky[0]);
        const mid = curveY(line.curve, (line.curve.kx[1] + line.curve.kx[2]) / 2);
        expect(mid).toBeLessThan(line.curve.ky[1]);
        expect(mid).toBeGreaterThan(line.curve.ky[2]);
    });
});

describe('tapping a face', () => {
    const faces = [
        { id: 'a', me: false, x: 100, y: 100, size: 28 },
        { id: 'b', me: false, x: 100, y: 130, size: 28 },
    ];
    it('finds the nearest face within a 44-point target', () => {
        expect(faceAt(faces, 100, 108)?.id).toBe('a');
        expect(faceAt(faces, 100, 124)?.id).toBe('b');
        expect(faceAt(faces, 100, 160)).toBeNull();
    });
});
