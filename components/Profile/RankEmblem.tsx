import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { AnimatedFill, Text } from '@/components/ui';
import { RankHourglass } from '@/components/Home/RankHourglass';
import { useTokens } from '@/hooks/useTokens';
import { rankFor } from '@/lib/marks';
import { skiaReady } from '@/lib/skiaReady';
import { glassDesign } from '@/theme/hourglassDesigns';
import { HOURGLASS_FRAMES, type GlassFrame } from '@/theme/hourglassFrames';
import { CEREMONY, EASE, timingFor } from '@/theme/motion';
import { Radius, Spacing } from '@/theme/designSystem';

/** The live Skia hourglass, on a build that has Skia; null shows the still one. */
const LiveGlass: React.ComponentType<{ size: number; ran: SharedValue<number>; running: boolean; sand: [string, string]; frame?: GlassFrame }> | null =
    skiaReady ? (require('@/components/Home/SkiaHourglass') as typeof import('@/components/Home/SkiaHourglass')).TiltingHourglass : null;

// Built once, outside any worklet.
const FILL = timingFor(CEREMONY.reveal, EASE.move);

/**
 * Your hourglass, to admire: the one you use (or a friend's rank), large, its
 * sand live under the phone's tilt; the sand already through is how far you
 * are toward the next rank. Its name under it, and what is left to climb.
 * `live` false (a friend's profile): the still picture.
 */
export function RankEmblem({ marks, rank, live = true }: { marks: number; rank?: string | null; live?: boolean }) {
    const t = useTokens();
    const { width } = useWindowDimensions();
    const { rank: reached, next, progress, toNext } = rankFor(marks);
    const shown = rank ?? reached.name;
    const frame = HOURGLASS_FRAMES[shown];
    const size = Math.min(width * 0.75, Spacing.section * 7);
    const ran = useSharedValue(0);
    useEffect(() => { ran.set(withTiming(progress, FILL)); }, [progress, ran]);

    return (
        <View style={styles.wrap} accessible
            accessibilityLabel={`${shown} hourglass. ${marks.toLocaleString()} Marks${next ? `, ${toNext.toLocaleString()} to ${next.name}` : ', the highest rank'}`}>
            {live && LiveGlass && frame
                ? <LiveGlass frame={frame} size={size} ran={ran} running={false} sand={glassDesign(shown).sand} />
                : <RankHourglass rank={shown} size={size} look="scene" />}
            <View style={styles.caption}>
                <Text variant="screenTitle" align="center">{shown}</Text>
                <Text variant="bodySmall" tone="muted" align="center" numeric>
                    {next ? `${marks.toLocaleString()} Marks · ${toNext.toLocaleString()} to ${next.name}` : `${marks.toLocaleString()} Marks · the highest rank`}
                </Text>
                {next ? (
                    <View style={[styles.track, { backgroundColor: t.color.surfaceRaised }]}>
                        <AnimatedFill progress={progress} style={[styles.fill, { backgroundColor: t.color.accent }]} />
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
    caption: { alignSelf: 'stretch', alignItems: 'center', gap: Spacing.xs },
    track: { alignSelf: 'stretch', height: Spacing.xs + Spacing.xs / 2, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.sm, marginHorizontal: Spacing.xl * 2 },
    fill: { height: '100%', borderRadius: Radius.pill },
});
