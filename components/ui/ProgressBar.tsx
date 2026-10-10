import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';

export interface ProgressBarProps {
    /** 0 to 1. */
    progress: number;
    tone?: 'accent' | 'success' | 'warning' | 'danger';
    /** Split into this many slots that fill one by one (the day's 3 or 5). */
    segments?: number;
    thickness?: 'thin' | 'regular';
}

/** A bar that fills: one track, or a row of slots. */
export function ProgressBar({ progress, tone = 'accent', segments, thickness = 'regular' }: ProgressBarProps) {
    const t = useTokens();
    const color = { accent: t.color.accent, success: t.color.success, warning: t.color.warning, danger: t.color.danger }[tone];
    const height = thickness === 'thin' ? t.space.xs : t.space.xs + t.space.xs / 2;
    const value = Math.max(0, Math.min(1, progress));
    const width = useSharedValue(value);
    useEffect(() => {
        width.set(withTiming(value, { duration: 520, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    }, [value, width]);
    const fill = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));

    if (segments && segments > 0) {
        const filled = Math.round(value * segments);
        return (
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: segments, now: filled }} style={{ flexDirection: 'row', gap: t.space.sm }}>
                {Array.from({ length: segments }, (_, index) => (
                    <View key={index} style={{ flex: 1, height, borderRadius: t.radius.full, backgroundColor: index < filled ? color : t.color.surfaceRaised }} />
                ))}
            </View>
        );
    }
    return (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
            style={{ height, borderRadius: t.radius.full, backgroundColor: t.color.surfaceRaised, overflow: 'hidden' }}>
            <Animated.View style={[{ height: '100%', borderRadius: t.radius.full, backgroundColor: color }, fill]} />
        </View>
    );
}
