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
    // One spotlight for the whole tour: it glides from each control to the next.
    return <Spotlight index={index} />;
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

    // The hole, ring and card, moved on the UI thread: they glide to each new
    // control, and follow one that moves (a sheet rising) rather than jumping.
    const hx = useSharedValue(0), hy = useSharedValue(0), hw = useSharedValue(0), hh = useSharedValue(0), cardTop = useSharedValue(0);
    const shown = useRef(false);

    // The control is followed while the step is up: sheets grow, the keyboard
    // comes and goes. Looked for at once, then often while it is still moving,
    // then calmly once it has settled. Gone for too long, the tour goes back or on.
    useEffect(() => {
        Keyboard.dismiss();
        let alive = true;
        let timer: ReturnType<typeof setTimeout>;
        let missingSince: number | null = null;
        let still = 0;
        let previous: Rect | null = null;
        const look = async () => {
            const found = await measureTarget(step.target);
            if (!alive) return;
            if (found && found.y < height && found.y + found.height > 0) {
                missingSince = null;
                const same = !!previous && previous.x === found.x && previous.y === found.y && previous.width === found.width && previous.height === found.height;
                still = same ? still + 1 : 0;
                previous = found;
                if (!same) setRect(found);
            } else {
                missingSince ??= Date.now();
                // Not there yet (a sheet or tab on its way): the old place is let go
                // after a moment, and the new one fades in where it appears.
                if (Date.now() - missingSince > 250) { previous = null; shown.current = false; setRect(null); }
                if (Date.now() - missingSince > PATIENCE) { goToStep(stepAfterMissing(FIRST_RUN, index)); return; }
            }
            timer = setTimeout(look, found ? (still >= 3 ? 400 : 80) : 120);
        };
        timer = setTimeout(look, 16);
        const show = Keyboard.addListener('keyboardDidShow', event => setKeyboard(event.endCoordinates.height));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
        return () => { alive = false; clearTimeout(timer); show.remove(); hide.remove(); };
    }, [index, step.target, height]);

    // The control to tap, breathing gently.
    const breath = useSharedValue(1);
    useEffect(() => {
        breath.value = step.waitFor ? withRepeat(withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), -1, true) : 1;
    }, [step.waitFor, breath]);

    const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 } : null;
    // The words go where there is room: below the control, else above it,
    // else at whichever edge leaves the control in view.
    const floor = height - keyboard - insets.bottom - Spacing.sm;
    const ceiling = insets.top + Spacing.sm;
    const roomBelow = hole ? floor - (hole.y + hole.h) - GAP : 0;
    const roomAbove = hole ? hole.y - GAP - ceiling : 0;
    const side: 'below' | 'above' | null = !hole ? null : roomBelow >= cardHeight ? 'below' : roomAbove >= cardHeight ? 'above' : null;
    const top = !hole ? 0 : side === 'below' ? hole.y + hole.h + GAP : side === 'above' ? hole.y - GAP - cardHeight
        : roomBelow > roomAbove ? floor - cardHeight : ceiling;

    useEffect(() => {
        if (!hole) return;
        // The first place is taken at once (the layer fades in there); every later one is glided to.
        const to = (value: typeof hx, target: number) => value.set(shown.current ? withTiming(target, CALM) : target);
        to(hx, hole.x); to(hy, hole.y); to(hw, hole.w); to(hh, hole.h); to(cardTop, top);
        shown.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hole?.x, hole?.y, hole?.w, hole?.h, top]);

    const dimTop = useAnimatedStyle(() => ({ height: Math.max(0, hy.get()) }));
    const dimBottom = useAnimatedStyle(() => ({ top: hy.get() + hh.get() }));
    const dimLeft = useAnimatedStyle(() => ({ top: hy.get(), width: Math.max(0, hx.get()), height: hh.get() }));
    const dimRight = useAnimatedStyle(() => ({ top: hy.get(), left: hx.get() + hw.get(), height: hh.get() }));
    const ringPlace = useAnimatedStyle(() => ({
        top: hy.get(), left: hx.get(), width: hw.get(), height: hh.get(), borderRadius: Math.min(hw.get(), hh.get(), 48) / 2,
    }));
    const ringBreath = useAnimatedStyle(() => ({ opacity: breath.value }));
    const cardPlace = useAnimatedStyle(() => ({ top: cardTop.get() }));

    if (!hole) return null;
    const next = () => { selectionFeedback(); goToStep(index + 1); };
    const skip = () => { lightFeedback(); endTour(); };
    const dim = 'rgba(0,0,0,0.72)';
    const live = !!step.waitFor || !!step.live;

    return (
        <Animated.View entering={FadeIn.duration(CALM.duration).easing(CALM.easing)} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.dim, { top: 0, left: 0, right: 0, backgroundColor: dim }, dimTop]} />
            <Animated.View style={[styles.dim, { left: 0, right: 0, bottom: 0, backgroundColor: dim }, dimBottom]} />
            <Animated.View style={[styles.dim, { left: 0, backgroundColor: dim }, dimLeft]} />
            <Animated.View style={[styles.dim, { right: 0, backgroundColor: dim }, dimRight]} />
            {/* A live control is used through the hole; any other is a button that goes on. */}
            <Animated.View pointerEvents={live ? 'none' : 'box-none'} style={[styles.ring, { borderColor: t.color.accent }, ringPlace, step.waitFor ? ringBreath : null]}>
                {live ? null : <Pressable accessibilityRole="button" accessibilityLabel={`${step.title}. Next`} onPress={next} style={StyleSheet.absoluteFill} />}
            </Animated.View>

            <Animated.View onLayout={event => setCardHeight(event.nativeEvent.layout.height)} style={[styles.callout, cardPlace]}>
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
            </Animated.View>
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
