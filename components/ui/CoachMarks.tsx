import React, { useEffect, useReducer, useRef, useState } from 'react';
import { DeviceEventEmitter, Keyboard, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppButton } from '@/components/ui/AppButton';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit } from '@/lib/appEvents';
import {
    FIRST_RUN, claimLayer, endTour, getTour, goToStep, measureTarget, stepAfterMissing, subscribeTour, topLayer, type Rect,
} from '@/lib/coachMarks';

const PAD = 8;
const GAP = Spacing.md;
const CALM = { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
/** How long a step's control may be missing (a sheet opening, a tab changing) before the tour moves. */
const PATIENCE = 2400;

/**
 * The first-run tour, like a game's: the screen dims except for one real
 * control, ringed, with a short line beside it and an arrow to it. It runs in
 * order across screens (lib/coachMarks.ts FIRST_RUN): Home's cards, making a
 * first goal yourself, Roadmap, friends. Where you do the thing yourself
 * (tap +, choose Goal, create it), the control stays live and the tour waits.
 *
 * A plain layer, not a native modal, so the real controls under the hole can
 * be used. Mounted once over the whole app (`root`), and once inside each
 * composer sheet's modal, so it can light up what is in the sheet; the newest
 * layer mounted draws it.
 */
export function CoachLayer({ root = false }: { root?: boolean }) {
    const [, redraw] = useReducer((count: number) => count + 1, 0);
    const [layer, setLayer] = useState<number | null>(null);
    useEffect(() => {
        const claimed = claimLayer();
        setLayer(claimed.id);
        const unsubscribe = subscribeTour(redraw);
        return () => { unsubscribe(); claimed.release(); };
    }, []);
    const { active, index } = getTour();

    // The app's own layer listens for what the person does, once.
    useEffect(() => {
        if (!root || !active) return;
        const step = FIRST_RUN[index];
        if (step.announce) DeviceEventEmitter.emit(step.announce);
        const wait = step.waitFor;
        if (!wait) return;
        const subscription = DeviceEventEmitter.addListener(wait.event, (value?: unknown) => {
            if (wait.value === undefined || value === wait.value) goToStep(index + 1);
        });
        return () => subscription.remove();
    }, [root, active, index]);
    const was = useRef(false);
    useEffect(() => {
        if (!root) return;
        if (was.current && !active) emit('tour_end');
        was.current = active;
    }, [root, active]);

    if (!active || layer === null || layer !== topLayer()) return null;
    return <Spotlight key={index} index={index} />;
}

function Spotlight({ index }: { index: number }) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const { selectionFeedback, lightFeedback } = useHaptics();
    const step = FIRST_RUN[index];
    const last = index >= FIRST_RUN.length - 1;
    const [rect, setRect] = useState<Rect | null>(null);
    const [keyboard, setKeyboard] = useState(0);
    const [cardHeight, setCardHeight] = useState(190);

    // The control is followed while the step is up: sheets grow, the keyboard
    // comes and goes. Gone for too long, the tour goes back or on.
    useEffect(() => {
        Keyboard.dismiss();
        let alive = true;
        let timer: ReturnType<typeof setTimeout>;
        let missingSince: number | null = null;
        const look = async () => {
            const found = await measureTarget(step.target);
            if (!alive) return;
            if (found && found.y < height && found.y + found.height > 0) {
                missingSince = null;
                setRect(prev => prev && prev.x === found.x && prev.y === found.y && prev.width === found.width && prev.height === found.height ? prev : found);
            } else {
                setRect(null);
                missingSince ??= Date.now();
                if (Date.now() - missingSince > PATIENCE) { goToStep(stepAfterMissing(FIRST_RUN, index)); return; }
            }
            timer = setTimeout(look, found ? 400 : 150);
        };
        // After the screen or sheet has settled.
        timer = setTimeout(look, 320);
        const show = Keyboard.addListener('keyboardDidShow', event => setKeyboard(event.endCoordinates.height));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
        return () => { alive = false; clearTimeout(timer); show.remove(); hide.remove(); };
    }, [index, step.target, height]);

    // The control to tap, breathing gently.
    const breath = useSharedValue(1);
    useEffect(() => {
        if (step.waitFor) breath.value = withRepeat(withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), -1, true);
    }, [step.waitFor, breath]);
    const ringStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

    if (!rect) return null;
    const next = () => { selectionFeedback(); goToStep(index + 1); };
    const skip = () => { lightFeedback(); endTour(); };

    const hole = { x: rect.x - PAD, y: rect.y - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 };
    // The words go where there is room: below the control, else above it,
    // else at whichever edge leaves the control in view.
    const floor = height - keyboard - insets.bottom - Spacing.sm;
    const ceiling = insets.top + Spacing.sm;
    const roomBelow = floor - (hole.y + hole.h) - GAP;
    const roomAbove = hole.y - GAP - ceiling;
    const side: 'below' | 'above' | null = roomBelow >= cardHeight ? 'below' : roomAbove >= cardHeight ? 'above' : null;
    const top = side === 'below' ? hole.y + hole.h + GAP : side === 'above' ? hole.y - GAP - cardHeight
        : roomBelow > roomAbove ? floor - cardHeight : ceiling;
    const dim = 'rgba(0,0,0,0.72)';
    const live = !!step.waitFor || !!step.live;
    const ring = [styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h, borderRadius: Math.min(hole.w, hole.h, 48) / 2, borderColor: t.color.accent }];

    return (
        <Animated.View entering={FadeIn.duration(CALM.duration).easing(CALM.easing)} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, hole.y), backgroundColor: dim }]} />
            <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0, backgroundColor: dim }]} />
            <View style={[styles.dim, { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h, backgroundColor: dim }]} />
            <View style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h, backgroundColor: dim }]} />
            {/* A live control is used through the hole; any other is a button that goes on. */}
            {live
                ? <Animated.View pointerEvents="none" style={[ring, step.waitFor ? ringStyle : null]} />
                : <Pressable accessibilityRole="button" accessibilityLabel={`${step.title}. Next`} onPress={next} style={ring} />}

            <View onLayout={event => setCardHeight(event.nativeEvent.layout.height)} style={[styles.callout, { top }]}>
                {side ? (
                    <View style={[styles.arrow, side === 'above' ? styles.arrowDown : styles.arrowUp, {
                        left: Math.min(width - Spacing.xl * 2 - 24, Math.max(12, hole.x + hole.w / 2 - Spacing.xl - 10)),
                        borderTopColor: side === 'above' ? t.color.surfaceRaised : 'transparent',
                        borderBottomColor: side === 'above' ? 'transparent' : t.color.surfaceRaised,
                    }]} />
                ) : null}
                <MatteSurface radius={20} style={styles.card}>
                    <Text style={[styles.count, { color: t.color.textMuted }]}>{`${index + 1} of ${FIRST_RUN.length}`}</Text>
                    <Text style={[styles.title, { color: t.color.textPrimary }]} accessibilityRole="header">{step.title}</Text>
                    <Text style={[styles.body, { color: t.color.textMuted }]}>{step.body}</Text>
                    <View style={styles.buttons}>
                        <AppButton label={last ? 'Close' : 'Skip tour'} variant="ghost" fullWidth={false} onPress={skip} />
                        {step.waitFor ? null : <AppButton label={last ? 'Done' : 'Next'} fullWidth={false} onPress={next} />}
                    </View>
                </MatteSurface>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    dim: { position: 'absolute' },
    ring: { position: 'absolute', borderWidth: 2 },
    callout: { position: 'absolute', left: Spacing.xl, right: Spacing.xl },
    card: { padding: Spacing.lg, gap: Spacing.xs },
    count: { fontSize: 12, fontFamily: FontFamily.semibold },
    title: { fontSize: 20, fontFamily: FontFamily.bold },
    body: { fontSize: 15, fontFamily: FontFamily.regular, lineHeight: 21 },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
    arrow: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
    arrowUp: { top: -10, borderBottomWidth: 10 },
    arrowDown: { bottom: -10, borderTopWidth: 10 },
});
