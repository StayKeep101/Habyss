import React, { useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useAnimatedReaction, useDerivedValue, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import {
    BlurMask, Canvas, ClipOp, ColorMatrix, Group, Paint, Image as SkiaImage, LinearGradient, Path, Picture, RoundedRect, Skia, createPicture, useClock, useImage, vec,
} from '@shopify/react-native-skia';
import { mixHex } from '@/lib/colorContrast';
import { Colors } from '@/theme/colors';
import { HOURGLASS_INK, HOURGLASS_OPACITY } from '@/theme/hourglassArt';
import type { GlassFrame } from '@/theme/hourglassFrames';
import { DURATION, EASE } from '@/theme/motion';
import { heapPeak, heapSurface, makeBulbs, solveHeap, solveTop, topArea, topSurface } from '@/lib/sandPhysics';

// Built once, outside any worklet: the slide of an avalanche, and the heaps settling back.
const AVALANCHE = { duration: DURATION.base, easing: EASE.enter };

/**
 * Home's hourglass, live with Skia: the rank's own frame (theme/hourglassFrames.ts,
 * the art with its glass traced), or for a rank without one, the blue
 * hourglass drawn (its outline traced from the art, on its grid, 622 × 836).
 * Over an art frame, the art's own glass light is laid back over the sand, so
 * the sand sits inside the glass, not on it. The frame is still; the sand is alive: its surface sways and sinks as the day
 * runs, grains fall under gravity onto a mound that grows, and both lean with
 * the phone's tilt. A band of light drifts across the glass. Only the sand is
 * the rank's colour. Reduce Motion: the sand sits still at the right level.
 *
 * Loaded only on a build that has Skia (components/Home/DayHourglass.tsx).
 */
const W = 622;
const H = 836;
const GLASS_TOP = 87;
const GLASS_BOTTOM = 747;
/** How far down its bulb the top sand starts the day. */
const TOP_FULL = 0.25;
/** The rim, inside which the sand stays (art units). */
const INSET = 9;
/** Grains in the air at once, and how long one takes to fall (ms). */
const GRAINS = 36;
const FALL_MS = 700;
/**
 * Sand's angle of repose, on screen: the steepest a heap's side can stand, so
 * the slope of the funnel in the top bulb and of the cone below. And the tilt
 * the heaps hold through before they slide: sand keeps its shape when the
 * glass leans a little, then gives way all at once, unlike water.
 */
const REPOSE = 0.62;
/** How strongly the sand answers the phone's tilt and shaking (1: fully). */
const SENSITIVITY = 0.5;
/**
 * The top bulb's sand, as in a real glass: a flat surface (no dent over the neck)
 * that barely shifts when the phone leans; only the heap below answers the tilt.
 */
const TOP_LEAN = 0.01;
const TOP_DIP = 0;
const HOLD = 0.35;
/** The grain of the sand: fixed specks over both heaps, [x, y, light?] on the art's grid. */
const specksFor = (width: number, top: number, bottom: number): [number, number, boolean][] => Array.from({ length: 260 }, (_, i) => {
    const a = Math.sin(i * 127.1) * 43758.5453, b = Math.sin(i * 311.7) * 24634.6345;
    return [80 + (a - Math.floor(a)) * (width - 160), top + (b - Math.floor(b)) * (bottom - top), i % 3 === 0];
});

/** The glass's outline, traced from the art: [y, left, right] on the art's grid. */
const OUTLINE: [number, number, number][] = [
    [87, 122, 501], [99, 112, 510], [111, 105, 517], [123, 99, 524], [135, 94, 529], [147, 91, 532], [159, 89, 535], [171, 89, 536], [183, 89, 537],
    [195, 89, 537], [207, 89, 535], [219, 90, 533], [231, 93, 529], [243, 98, 525], [255, 103, 519], [267, 110, 513], [279, 118, 505], [291, 126, 496],
    [303, 136, 486], [315, 147, 475], [327, 159, 463], [339, 173, 449], [351, 186, 435], [363, 202, 420], [375, 218, 404], [387, 234, 387], [399, 250, 371],
    [411, 263, 358], [423, 271, 351], [435, 272, 349], [447, 270, 352], [459, 260, 361], [471, 246, 376], [483, 228, 393], [495, 212, 409], [507, 196, 425],
    [519, 181, 440], [531, 168, 453], [543, 155, 466], [555, 144, 478], [567, 133, 488], [579, 124, 497], [591, 116, 505], [603, 109, 512], [615, 103, 518],
    [627, 98, 523], [639, 94, 527], [651, 91, 530], [663, 90, 532], [675, 89, 533], [687, 89, 533], [699, 90, 531], [711, 93, 529], [723, 96, 525],
    [735, 102, 519], [747, 110, 511],
];

/** The drawn blue hourglass, as a frame without art. */
const DRAWN: Omit<GlassFrame, 'image' | 'light' | 'foot' | 'brightness'> = { width: W, height: H, cx: 312, neck: 435, top: GLASS_TOP, bottom: GLASS_BOTTOM, outline: OUTLINE };

/**
 * Everything the sand needs from a frame: each bulb's inside, column by column;
 * all the sand there is (the top bulb full to TOP_FULL); the grain; the glass.
 */
function geometry(frame: Omit<GlassFrame, 'image' | 'light' | 'foot' | 'brightness'>) {
    const bulbs = makeBulbs(frame.outline, frame.cx, frame.neck, INSET);
    const full = frame.top + (frame.neck - frame.top) * TOP_FULL;
    return {
        ...frame,
        bulbs,
        total: topArea(-full, 0, 0, REPOSE, bulbs, TOP_DIP),
        specks: specksFor(frame.width, frame.top, frame.bottom),
        outer: glassPath(frame.outline, 0),
        inner: glassPath(frame.outline, INSET),
    };
}

/** A smooth closed path through the outline, brought in by `inset` from the rim. */
function glassPath(outline: [number, number, number][], inset: number) {
    const path = Skia.Path.Make();
    const right = outline.map(([y, , r]) => [r - inset, y] as const);
    const left = [...outline].reverse().map(([y, l]) => [l + inset, y] as const);
    const points = [...right, ...left];
    path.moveTo(points[0][0], points[0][1] + inset);
    for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        path.quadTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    path.close();
    return path;
}

export function SkiaHourglass({ size, ran, running, sand, tilt, shake, frame }: {
    /** Height in points; the width follows the art. */
    size: number;
    /** The rank's frame (theme/hourglassFrames.ts); without one, the blue hourglass drawn. */
    frame?: GlassFrame;
    ran: SharedValue<number>;
    running: boolean;
    /** The rank's sand: [light, deep]. */
    sand: [string, string];
    /** Gravity's direction across the screen, in radians (0: straight down; positive: towards the right). */
    tilt?: SharedValue<number>;
    /** How hard the phone is being shaken, 0 to 1: shaken sand loosens and slumps flatter. */
    shake?: SharedValue<number>;
}) {
    const reduced = useReducedMotion();
    const clock = useClock();
    const still = useSharedValue(0);
    const lean = tilt ?? still;
    const geo = useMemo(() => geometry(frame ?? DRAWN), [frame]);
    const art = useImage(frame?.image as number | undefined);
    const scale = size / geo.height;
    const width = geo.width * scale;
    const { outer, inner, bulbs: BULBS, total: TOTAL, specks: SPECKS, cx: CX, neck: NECK, top: TOP, bottom: BOTTOM, width: FW, height: FH } = geo;
    const light = useMemo(() => mixHex(sand[0], Colors.common.white, 0.2), [sand]);
    const deep = sand[1];
    // Light glass (the crystal) shows light sand by its edge: the surface in a shade of the sand.
    const edged = !!frame && frame.light < 0.5;
    const edge = useMemo(() => mixHex(sand[1], Colors.common.black, 0.45), [sand]);

    // How the resting sand lies: held where it is until the glass leans past what sand
    // holds, then a quick slide (an avalanche) towards gravity, and still again. Shaken,
    // it gives way at once and settles with gravity.
    const jolt = shake ?? still;
    const settled = useSharedValue(0);
    useAnimatedReaction(() => (reduced ? 0 : lean.value), angle => {
        const gap = angle - settled.value;
        const hold = HOLD * (1 - 0.8 * jolt.value);
        if (Math.abs(gap) > hold) settled.value = withTiming(angle - Math.sign(gap) * hold * 0.5, AVALANCHE);
    });

    // The living sand, recorded fresh each frame on the UI thread.
    const picture = useDerivedValue(() => {
        const t = reduced ? 0 : clock.value;
        const r = Math.min(1, Math.max(0, ran.value));
        // Gravity, for what falls; the resting angle, for what rests; looser when shaken (lib/sandPhysics.ts).
        const gravity = reduced ? 0 : Math.max(-0.7, Math.min(0.7, lean.value));
        const rest = reduced ? 0 : settled.value;
        const loose = reduced ? 0 : Math.min(1, jolt.value);
        const repose = REPOSE * (1 - 0.75 * loose);
        const tg = Math.tan(gravity);
        return createPicture(canvas => {
            const paint = Skia.Paint();
            paint.setAntiAlias(true);
            canvas.save();
            canvas.clipPath(inner, ClipOp.Intersect, true);
            const shader = Skia.Shader.MakeLinearGradient(vec(0, TOP), vec(0, BOTTOM),
                [Skia.Color(light), Skia.Color(deep)], null, 0);
            paint.setShader(shader);

            // The top bulb: what is left of the sand, level but for the funnel over the drain.
            const topRest = rest * TOP_LEAN;
            const L = solveTop((1 - r) * TOTAL, topRest, gravity, repose, BULBS, TOP, TOP_DIP);
            const quiver = (x: number) => loose * 5 * Math.sin(x * 0.21 + t * 0.06);
            const top = Skia.Path.Make();
            top.moveTo(BULBS.xs[0], NECK + 4);
            const topEdge = Skia.Path.Make();
            for (const x of BULBS.xs) {
                const y = Math.min(NECK + 2, topSurface(x, L, topRest, gravity, repose, BULBS, TOP_DIP) + quiver(x) * TOP_LEAN);
                top.lineTo(x, y);
                if (x === BULBS.xs[0]) topEdge.moveTo(x, y); else topEdge.lineTo(x, y);
            }
            top.lineTo(BULBS.xs[BULBS.xs.length - 1], NECK + 4);
            top.close();
            canvas.drawPath(top, paint);

            // The bottom bulb: a heap holding exactly what fell, peaking where the grains land.
            const hP = solveHeap(r * TOTAL, rest, gravity, repose, BULBS, BOTTOM);
            const peak = heapPeak(hP, rest, gravity, BULBS);
            const pile = Skia.Path.Make();
            pile.moveTo(BULBS.xs[0], BOTTOM + 4);
            const pileEdge = Skia.Path.Make();
            for (const x of BULBS.xs) {
                const y = Math.max(NECK + 6, heapSurface(x, hP, peak.w, rest, repose) + quiver(x + 40));
                pile.lineTo(x, y);
                if (x === BULBS.xs[0]) pileEdge.moveTo(x, y); else pileEdge.lineTo(x, y);
            }
            pile.lineTo(BULBS.xs[BULBS.xs.length - 1], BOTTOM + 4);
            pile.close();
            canvas.drawPath(pile, paint);
            paint.setShader(null);

            // The grain: specks of light and shade over both heaps, never on the glass.
            const specks = Skia.Path.Make();
            specks.addPath(top);
            specks.addPath(pile);
            canvas.save();
            canvas.clipPath(specks, ClipOp.Intersect, true);
            for (const [x, y, bright] of SPECKS) {
                paint.setColor(Skia.Color(bright ? light : deep));
                paint.setAlphaf(bright ? 0.55 : 0.4);
                canvas.drawCircle(x, y, bright ? 2.2 : 2.6, paint);
            }
            paint.setAlphaf(1);
            canvas.restore();
            if (edged) {
                const line = Skia.Paint();
                line.setAntiAlias(true);
                line.setStyle(1);
                line.setStrokeWidth(5);
                line.setColor(Skia.Color(edge));
                line.setAlphaf(0.55);
                if (r < 0.995) canvas.drawPath(topEdge, line);
                if (r > 0.005) canvas.drawPath(pileEdge, line);
            }

            if (running && !reduced && r > 0.001 && r < 0.999) {
                // The stream: grains leave the neck and fall straight along gravity, faster as
                // they go, to where they meet the heap (its peak sits on that line).
                paint.setColor(Skia.Color(light));
                const land = Math.max(NECK + 12, Math.min(BOTTOM, peak.y));
                const along = (y: number) => CX + tg * (y - NECK);
                paint.setAlphaf(0.35);
                const stream = Skia.Path.Make();
                stream.moveTo(CX - 1.6, NECK - 10);
                stream.lineTo(CX + 1.6, NECK - 10);
                stream.lineTo(along(land) + 1.6, land);
                stream.lineTo(along(land) - 1.6, land);
                stream.close();
                canvas.drawPath(stream, paint);
                for (let i = 0; i < GRAINS; i++) {
                    const phase = ((t / FALL_MS) + i / GRAINS) % 1;
                    const y = NECK - 6 + phase * phase * (land - NECK + 6);
                    paint.setAlphaf(phase > 0.92 ? (1 - phase) * 12 : 0.95);
                    canvas.drawCircle(along(y) + Math.sin(i * 12.9898) * 1.8 * phase, y, 2.1, paint);
                }
                // Now and then a grain rolls from the peak down the heap's side and stops.
                for (let i = 0; i < 4; i++) {
                    const phase = ((t / 1600) + i / 4) % 1;
                    const x = peak.x + (i % 2 === 0 ? -1 : 1) * phase * 120;
                    const y = heapSurface(x, hP, peak.w, rest, repose) - 2.5;
                    if (y < BOTTOM - 4 && x > BULBS.xs[0] && x < BULBS.xs[BULBS.xs.length - 1]) {
                        paint.setAlphaf(phase < 0.8 ? 0.9 : (1 - phase) * 4.5);
                        canvas.drawCircle(x, y, 2.2, paint);
                    }
                }
                paint.setAlphaf(1);
            }

            // A band of light drifting across the glass, a little further with the tilt.
            if (!reduced) {
                const drift = ((t / 7000) % 1) * (FW + 300) - 150 + tg * 80;
                const sheen = Skia.Shader.MakeLinearGradient(vec(drift - 90, 0), vec(drift + 90, FH),
                    [Skia.Color('rgba(255,255,255,0)'), Skia.Color('rgba(255,255,255,0.10)'), Skia.Color('rgba(255,255,255,0)')], null, 0);
                const band = Skia.Paint();
                band.setShader(sheen);
                canvas.drawRect(Skia.XYWHRect(0, TOP, FW, BOTTOM - TOP), band);
            }
            canvas.restore();
        }, Skia.XYWHRect(0, 0, FW, FH));
    });

    return (
        <Canvas style={{ width, height: size }}>
            {frame ? (
                // Dimmed and see-through as a whole (frame and sand) to sit in the night scene.
                <Group transform={[{ scale }]} layer={(
                    <Paint>
                        <ColorMatrix matrix={[frame.brightness, 0, 0, 0, 0, 0, frame.brightness, 0, 0, 0, 0, 0, frame.brightness, 0, 0, 0, 0, 0, HOURGLASS_OPACITY, 0]} />
                    </Paint>
                )}>
                    {/* The rank's frame; the sand inside its glass; then the glass's own light back over the sand. */}
                    {art ? <SkiaImage image={art} x={0} y={0} width={FW} height={FH} fit="fill" /> : null}
                    <Picture picture={picture} />
                    {art ? (
                        <Group clip={inner}>
                            <SkiaImage image={art} x={0} y={0} width={FW} height={FH} fit="fill" blendMode="screen" opacity={frame.light} />
                        </Group>
                    ) : null}
                </Group>
            ) : (
            <Group transform={[{ scale }]}>
                {/* Pillars, then the glass and its glowing rim, then the caps over the ends. */}
                {[38, 548].map(x => (
                    <RoundedRect key={x} x={x} y={80} width={37} height={680} r={10}>
                        <LinearGradient start={vec(x, 0)} end={vec(x + 37, 0)} colors={[...HOURGLASS_INK.pillar]} />
                    </RoundedRect>
                ))}
                <Path path={outer}>
                    <LinearGradient start={vec(0, GLASS_TOP)} end={vec(0, GLASS_BOTTOM)} colors={[...HOURGLASS_INK.glass]} />
                </Path>
                <Picture picture={picture} />
                <Path path={outer} style="stroke" strokeWidth={14} color={HOURGLASS_INK.rimGlow} opacity={0.35}>
                    <BlurMask blur={10} style="normal" />
                </Path>
                <Path path={outer} style="stroke" strokeWidth={6} color={HOURGLASS_INK.rim} opacity={0.85} />
                {/* One soft highlight down each bulb. */}
                <Path path="M 130 150 C 118 205 132 255 170 300" style="stroke" strokeWidth={10} strokeCap="round" color={Colors.common.white} opacity={0.18}>
                    <BlurMask blur={3} style="normal" />
                </Path>
                <Path path="M 128 600 C 118 645 126 690 158 720" style="stroke" strokeWidth={8} strokeCap="round" color={Colors.common.white} opacity={0.12}>
                    <BlurMask blur={3} style="normal" />
                </Path>
                {[0, H - 88].map(y => (
                    <RoundedRect key={y} x={1} y={y} width={W - 2} height={87} r={40}>
                        <LinearGradient start={vec(0, y)} end={vec(0, y + 87)} colors={[...HOURGLASS_INK.cap]} positions={[0, 0.25, 1]} />
                    </RoundedRect>
                ))}
            </Group>
            )}
        </Canvas>
    );
}

/**
 * The phone's motion, for the sand: gravity's direction across the screen (from
 * the accelerometer, so it is right however the phone is held: tilt it left and
 * gravity points left), and how hard it is being shaken. Flat on a table, there
 * is no "across", and the sand rests. Read against the screen as it is shown, so
 * on its side (Focus turned sideways) down is the screen's down, not the phone's.
 * Still with Reduce Motion.
 */
export function useSandMotion(): { tilt: SharedValue<number>; shake: SharedValue<number> } {
    const tilt = useSharedValue(0);
    const shake = useSharedValue(0);
    const reduced = useReducedMotion();
    const { width, height } = useWindowDimensions();
    const sideways = useRef(width > height);
    sideways.current = width > height;
    useEffect(() => {
        if (reduced) return;
        let sub: { remove: () => void } | null = null;
        // Which way this phone reports gravity (as a pull, or as what holds it up), learned once.
        let sign = 0;
        let side = 1;
        try {
            const { DeviceMotion } = require('expo-sensors') as typeof import('expo-sensors');
            DeviceMotion.setUpdateInterval(33);
            sub = DeviceMotion.addListener(event => {
                const g = event.accelerationIncludingGravity;
                if (g) {
                    if (!sign && Math.abs(g.y) > 5) sign = g.y < 0 ? 1 : -1;
                    const flip = sign || 1;
                    // On the phone held upright: x to the right, y down.
                    const px = flip * g.x, py = -flip * g.y;
                    // Turned on its side (Focus's sideways clock), the screen's down is one of the
                    // phone's long edges: whichever gravity pulls towards, kept until it clearly changes.
                    if (Math.abs(px) > 3) side = px > 0 ? 1 : -1;
                    const gx = sideways.current ? -side * py : px;
                    const gy = sideways.current ? side * px : py;
                    const across = Math.hypot(gx, gy);
                    // Lying flat, the reading across the screen is small and means nothing: rest.
                    const weight = Math.max(0, Math.min(1, (across - 2) / 4));
                    // Half the phone's lean: the sand answers a tilt without chasing every movement.
                    const target = Math.max(-0.7, Math.min(0.7, Math.atan2(gx, gy) * SENSITIVITY)) * weight;
                    // Eased, so a shaky hand does not jitter the sand.
                    tilt.value = tilt.value + (target - tilt.value) * 0.25;
                }
                const a = event.acceleration;
                const jolt = a ? Math.hypot(a.x, a.y, a.z) : 0;
                shake.value = Math.min(1, shake.value * 0.93 + Math.max(0, jolt - 2.5) * 0.12 * SENSITIVITY);
            });
        } catch { /* no motion sensor: still sand */ }
        return () => sub?.remove();
    }, [reduced, tilt, shake]);
    return { tilt, shake };
}

/** The live hourglass with the phone's motion fed in: what Home and Focus show. */
export function TiltingHourglass(props: Omit<React.ComponentProps<typeof SkiaHourglass>, 'tilt' | 'shake'>) {
    const { tilt, shake } = useSandMotion();
    return <SkiaHourglass {...props} tilt={tilt} shake={shake} />;
}
