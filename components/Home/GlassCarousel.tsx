import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    Extrapolation, interpolate, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { RankHourglass } from './RankHourglass';
import { RankScene } from './RankScene';
import { AppButton, IconButton, Text } from '@/components/ui';
import { useAccent } from '@/context/AccentContext';
import { chooseRankLook } from '@/lib/rankLook';
import { setThemeChoice } from '@/lib/themeChoice';
import { on, type AppEvents } from '@/lib/appEvents';
import { RANKS } from '@/lib/marks';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { OVERLAY } from '@/theme/motion';
import { s } from '@/theme/scale';

type Open = AppEvents['glass_open'];

/** Each hourglass's slot, as a share of the screen's width: the next ones peek in at the sides. */
const SLOT = 0.54;

/**
 * Every hourglass you can earn, one per rank, opened by tapping the day's
 * hourglass on Home (DayHourglass). It opens on yours; swipe right to climb:
 * the one in the middle large and lit, its neighbours smaller and fainter at
 * the sides. Each says whose it is: yours, reached, or locked with the Marks
 * still to go. Drawn over everything from the app's root.
 *
 * Picking one you have reached dresses the app in its palette (and turns on the
 * Hourglass theme, Settings → Appearance): Home's hourglass and scene take it too.
 */
export function GlassCarousel({ stage, onOpenChange }: {
    /**
     * Opened in place on Home, over its own scene: where the podium's hourglass
     * stands (its bottom edge, in points from the top), how big the one in the
     * middle is, and where the words under it start. The page's background stays.
     */
    stage?: { glassBottom: number; size: number; captionTop: number };
    onOpenChange?: (open: boolean) => void;
} = {}) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { selectionFeedback, lightFeedback, mediumFeedback } = useHaptics();
    // The hourglass dressing the app now: the one you picked, else your rank's.
    const { rankShown } = useAccent();
    const [open, setOpen] = useState<Open | null>(null);
    const [index, setIndex] = useState(0);
    const shown = useSharedValue(0);
    const scrollX = useSharedValue(0);

    const slot = width * SLOT;
    const side = (width - slot) / 2;

    useEffect(() => {
        const sub = on('glass_open', event => {
            const start = Math.max(0, RANKS.findIndex(rank => rank.name === event.rank));
            setIndex(start);
            scrollX.set(start * slot);
            setOpen(event);
            onOpenChange?.(true);
            shown.set(withTiming(1, OVERLAY.in));
        });
        return () => sub.remove();
    }, [shown, scrollX, slot, onOpenChange]);

    const close = () => {
        lightFeedback();
        onOpenChange?.(false);
        const gone = () => setOpen(null);
        shown.set(withTiming(0, OVERLAY.out, finished => { if (finished) runOnJS(gone)(); }));
    };

    const onScroll = useAnimatedScrollHandler(event => { scrollX.set(event.contentOffset.x); });
    // On Home the scene itself zooms in to it, so the carousel only fades; on its own it settles in.
    const onStage = !!stage;
    const layerStyle = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ scale: onStage ? 1 : 0.94 + shown.get() * 0.06 }] }));
    const glassSize = stage?.size ?? s(270);

    if (!open) return null;
    const yours = Math.max(0, RANKS.findIndex(rank => rank.name === open.rank));
    const current = RANKS[index];
    const reached = open.marks >= current.min;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, stage ? null : { backgroundColor: t.color.background }, layerStyle]}>
            {/* On its own, the scene of the hourglass in the middle; on Home, Home's scene stays behind. */}
            {stage ? null : <RankScene rank={RANKS[index].name} fill />}
            <View style={[styles.top, { paddingTop: insets.top + t.space.sm, paddingHorizontal: t.space.lg }]}>
                <View style={styles.flex}>
                    <Text variant="title" accessibilityRole="header">Hourglasses</Text>
                    <Text variant="caption" tone="muted">One for every rank. Swipe to climb.</Text>
                </View>
                <IconButton icon="close" label="Close" onPress={close} />
            </View>

            <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}
                snapToInterval={slot} decelerationRate="fast" contentOffset={{ x: yours * slot, y: 0 }}
                contentContainerStyle={stage ? { paddingHorizontal: side, alignItems: 'flex-end' } : { paddingHorizontal: side, alignItems: 'center' }}
                style={stage ? { position: 'absolute', left: 0, right: 0, top: stage.glassBottom - glassSize - t.space['3xl'], height: glassSize + t.space['3xl'] } : styles.flex}
                onMomentumScrollEnd={event => {
                    const next = Math.round(event.nativeEvent.contentOffset.x / slot);
                    if (next !== index) { selectionFeedback(); setIndex(Math.max(0, Math.min(RANKS.length - 1, next))); }
                }}>
                {RANKS.map((rank, position) => (
                    <Slot key={rank.name} position={position} slot={slot} scrollX={scrollX}>
                        {/* Reached: dimmed into the scene, as on Home. Not yet: only its shadow. */}
                        <RankHourglass rank={rank.name} size={glassSize} look={open.marks >= rank.min ? 'scene' : 'shadow'} />
                    </Slot>
                ))}
            </Animated.ScrollView>

            {/* The one in the middle: whose it is. */}
            <View style={[styles.caption, stage ? { position: 'absolute', left: 0, right: 0, top: stage.captionTop, gap: t.space.xs } : { paddingBottom: insets.bottom + t.space.xl, gap: t.space.xs }]} accessibilityLiveRegion="polite">
                <View style={styles.nameRow}>
                    <Text variant="screenTitle">{current.name}</Text>
                </View>
                <Text variant="body" tone="muted" align="center">
                    {index === yours ? 'Yours now' : reached ? 'Reached' : `${(current.min - open.marks).toLocaleString()} Marks to go`}
                </Text>
                {reached ? (
                    <AppButton style={{ marginTop: t.space.md }}
                        label={rankShown === current.name ? 'In use' : 'Use this hourglass'}
                        variant={rankShown === current.name ? 'default' : 'primary'}
                        icon={rankShown === current.name ? 'checkmark' : undefined}
                        disabled={rankShown === current.name}
                        onPress={() => { mediumFeedback(); chooseRankLook(index === yours ? null : current.name); setThemeChoice('hourglass'); }} />
                ) : null}
                <View style={[styles.dots, { gap: t.space.xs, marginTop: t.space.md }]}>
                    {RANKS.map((rank, position) => (
                        <View key={rank.name} style={[styles.dot, { backgroundColor: position === index ? t.color.textPrimary : t.color.border }]} />
                    ))}
                </View>
            </View>
        </Animated.View>
    );
}

/** One slot of the carousel: full size in the middle, smaller and fainter the further it is. */
function Slot({ position, slot, scrollX, children }: { position: number; slot: number; scrollX: SharedValue<number>; children: React.ReactNode }) {
    const centre = position * slot;
    const style = useAnimatedStyle(() => {
        const away = Math.abs(scrollX.get() - centre) / slot;
        return {
            opacity: interpolate(away, [0, 1], [1, 0.4], Extrapolation.CLAMP),
            transform: [{ scale: interpolate(away, [0, 1], [1, 0.7], Extrapolation.CLAMP) }],
        };
    });
    return <Animated.View style={[styles.slot, { width: slot }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center' },
    slot: { alignItems: 'center', justifyContent: 'center' },
    caption: { alignItems: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dots: { flexDirection: 'row' },
    dot: { width: 6, height: 6, borderRadius: 3 },
});
