import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccent } from '@/context/AccentContext';
import { useTokens } from '@/hooks/useTokens';
import { skiaReady } from '@/lib/skiaReady';
import { glassDesign } from '@/theme/hourglassDesigns';
import { TEMPLE } from '@/theme/hourglassArt';
import { HOURGLASS_FRAMES } from '@/theme/hourglassFrames';
import { GLASS_HEIGHT } from '@/components/Home/DayHourglass';

/**
 * Focus with the hourglass as the clock (Settings → Focus → Timer: Hourglass).
 *
 * The page stands on Home's temple, closer in: the hourglass on its podium is
 * the timer, its sand falling for the session (lib/focusClock.ts). The glass
 * says where it stands on screen, and the scene is drawn so the podium's top
 * step is right under it, at the same scale as the glass is to Home's.
 */
type Stage = { y: number; size: number };
const StageContext = createContext<((stage: Stage) => void) | null>(null);
export const FocusStageProvider = StageContext.Provider;

const LiveGlass = skiaReady ? (require('@/components/Home/SkiaHourglass') as typeof import('@/components/Home/SkiaHourglass')).TiltingHourglass : null;

/** One second of sand at a time, never a jump. */
const TICK = { duration: 1000, easing: Easing.linear };

/** The hourglass as the timer: `progress` 0 → 1 as the session runs (null: a stopwatch, an hour a glass). */
export function FocusHourglass({ size, progress, seconds, running }: { size: number; progress: number | null; seconds: number; running: boolean }) {
    const { rankShown } = useAccent();
    const design = glassDesign(rankShown);
    const report = useContext(StageContext);
    const ref = useRef<View>(null);
    const ran = useSharedValue(0);
    const share = progress ?? ((seconds % 3600) / 3600);
    useEffect(() => { ran.set(withTiming(Math.max(0, Math.min(1, share)), TICK)); }, [share, ran]);
    // The podium's top step goes where the glass's base ends, so it stands on it (covering the step's light).
    const frame = HOURGLASS_FRAMES[rankShown ?? 'Lost'];
    const foot = frame ? frame.foot / frame.height : 1;
    const measure = () => ref.current?.measureInWindow((_x, y, _w, h) => { if (h) report?.({ y: y + h / 2 + size / 2 * (2 * foot - 1), size }); });
    return (
        <View ref={ref} onLayout={measure} collapsable={false} style={{ height: size, alignItems: 'center', justifyContent: 'center' }}
            accessible accessibilityRole="progressbar"
            accessibilityValue={progress === null ? undefined : { min: 0, max: 100, now: Math.round(share * 100) }}>
            {LiveGlass ? <LiveGlass frame={HOURGLASS_FRAMES[rankShown ?? 'Lost']} size={size} ran={ran} running={running} sand={design.sand} /> : null}
        </View>
    );
}

/**
 * Home's temple behind the focus page, zoomed so its podium meets the glass:
 * the scene scaled by how much bigger the glass is than Home's, its top step at
 * the glass's middle (where Home stands it). Its edges melt into the page.
 */
export function TempleStage({ stage }: { stage: Stage | null }) {
    const t = useTokens();
    const { width, height } = useWindowDimensions();
    if (!stage) return null;
    const scale = (width / TEMPLE.width) * (stage.size / GLASS_HEIGHT);
    const w = TEMPLE.width * scale;
    const h = TEMPLE.height * scale;
    const top = stage.y - TEMPLE.step * scale;
    const left = (width - w) / 2;
    const clear = `${t.color.background}00`;
    return (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden', backgroundColor: t.color.background }}>
            <Image source={TEMPLE.image} style={{ position: 'absolute', left, top, width: w, height: h }} accessibilityIgnoresInvertColors />
            {/* The scene's top and foot melt into the page, wherever they fall. */}
            <LinearGradient colors={[t.color.background, clear]} style={{ position: 'absolute', left: 0, right: 0, top: Math.max(0, top) - 1, height: h * 0.12 }} />
            <LinearGradient colors={[clear, t.color.background]} style={{ position: 'absolute', left: 0, right: 0, top: top + h * 0.78, height: h * 0.22 + 2 }} />
        </View>
    );
}
