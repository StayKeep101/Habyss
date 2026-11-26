import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';

/**
 * Where you are in pages you swipe between: one dot per page, the current one
 * stretched into a short bar. Follows the finger (`progress` is the page
 * position, 0 to count − 1, while swiping). Each dot is also a tab you can tap
 * or reach with VoiceOver; `fresh` puts the accent on a page with something new.
 */
export function PageDots({ progress, current, labels, fresh, onPick }: {
    progress: SharedValue<number>;
    /** The page settled on, for VoiceOver. */
    current: number;
    labels: string[];
    fresh?: boolean[];
    onPick: (index: number) => void;
}) {
    const t = useTokens();
    return (
        <View style={styles.row} accessibilityRole="tablist">
            {labels.map((label, index) => (
                <Dot key={label} index={index} selected={index === current} progress={progress} label={label} fresh={!!fresh?.[index]} onPick={onPick} />
            ))}
        </View>
    );
}

function Dot({ index, selected, progress, label, fresh, onPick }: {
    index: number; selected: boolean; progress: SharedValue<number>; label: string; fresh: boolean; onPick: (index: number) => void;
}) {
    const t = useTokens();
    const dot = t.space.sm - 1;
    const bar = t.space.xl;
    const style = useAnimatedStyle(() => {
        const near = 1 - Math.min(1, Math.abs(progress.get() - index));
        return { width: interpolate(near, [0, 1], [dot, bar]), opacity: interpolate(near, [0, 1], [0.35, 1]) };
    });
    return (
        // Each dot sits in a 44-point target, so a bare dot is still easy to hit.
        <Pressable onPress={() => onPick(index)} style={[styles.target, { width: bar + t.space.md }]}
            accessibilityRole="tab" accessibilityLabel={fresh ? `${label}, something new` : label}
            accessibilityState={{ selected }}>
            <Animated.View style={[{ height: dot, borderRadius: dot / 2, backgroundColor: fresh ? t.color.accent : t.color.textPrimary }, style]} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    target: { height: 44, alignItems: 'center', justifyContent: 'center' },
});
