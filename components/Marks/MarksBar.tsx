import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedFill, CountUp } from '@/components/ui/Motion';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Marks } from '@/hooks/useMarks';
import type { GoalPoint } from '@/lib/goalInsights';
import { noteMarksTotal, onOrbLanded, registerMarksTarget } from '@/lib/marksOrbs';

/**
 * Your Marks and rank, beside your picture, said plainly.
 *
 * Top: the word "Marks", the number, how it moved today, and a miniature of
 * the all-time chart. Then the bar to the next rank, and one sentence saying
 * what that bar is — "Rank Lost · 99 marks to Beginner" — so nobody has to
 * guess what "LOST" next to a number means. Tap for the full chart.
 */
export const MarksBar: React.FC<{ marks: Marks; onPress: () => void }> = ({ marks, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary, foreground } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const change = marks.todayChange;

    // Where the Marks orbs land, while this screen is in front; each one gives the number a bump.
    const totalRef = useRef<View>(null);
    useFocusEffect(useCallback(() => registerMarksTarget('marks-bar', done => {
        const node = totalRef.current;
        if (!node) { done(null); return; }
        node.measureInWindow((x, y, width, height) => done(width ? { x: x + width / 2, y: y + height / 2 } : null));
    }), []));
    // The total, for the pill that counts orbs in on screens without this bar.
    useEffect(() => { noteMarksTotal(marks.total); }, [marks.total]);
    const bump = useSharedValue(1);
    useEffect(() => onOrbLanded(() => {
        bump.value = withSequence(withTiming(1.08, { duration: 60 }), withTiming(1, { duration: 140 }));
    }), [bump]);
    const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

    // The all-time line, as a miniature of the chart in the Marks window.
    const series = useMemo<GoalPoint[]>(
        () => marks.series.map(point => ({ date: point.date, actual: point.value, pace: point.value, value: point.value })),
        [marks.series],
    );

    return (
        // A static style, deliberately: a Pressable whose style is a function
        // does not stretch with flex on this React Native.
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${marks.total} Marks, rank ${marks.rank.name}.${marks.next ? ` ${marks.toNext} to ${marks.next.name}.` : ''} Open the Marks chart.`}
            onPress={() => { lightFeedback(); onPress(); }}
            style={styles.wrap}
        >
            <View style={styles.top}>
                <View>
                    <Text style={[styles.caption, { color: colors.textTertiary }]}>Marks</Text>
                    <View style={styles.totalRow}>
                        <Animated.View ref={totalRef} collapsable={false} style={bumpStyle}>
                            <CountUp style={[styles.total, { color: colors.textPrimary }]} value={marks.total.toLocaleString()} />
                        </Animated.View>
                        {change !== 0 ? (
                            <Text style={[styles.change, { color: change > 0 ? colors.success : colors.error }]}>
                                {change > 0 ? '+' : '−'}{Math.abs(change)} today
                            </Text>
                        ) : null}
                    </View>
                </View>
                {series.length > 1 ? (
                    <View style={styles.spark} pointerEvents="none">
                        <GoalProgressChart series={series} color={primary} compact unbounded height={38} label="Marks over time" />
                    </View>
                ) : null}
            </View>
            <View style={[styles.track, { backgroundColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }]}>
                <AnimatedFill progress={Math.max(0.02, marks.progress)} style={[styles.fill, { backgroundColor: primary }]} />
            </View>
            <Text numberOfLines={1} style={[styles.caption, { color: colors.textTertiary }]}>
                Rank <Text style={[styles.rank, { color: foreground }]}>{marks.rank.name}</Text>
                {marks.next ? ` · ${marks.toNext.toLocaleString()} marks to ${marks.next.name}` : ' · the highest rank'}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    wrap: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', gap: vs(6) },
    top: { flexDirection: 'row', alignItems: 'flex-end', gap: s(10) },
    totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: s(8) },
    total: { fontSize: ms(24), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    change: { fontSize: ms(12), fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    spark: { flex: 1, height: 38 },
    caption: { fontSize: ms(12), fontFamily: FontFamily.regular },
    rank: { fontFamily: FontFamily.medium },
    track: { height: vs(5), borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
});
