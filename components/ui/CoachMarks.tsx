import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppButton } from '@/components/ui/AppButton';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { measureTarget, type CoachStep, type Rect } from '@/lib/coachMarks';

const PAD = 8;
const CALM = { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * The first-run walkthrough, like a game's: the screen dims except for one
 * real control, ringed, with a short line beside it and an arrow to it. Tap
 * the control or Next to go on; Skip ends it. Calm, timed fades, no bounce.
 */
export function CoachMarks({ steps, visible, onDone }: { steps: CoachStep[]; visible: boolean; onDone: () => void }) {
    const t = useTokens();
    const { width, height } = useWindowDimensions();
    const { selectionFeedback, lightFeedback } = useHaptics();
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const step = steps[index];

    const measure = useCallback(async (at: number) => {
        // A step whose control is not on screen is passed over.
        for (let next = at; next < steps.length; next++) {
            const found = await measureTarget(steps[next].target);
            if (found) { setIndex(next); setRect(found); return; }
        }
        onDone();
    }, [steps, onDone]);

    useEffect(() => { if (visible) { setRect(null); void measure(0); } }, [visible, measure]);

    const next = () => {
        selectionFeedback();
        if (index >= steps.length - 1) { onDone(); return; }
        setRect(null);
        void measure(index + 1);
    };
    if (!visible || !step) return null;

    const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 } : null;
    // The words go above the control when it is low on the screen, else below.
    const above = !!hole && hole.y > height * 0.55;
    const dim = 'rgba(0,0,0,0.72)';

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDone}>
            <Animated.View entering={FadeIn.duration(CALM.duration).easing(CALM.easing)} style={StyleSheet.absoluteFill}>
                {hole ? (
                    <>
                        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, hole.y), backgroundColor: dim }]} />
                        <View style={[styles.dim, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0, backgroundColor: dim }]} />
                        <View style={[styles.dim, { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h, backgroundColor: dim }]} />
                        <View style={[styles.dim, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h, backgroundColor: dim }]} />
                        {/* The control itself: a ring, and tapping it goes on. */}
                        <Pressable accessibilityRole="button" accessibilityLabel={`${step.title}. Next`} onPress={next}
                            style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h, borderRadius: Math.min(hole.w, hole.h) / 2, borderColor: t.color.accent }]} />
                    </>
                ) : <View style={[StyleSheet.absoluteFill, { backgroundColor: dim }]} />}

                {hole ? (
                    <Animated.View key={index} entering={FadeIn.delay(80).duration(CALM.duration).easing(CALM.easing)} exiting={FadeOut.duration(140)}
                        style={[styles.callout, above ? { bottom: height - hole.y + Spacing.md } : { top: hole.y + hole.h + Spacing.md }]}>
                        <View style={[styles.arrow, above ? styles.arrowDown : styles.arrowUp, {
                            left: Math.min(width - Spacing.xl * 2 - 24, Math.max(12, hole.x + hole.w / 2 - Spacing.xl - 8)),
                            borderTopColor: above ? t.color.surfaceRaised : 'transparent',
                            borderBottomColor: above ? 'transparent' : t.color.surfaceRaised,
                        }]} />
                        <MatteSurface radius={20} style={styles.card}>
                            <Text style={[styles.count, { color: t.color.textMuted }]}>{`${index + 1} of ${steps.length}`}</Text>
                            <Text style={[styles.title, { color: t.color.textPrimary }]} accessibilityRole="header">{step.title}</Text>
                            <Text style={[styles.body, { color: t.color.textMuted }]}>{step.body}</Text>
                            <View style={styles.buttons}>
                                <AppButton label="Skip" variant="ghost" fullWidth={false} onPress={() => { lightFeedback(); onDone(); }} />
                                <AppButton label={index >= steps.length - 1 ? 'Got it' : 'Next'} fullWidth={false} onPress={next} />
                            </View>
                        </MatteSurface>
                    </Animated.View>
                ) : null}
            </Animated.View>
        </Modal>
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
