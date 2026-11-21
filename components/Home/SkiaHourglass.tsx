import React, { useEffect, useMemo } from 'react';
import { useAnimatedReaction, useDerivedValue, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import {
    BlurMask, Canvas, ClipOp, Group, LinearGradient, Path, Picture, RoundedRect, Skia, createPicture, useClock, vec,
} from '@shopify/react-native-skia';
import { mixHex } from '@/lib/colorContrast';
import { Colors } from '@/theme/colors';
import { HOURGLASS_INK } from '@/theme/hourglassArt';
import { DURATION, EASE } from '@/theme/motion';

// Built once, outside any worklet: the slide of an avalanche, and the heaps settling back.
const AVALANCHE = { duration: DURATION.base, easing: EASE.enter };
const SETTLE_BACK = { duration: DURATION.base + 60, easing: EASE.move };

/**
 * Home's hourglass, drawn live with Skia in the design of the blue hourglass
 * (its outline traced from the art, on the art's own grid, 622 × 836). The
 * frame is still; the sand is alive: its surface sways and sinks as the day
 * runs, grains fall under gravity onto a mound that grows, and both lean with
 * the phone's tilt. A band of light drifts across the glass. Only the sand is
 * the rank's colour. Reduce Motion: the sand sits still at the right level.
 *
 * Loaded only on a build that has Skia (components/Home/DayHourglass.tsx).
 */
const W = 622;
const H = 836;
const CX = 312;
const NECK = 435;
const GLASS_TOP = 87;
const GLASS_BOTTOM = 747;
/** Where the top sand starts the day, and how tall the pile ends it. */
const TOP_FULL = 175;
const PILE_FULL = 170;
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
const HOLD = 0.35;
/** The grain of the sand: fixed specks over both heaps, [x, y, light?] on the art's grid. */
const SPECKS: [number, number, boolean][] = Array.from({ length: 260 }, (_, i) => {
    const a = Math.sin(i * 127.1) * 43758.5453, b = Math.sin(i * 311.7) * 24634.6345;
    return [80 + (a - Math.floor(a)) * (W - 160), GLASS_TOP + (b - Math.floor(b)) * (GLASS_BOTTOM - GLASS_TOP), i % 3 === 0];
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

/** A smooth closed path through the outline, brought in by `inset` from the rim. */
function glassPath(inset: number) {
    const path = Skia.Path.Make();
    const right = OUTLINE.map(([y, , r]) => [r - inset, y] as const);
    const left = [...OUTLINE].reverse().map(([y, l]) => [l + inset, y] as const);
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

export function SkiaHourglass({ size, ran, running, sand, tilt }: {
    /** Height in points; the width follows the art (622 : 836). */
    size: number;
    ran: SharedValue<number>;
    running: boolean;
    /** The rank's sand: [light, deep]. */
    sand: [string, string];
    /** The phone's sideways tilt in radians, gravity's direction across the screen (0 when still). */
    tilt?: SharedValue<number>;
}) {
    const reduced = useReducedMotion();
    const clock = useClock();
    const still = useSharedValue(0);
    const lean = tilt ?? still;
    const scale = size / H;
    const width = W * scale;

    const outer = useMemo(() => glassPath(0), []);
    const inner = useMemo(() => glassPath(9), []);
    const light = useMemo(() => mixHex(sand[0], Colors.common.white, 0.2), [sand]);
    const deep = sand[1];

    // How the heaps lie: held where they are until the glass leans past what sand
    // holds, then a quick slide (an avalanche) to the new angle, and still again.
    const settled = useSharedValue(0);
    useAnimatedReaction(() => (reduced ? 0 : lean.value), angle => {
        const gap = angle - settled.value;
        if (Math.abs(gap) > HOLD) settled.value = withTiming(angle - Math.sign(gap) * HOLD * 0.6, AVALANCHE);
        else if (Math.abs(angle) < 0.04 && Math.abs(settled.value) > 0 && Math.abs(gap) > HOLD * 0.5) settled.value = withTiming(0, SETTLE_BACK);
    });

    // The living sand, recorded fresh each frame on the UI thread.
    const picture = useDerivedValue(() => {
        const t = reduced ? 0 : clock.value;
        const r = Math.min(1, Math.max(0, ran.value));
        // Gravity, for what falls (grains drop straight down); the heaps' own lie, for what rests.
        const angle = reduced ? 0 : Math.max(-0.7, Math.min(0.7, lean.value));
        const slope = Math.tan(angle);
        const rest = Math.tan(settled.value) * 0.45;
        return createPicture(canvas => {
            const paint = Skia.Paint();
            paint.setAntiAlias(true);
            canvas.save();
            canvas.clipPath(inner, ClipOp.Intersect, true);
            const shader = Skia.Shader.MakeLinearGradient(vec(0, GLASS_TOP), vec(0, GLASS_BOTTOM),
                [Skia.Color(light), Skia.Color(deep)], null, 0);
            paint.setShader(shader);

            // The top: sand drains from its middle, so its surface is a funnel over the
            // neck, its sides at the angle of repose, deepening as the bulb empties.
            const level = TOP_FULL + (NECK - TOP_FULL) * r;
            const crater = Math.min(NECK - level, 16 + 44 * r);
            const top = Skia.Path.Make();
            top.moveTo(60, NECK + 4);
            for (let x = 60; x <= W - 60; x += 8) {
                const dip = Math.max(0, crater - REPOSE * Math.abs(x - CX));
                top.lineTo(x, Math.min(NECK + 2, level + dip + rest * (x - CX)));
            }
            top.lineTo(W - 60, NECK + 4);
            top.close();
            canvas.drawPath(top, paint);

            // The pile: a cone where the grains land (straight down from the neck, along
            // gravity), its sides at the angle of repose, spreading to the walls as it grows.
            const height = PILE_FULL * Math.sqrt(r);
            // Grains drop with gravity, but the stream leaves through a narrow neck: the peak shifts, not swings.
            const peakX = CX + slope * 0.4 * (GLASS_BOTTOM - height - NECK);
            const peakY = GLASS_BOTTOM - height * 1.15;
            const pile = Skia.Path.Make();
            pile.moveTo(60, GLASS_BOTTOM + 4);
            for (let x = 60; x <= W - 60; x += 8) {
                const dx = x - peakX;
                pile.lineTo(x, Math.min(GLASS_BOTTOM + 4, peakY + REPOSE * Math.abs(dx) + rest * dx));
            }
            pile.lineTo(W - 60, GLASS_BOTTOM + 4);
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

            if (running && !reduced && r > 0.001 && r < 0.999) {
                // The stream: a thin trickle through the neck, made of grains, each falling
                // faster as it goes (gravity), a hair apart, onto the cone's peak.
                paint.setColor(Skia.Color(light));
                const land = peakY + 2;
                paint.setAlphaf(0.35);
                const stream = Skia.Path.Make();
                stream.moveTo(CX - 1.6, NECK - 10);
                stream.lineTo(CX + 1.6, NECK - 10);
                stream.lineTo(CX + slope * 0.4 * (land - NECK) + 1.6, land);
                stream.lineTo(CX + slope * 0.4 * (land - NECK) - 1.6, land);
                stream.close();
                canvas.drawPath(stream, paint);
                for (let i = 0; i < GRAINS; i++) {
                    const phase = ((t / FALL_MS) + i / GRAINS) % 1;
                    const y = NECK - 6 + phase * phase * (land - NECK + 6);
                    const x = CX + slope * 0.4 * (y - NECK) + Math.sin(i * 12.9898) * 1.8 * phase;
                    paint.setAlphaf(phase > 0.92 ? (1 - phase) * 12 : 0.95);
                    canvas.drawCircle(x, y, 2.1, paint);
                }
                // Now and then a grain rolls down the cone's side and stops.
                for (let i = 0; i < 4; i++) {
                    const phase = ((t / 1600) + i / 4) % 1;
                    const side = i % 2 === 0 ? -1 : 1;
                    const dx = side * phase * Math.min(150, height * 1.2 + 20);
                    const y = peakY + REPOSE * Math.abs(dx) + rest * dx - 2.5;
                    if (y < GLASS_BOTTOM) {
                        paint.setAlphaf(phase < 0.8 ? 0.9 : (1 - phase) * 4.5);
                        canvas.drawCircle(peakX + dx, y, 2.2, paint);
                    }
                }
                paint.setAlphaf(1);
            }

            // A band of light drifting across the glass, a little further with the tilt.
            if (!reduced) {
                const drift = ((t / 7000) % 1) * (W + 300) - 150 + slope * 80;
                const sheen = Skia.Shader.MakeLinearGradient(vec(drift - 90, 0), vec(drift + 90, H),
                    [Skia.Color('rgba(255,255,255,0)'), Skia.Color('rgba(255,255,255,0.10)'), Skia.Color('rgba(255,255,255,0)')], null, 0);
                const band = Skia.Paint();
                band.setShader(sheen);
                canvas.drawRect(Skia.XYWHRect(0, GLASS_TOP, W, GLASS_BOTTOM - GLASS_TOP), band);
            }
            canvas.restore();
        }, Skia.XYWHRect(0, 0, W, H));
    });

    return (
        <Canvas style={{ width, height: size }}>
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
        </Canvas>
    );
}

/** The phone's sideways tilt, as an angle in radians (gravity's direction across the screen), while mounted; 0 with Reduce Motion. */
export function useTilt(): SharedValue<number> {
    const tilt = useSharedValue(0);
    const reduced = useReducedMotion();
    useEffect(() => {
        if (reduced) return;
        let sub: { remove: () => void } | null = null;
        try {
            const { DeviceMotion } = require('expo-sensors') as typeof import('expo-sensors');
            DeviceMotion.setUpdateInterval(33);
            sub = DeviceMotion.addListener(event => {
                const gamma = event.rotation?.gamma ?? 0;
                // Eased towards the reading, so a shaky hand does not jitter the sand.
                // Tilting left reads as a positive gamma here, and the sand must fall left: the angle is −gamma.
                tilt.value = tilt.value + (Math.max(-0.7, Math.min(0.7, -gamma)) - tilt.value) * 0.2;
            });
        } catch { /* no motion sensor: still sand */ }
        return () => sub?.remove();
    }, [reduced, tilt]);
    return tilt;
}

/** The live hourglass with the phone's tilt fed in: what Home shows. */
export function TiltingHourglass(props: Omit<React.ComponentProps<typeof SkiaHourglass>, 'tilt'>) {
    const tilt = useTilt();
    return <SkiaHourglass {...props} tilt={tilt} />;
}
