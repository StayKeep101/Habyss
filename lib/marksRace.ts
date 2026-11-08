/**
 * The race on Community: you and your friends' Marks over the last weeks, one
 * line each, a face at the end of every line (components/Community/MarksRace.tsx).
 *
 * Plain geometry, so it is tested on its own. Every line shares one scale, so
 * who is ahead reads at a glance. A person with no history yet (progress
 * hidden, or not opened since the history was added) is still on the race: a
 * face at their total, with no line.
 */

import type { FriendStatus } from './presence';

export interface Racer {
    id: string;
    /** What they are doing now (lib/presence.ts): worn on their face. */
    status?: FriendStatus;
    name: string;
    avatarUrl?: string;
    marks: number;
    /** Running total by day, oldest first, ending on their latest day. */
    series?: number[];
    me?: boolean;
}

export interface RaceFrame {
    width: number;
    height: number;
    /** Days shown, counted back from the right edge. */
    days: number;
    /** Room on the right for the faces. */
    gutter: number;
    /** Highest and lowest y a line may reach. */
    top: number;
    bottom: number;
    /** Faces never closer than this, centre to centre. */
    gap: number;
}

export interface RaceLine {
    id: string;
    status?: FriendStatus;
    me: boolean;
    name: string;
    avatarUrl?: string;
    marks: number;
    /** The smooth line, or null with fewer than two days of history. */
    path: string | null;
    /** The area under the line to the bottom edge (for your own line's glow). */
    area: string | null;
    /** Where the line ends. */
    end: { x: number; y: number };
    /** Each day of the frame, oldest first: the point and its total, or null before their history starts. */
    days: ({ x: number; y: number; value: number } | null)[];
    /** The face's centre: the end of the line itself. */
    face: { x: number; y: number };
    /**
     * The line as drawn, for following it with a face: the knots the curve
     * passes through and each piece's control point (y), x evenly spaced.
     */
    curve: { kx: number[]; ky: number[]; cy: number[] };
}

/** At most this many friends on the race (the leaders), you always included. */
export const RACE_SIZE = 8;

/** The friends worth drawing: the leaders, and you wherever you stand. */
export function racersShown(racers: Racer[], size = RACE_SIZE): Racer[] {
    const sorted = [...racers].sort((a, b) => b.marks - a.marks);
    const me = sorted.find(racer => racer.me);
    const others = sorted.filter(racer => !racer.me).slice(0, size);
    return me ? [...others, me] : others;
}

/** The last `days` values of a series, the newest last; its total if it has none. */
function recent(racer: Racer, days: number): number[] {
    const series = (racer.series ?? []).filter(value => Number.isFinite(value)).slice(-days);
    return series.length ? series : [racer.marks];
}

/**
 * The pieces of `smoothPath`: it runs from the first point through each
 * midpoint to the last, each piece a quadratic curve whose control is a point.
 */
function curveOf(points: { x: number; y: number }[]): RaceLine['curve'] {
    if (points.length < 2) return { kx: [points[0].x], ky: [points[0].y], cy: [points[0].y] };
    const knots = [points[0]];
    for (let i = 1; i < points.length; i++) knots.push({ x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2 });
    knots.push(points[points.length - 1]);
    return { kx: knots.map(k => k.x), ky: knots.map(k => k.y), cy: points.map(p => p.y) };
}

/** The height of a line at `x` along its curve (a worklet: a face rides it during the replay). */
export function curveY(curve: RaceLine['curve'], x: number): number {
    'worklet';
    const { kx, ky, cy } = curve;
    if (kx.length < 2 || x <= kx[0]) return ky[0];
    const last = kx.length - 1;
    if (x >= kx[last]) return ky[last];
    let j = 0;
    while (j < last - 1 && x > kx[j + 1]) j++;
    const t = (x - kx[j]) / Math.max(1e-6, kx[j + 1] - kx[j]);
    return (1 - t) * (1 - t) * ky[j] + 2 * (1 - t) * t * cy[j] + t * t * ky[j + 1];
}

/** A smooth line through the points (midpoint quadratic curves, as on a profile). */
export function smoothPath(points: { x: number; y: number }[]): string {
    let line = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const point = points[i];
        line += ` Q ${prev.x} ${prev.y} ${(prev.x + point.x) / 2} ${(prev.y + point.y) / 2}`;
    }
    const last = points[points.length - 1];
    return `${line} T ${last.x} ${last.y}`;
}

/**
 * Spreads the faces so none overlap, keeping their order top to bottom and
 * staying as near their lines as the space allows.
 */
export function spread(ys: number[], gap: number, top: number, bottom: number): number[] {
    const order = ys.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
    const placed = order.map(item => item.y);
    // Down from the top, then back up from the bottom: the classic two-pass label spread.
    for (let i = 0; i < placed.length; i++) placed[i] = Math.max(placed[i], i === 0 ? top : placed[i - 1] + gap);
    for (let i = placed.length - 1; i >= 0; i--) placed[i] = Math.min(placed[i], i === placed.length - 1 ? bottom : placed[i + 1] - gap);
    const out = new Array<number>(ys.length);
    order.forEach((item, i) => { out[item.index] = placed[i]; });
    return out;
}

export function raceLines(racers: Racer[], frame: RaceFrame): RaceLine[] {
    if (!racers.length || frame.width <= frame.gutter) return [];
    const windows = racers.map(racer => recent(racer, frame.days));
    const values = windows.flat();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const right = frame.width - frame.gutter;
    const step = right / Math.max(1, frame.days - 1);
    const yOf = (value: number) => frame.bottom - ((value - min) / span) * (frame.bottom - frame.top);

    const lines = racers.map((racer, index) => {
        const series = windows[index];
        // Right-aligned: the newest day on the right edge, shorter histories start later.
        const points = series.map((value, day) => ({ x: right - (series.length - 1 - day) * step, y: yOf(value), value }));
        const offset = frame.days - series.length;
        const days = Array.from({ length: frame.days }, (_, day) => (day >= offset ? points[day - offset] : null));
        const last = points[points.length - 1];
        const end = { x: last.x, y: last.y };
        const path = points.length > 1 ? smoothPath(points) : null;
        return {
            id: racer.id, status: racer.status, me: !!racer.me, name: racer.name, avatarUrl: racer.avatarUrl, marks: racer.marks,
            path,
            days,
            area: path ? `${path} L ${end.x} ${frame.height} L ${points[0].x} ${frame.height} Z` : null,
            end,
            face: end,
            curve: curveOf(points),
        };
    });
    return lines;
}

/** The day of the frame under a finger at `x`: 0 (oldest) to days − 1 (today). */
export function dayAt(x: number, frame: Pick<RaceFrame, 'width' | 'gutter' | 'days'>): number {
    const right = frame.width - frame.gutter;
    const step = right / Math.max(1, frame.days - 1);
    return Math.max(0, Math.min(frame.days - 1, Math.round(x / step)));
}

/** Your place among everyone with a total that day (1 is first), or null if you have none. */
export function placeOn(lines: RaceLine[], day: number): { place: number; of: number } | null {
    const that = lines.flatMap(line => (line.days[day] ? [{ me: line.me, value: line.days[day]!.value }] : []));
    const mine = that.find(item => item.me);
    if (!mine) return null;
    return { place: 1 + that.filter(item => !item.me && item.value > mine.value).length, of: that.length };
}

/** A face on the race, where it is drawn: what a tap is matched against. */
export interface RaceFace { id: string; me: boolean; x: number; y: number; size: number }

/** The face under a tap at (x, y), allowing every face a 44-point target; the nearest wins. */
export function faceAt(faces: RaceFace[], x: number, y: number, target = 44): RaceFace | null {
    let best: RaceFace | null = null;
    let bestDistance = Infinity;
    for (const face of faces) {
        const distance = Math.hypot(face.x - x, face.y - y);
        if (distance <= Math.max(face.size, target) / 2 && distance < bestDistance) { best = face; bestDistance = distance; }
    }
    return best;
}
