import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp } from '@/components/ui/Motion';
import { textOn } from '@/theme/tokens';
import { Control, FontFamily, Spacing } from '@/theme/designSystem';

const minutesLabel = (seconds: number) => {
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} min focused`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} h${rest ? ` ${rest} min` : ''} focused`;
};

/**
 * Between one thing and the next on a focused day: what was just done, how
 * long the focus held, and the Marks it earned (the orbs fly while this is
 * up), then Next, or Done for now. Over the focus page's black.
 */
export function FocusSummary({ title, seconds, marks, accent, onNext, onClose }: {
    title: string; seconds: number; marks: number; accent: string;
    /** Absent when there is nothing to go on to (Finished, not Done · Next). */
    onNext?: () => void;
    onClose: () => void;
}) {
    // The check lands with a little weight: grows past its size and settles, no bounce.
    const land = useSharedValue(0);
    useEffect(() => {
        land.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.4)), reduceMotion: ReduceMotion.System });
    }, [land]);
    const check = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + land.value * 0.4 }], opacity: Math.min(1, land.value * 2) }));
    const rise = (delay: number) => FadeInDown.delay(delay).duration(360).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
    return (
        <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)} style={styles.screen} accessibilityViewIsModal>
            <View style={styles.center}>
                <Animated.View style={[styles.check, { backgroundColor: accent }, check]}>
                    <AppIcon name="checkmark" size={44} color={textOn(accent)} />
                </Animated.View>
                <Animated.Text entering={rise(140)} style={styles.eyebrow}>Done</Animated.Text>
                <Animated.Text entering={rise(200)} numberOfLines={2} style={styles.title} accessibilityRole="header">{title}</Animated.Text>
                <Animated.Text entering={rise(260)} style={styles.time}>{minutesLabel(seconds)}</Animated.Text>
                {marks > 0 ? (
                    <Animated.View entering={rise(340)} style={styles.marks}>
                        <AppIcon name="sparkles" size={16} color={accent} />
                        <CountUp style={[styles.marksText, { color: accent }]} value={`+${marks} Marks`} />
                    </Animated.View>
                ) : null}
            </View>
            <Animated.View entering={rise(420)} style={styles.actions}>
                {onNext ? (
                    <Pressable onPress={onNext} style={styles.next} accessibilityRole="button" accessibilityLabel="Next">
                        <Text style={styles.nextText}>Next</Text>
                        <AppIcon name="arrow-forward" size={18} color="#000000" />
                    </Pressable>
                ) : null}
                <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
                    <Text style={styles.closeText}>{onNext ? 'Done for now' : 'Close'}</Text>
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

// Over the focus page's black, like the rest of it.
const styles = StyleSheet.create({
    screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000000', justifyContent: 'space-between', paddingVertical: Spacing.section * 2, paddingHorizontal: Spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    check: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    eyebrow: { fontFamily: FontFamily.semibold, fontSize: 15, color: 'rgba(255,255,255,0.7)' },
    title: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, color: '#FFFFFF', textAlign: 'center' },
    time: { fontFamily: FontFamily.medium, fontSize: 17, color: 'rgba(255,255,255,0.75)' },
    marks: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
    marksText: { fontFamily: FontFamily.semibold, fontSize: 17 },
    actions: { gap: Spacing.sm },
    next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
    nextText: { fontFamily: FontFamily.semibold, fontSize: 17, color: '#000000' },
    close: { minHeight: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontFamily: FontFamily.semibold, fontSize: 16, color: 'rgba(255,255,255,0.75)' },
});
