/**
 * The hourglass's sand, worked out as sand, not drawn as a shape (drawn by
 * components/Home/SkiaHourglass.tsx). On the art's own grid, y pointing down.
 *
 * Three facts of granular matter do all the work:
 *
 * 1. Gravity has a direction on screen (the phone's tilt, from the
 *    accelerometer). Grains in the air fall straight along it.
 * 2. Sand at rest stands at its angle of repose: a heap's sides slope at
 *    `repose` (rise over run, measured against gravity, not the screen). A
 *    resting surface only moves when the glass leans past what sand holds;
 *    then it slides (the caller's `rest` angle, which lags gravity). Shaken,
 *    sand loosens (`repose` drops) and slumps flatter.
 * 3. Sand is conserved. The top bulb holds (1 − run) of it, the bottom run of
 *    it, measured as area inside each bulb; each heap's height is solved so
 *    its area is exactly that, so a tilt moves sand, never makes or loses it.
 *
 * The top bulb drains through the neck: its surface is level (in the resting
 * frame) except over the drain, where a funnel at the angle of repose dips into
 * it. The bottom bulb holds a heap whose peak is where the falling grains land
 * (on the line from the neck along gravity), sides at the angle of repose; it
 * spreads until it meets a wall, then piles up against it.
 *
 * Every function is a worklet: it runs on the UI thread, every frame.
 */

export interface Bulbs {
    /** Column x positions, and for each, where the inside of each bulb starts and ends (y). */
    xs: number[];
    topLo: number[];
    topHi: number[];
    botLo: number[];
    botHi: number[];
    cx: number;
    neck: number;
}

/** A column's inside of each bulb, from the glass outline ([y, left, right] rows), brought in by `inset`. */
export function makeBulbs(outline: [number, number, number][], cx: number, neck: number, inset: number, step = 8): Bulbs {
    const left = Math.min(...outline.map(row => row[1])) + inset;
    const right = Math.max(...outline.map(row => row[2])) - inset;
    const bulbs: Bulbs = { xs: [], topLo: [], topHi: [], botLo: [], botHi: [], cx, neck };
    for (let x = left; x <= right; x += step) {
        const inside = outline.filter(([, l, r]) => x >= l + inset && x <= r - inset).map(([y]) => y);
        const top = inside.filter(y => y < neck);
        const bottom = inside.filter(y => y > neck);
        bulbs.xs.push(x);
        bulbs.topLo.push(top.length ? Math.min(...top) : neck);
        bulbs.topHi.push(top.length ? Math.max(...top) : neck);
        bulbs.botLo.push(bottom.length ? Math.min(...bottom) : neck);
        bulbs.botHi.push(bottom.length ? Math.max(...bottom) : neck);
    }
    return bulbs;
}

/** How deep the dimple over the drain is, below the level (art units). */
export const DIP = 26;

/**
 * The top bulb's surface over column x: level at `L` (height against gravity,
 * resting frame), but for the dimple over the drain: an upturned cone, sides
 * at the angle of repose, its point `DIP` below the level, over the drain (in
 * the resting sand's frame, never below the drain itself).
 */
export function topSurface(x: number, L: number, rest: number, _gravity: number, repose: number, b: Bulbs, dip = DIP): number {
    'worklet';
    // All in the resting sand's own frame: the dimple is part of its surface.
    const c = Math.cos(rest), sn = Math.sin(rest);
    const level = (-L - x * sn) / c;
    const wD = b.cx * c - b.neck * sn;
    const hD = Math.max(-(b.cx * sn + b.neck * c), L - dip);
    const a = -(hD + repose * x * c - repose * wD + x * sn) / (c - repose * sn);
    const bb = -(hD - repose * x * c + repose * wD + x * sn) / (c + repose * sn);
    return Math.max(level, Math.min(a, bb));
}

export function topArea(L: number, rest: number, gravity: number, repose: number, b: Bulbs, dip = DIP): number {
    'worklet';
    let area = 0;
    const dx = b.xs.length > 1 ? b.xs[1] - b.xs[0] : 1;
    for (let i = 0; i < b.xs.length; i++) {
        const start = Math.max(b.topLo[i], topSurface(b.xs[i], L, rest, gravity, repose, b, dip));
        area += Math.max(0, b.topHi[i] - start) * dx;
    }
    return area;
}

/** Where the bottom heap peaks for a peak height `hP` (resting frame): on the line the grains fall along. */
export function heapPeak(hP: number, rest: number, gravity: number, b: Bulbs): { x: number; y: number; w: number } {
    'worklet';
    const c = Math.cos(rest), s = Math.sin(rest);
    const tg = Math.tan(gravity);
    const y = (-hP - b.cx * s + tg * b.neck * s) / (tg * s + c);
    const x = b.cx + tg * (y - b.neck);
    return { x, y, w: x * c - y * s };
}

/** The bottom heap's surface over column x, for a peak height `hP`. */
export function heapSurface(x: number, hP: number, wP: number, rest: number, repose: number): number {
    'worklet';
    const c = Math.cos(rest), s = Math.sin(rest);
    const right = -(hP - repose * x * c + repose * wP + x * s) / (c + repose * s);
    const left = -(hP + repose * x * c - repose * wP + x * s) / (c - repose * s);
    return Math.max(right, left);
}

export function heapArea(hP: number, rest: number, gravity: number, repose: number, b: Bulbs): number {
    'worklet';
    const peak = heapPeak(hP, rest, gravity, b);
    let area = 0;
    const dx = b.xs.length > 1 ? b.xs[1] - b.xs[0] : 1;
    for (let i = 0; i < b.xs.length; i++) {
        const start = Math.max(b.botLo[i], heapSurface(b.xs[i], hP, peak.w, rest, repose));
        area += Math.max(0, b.botHi[i] - start) * dx;
    }
    return area;
}

/** Solves for the top bulb's level holding `volume` of sand. */
export function solveTop(volume: number, rest: number, gravity: number, repose: number, b: Bulbs, glassTop: number, dip = DIP): number {
    'worklet';
    // Height is −y (more or less): from the neck (empty) up past the top of the glass (full).
    let lo = -b.neck - 400, hi = -glassTop + 400;
    for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (topArea(mid, rest, gravity, repose, b, dip) < volume) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

/** Solves for the bottom heap's peak height holding `volume` of sand. */
export function solveHeap(volume: number, rest: number, gravity: number, repose: number, b: Bulbs, glassBottom: number): number {
    'worklet';
    let lo = -glassBottom - 600, hi = -b.neck + 200;
    for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (heapArea(mid, rest, gravity, repose, b) < volume) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}
