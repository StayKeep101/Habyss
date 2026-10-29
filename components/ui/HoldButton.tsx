import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MatteSurface } from './MatteSurface';
import { Text } from './Text';
import { AppIcon } from './AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';

/** How long the hold takes. Long enough to mean it, short enough not to wait. */
const HOLD_MS = 1500;
/** Fills at the pace of the hold, whatever Reduce Motion says: it is the control, not decoration. */
const FILL = { duration: HOLD_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never };
const EMPTY = { duration: DURATION.exit, easing: EASE.exit, reduceMotion: ReduceMotion.Never };

/**
 * A button you hold to mean it: the accent fills it from the left while the
 * finger stays down, the haptics build (light, light, firm) and land with a
 * thud as it completes. Let go early and it drains back; nothing happens.
 * For a decision worth a second of commitment (unlocking Habyss for life).
 * VoiceOver users activate it directly; a long hold is not asked of them.
 */
export function HoldButton({ label, hint = 'Touch and hold', icon, onComplete, disabled, loading }: {
    label: string; hint?: string; icon?: string; onComplete: () => void; disabled?: boolean; loading?: boolean;
}) {
    const t = useTokens();
    const { lightFeedback, mediumFeedback, heavyFeedback } = useHaptics();
    const fill = useSharedValue(0);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    useEffect(() => clear, []);

    const complete = useCallback(() => {
        clear();
        heavyFeedback();
        onComplete();
        fill.set(withTiming(0, EMPTY));
    }, [heavyFeedback, onComplete, fill]);

    const start = () => {
        if (disabled || loading) return;
        clear();
        // The buzz builds as the fill does.
        timers.current = [
            setTimeout(lightFeedback, HOLD_MS * 0.25),
            setTimeout(lightFeedback, HOLD_MS * 0.5),
            setTimeout(mediumFeedback, HOLD_MS * 0.75),
        ];
        fill.set(withTiming(1, FILL, finished => { if (finished) runOnJS(complete)(); }));
    };
    const stop = () => {
        if (fill.get() >= 1) return;
        clear();
        cancelAnimation(fill);
        fill.set(withTiming(0, EMPTY));
    };

    const width = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
    return (
        <View style={styles.wrap}>
            <Pressable onPressIn={start} onPressOut={stop} disabled={disabled || loading}
                accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Double-tap to confirm"
                accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
                accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate' && !disabled && !loading) complete(); }}>
                <MatteSurface radius={Radius.control} level="control" style={[styles.button, (disabled || loading) && styles.dim]}>
                    <Animated.View pointerEvents="none" style={[styles.fill, { backgroundColor: t.tint('soft') }, width]} />
                    {icon ? <AppIcon name={icon} filled size={Control.icon} color={t.color.textPrimary} /> : null}
                    <Text variant="heading">{loading ? 'One moment…' : label}</Text>
                </MatteSurface>
            </Pressable>
            <Text variant="caption" tone="muted" align="center">{hint}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    button: { minHeight: Control.height + Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, overflow: 'hidden' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
    dim: { opacity: 0.5 },
});
