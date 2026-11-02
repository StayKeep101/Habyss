import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccentGradient } from '@/context/AccentContext';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { MatteSurface } from './MatteSurface';
import { Text } from './Text';

const SETTLE = timingFor(DURATION.quick, EASE.move);
const THUMB = Control.hitTarget - Spacing.sm;

/** Which step a position along the track is nearest to. A worklet: plain arithmetic only. */
function nearest(x: number, width: number, count: number): number {
    'worklet';
    if (width <= 0 || count < 2) return 0;
    const ratio = Math.min(1, Math.max(0, x / width));
    return Math.round(ratio * (count - 1));
}

/**
 * A value chosen by sliding: a track that fills with the accent's gradient up
 * to a thumb you drag (or tap anywhere on the track), snapping to each step
 * with a tick you feel. The chosen value is said above it, large. VoiceOver
 * adjusts it a step at a time. For any choice among a few ordered values
 * (a length, an amount), where a row of chips would be a form.
 */
export function StepSlider<T extends number>({ label, values, value, onChange, say }: {
    /** What is being chosen, said small over the value. */
    label: string;
    values: readonly T[];
    value: T;
    onChange: (value: T) => void;
    /** The value as said: "7 days", "No stake". */
    say: (value: T) => string;
}) {
    const t = useTokens();
    const { buttonColors } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);
    const index = Math.max(0, values.indexOf(value));
    const count = values.length;
    const position = useSharedValue(0);
    const step = useSharedValue(index);

    const place = (at: number, w: number) => position.set(withTiming(count > 1 ? (at / (count - 1)) * w : 0, SETTLE));
    const onLayout = (event: LayoutChangeEvent) => {
        const w = event.nativeEvent.layout.width - THUMB;
        setWidth(w);
        position.set(count > 1 ? (index / (count - 1)) * w : 0);
    };
    const choose = (at: number) => {
        if (at === values.indexOf(value)) return;
        selectionFeedback();
        onChange(values[at]);
    };
    // Keeps the thumb where the value is when it changes from outside (VoiceOver, a reset).
    React.useEffect(() => { step.set(index); place(index, width); }, [index, width]); // eslint-disable-line react-hooks/exhaustive-deps

    const pan = Gesture.Pan().minDistance(0)
        .onBegin(event => {
            const at = nearest(event.x - THUMB / 2, width, count);
            if (at !== step.get()) { step.set(at); runOnJS(choose)(at); }
            position.set(Math.min(width, Math.max(0, event.x - THUMB / 2)));
        })
        .onUpdate(event => {
            position.set(Math.min(width, Math.max(0, event.x - THUMB / 2)));
            const at = nearest(event.x - THUMB / 2, width, count);
            if (at !== step.get()) { step.set(at); runOnJS(choose)(at); }
        })
        .onFinalize(() => {
            position.set(withTiming(count > 1 ? (step.get() / (count - 1)) * width : 0, SETTLE));
        });

    const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() }] }));
    // The track starts just inside the thumb's centre at rest, so the fill reaches exactly to the thumb.
    const fill = useAnimatedStyle(() => ({ width: position.get() + Spacing.xs }));

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
                <Text variant="caption" tone="muted">{label}</Text>
                <Text variant="title">{say(value)}</Text>
            </View>
            <GestureDetector gesture={pan}>
                <View onLayout={onLayout} style={styles.area}
                    accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: say(value) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={event => {
                        const at = index + (event.nativeEvent.actionName === 'increment' ? 1 : -1);
                        if (at >= 0 && at < count) choose(at);
                    }}>
                    <View style={[styles.track, { backgroundColor: t.color.surfaceRaised }]}>
                        <Animated.View style={[styles.fillClip, fill]}>
                            <LinearGradient colors={buttonColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                        </Animated.View>
                    </View>
                    {/* A notch at every step, so the snaps can be seen as well as felt. */}
                    <View style={styles.notches} pointerEvents="none">
                        {values.map((item, at) => <View key={item} style={[styles.notch, { backgroundColor: at <= index ? t.color.onAccent : t.color.textSubtle }]} />)}
                    </View>
                    <Animated.View style={[styles.thumb, thumb]} pointerEvents="none">
                        <MatteSurface radius={Radius.pill} level="control" style={styles.thumbFace} />
                    </Animated.View>
                </View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    area: { height: Control.hitTarget, justifyContent: 'center' },
    track: { marginHorizontal: THUMB / 2 - Spacing.xs, height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    fillClip: { height: '100%', borderRadius: Radius.pill, overflow: 'hidden' },
    notches: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    notch: { width: Spacing.xs, height: Spacing.xs, borderRadius: Radius.pill },
    thumb: { position: 'absolute', left: 0, width: THUMB, height: THUMB },
    thumbFace: { flex: 1 },
});
