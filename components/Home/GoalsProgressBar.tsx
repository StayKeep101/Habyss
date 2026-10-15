import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AnimatedFill } from '@/components/ui/Motion';
import { VoidCard } from '@/components/ui/VoidCard';
import { ValuePill } from '@/components/Goal/GoalRows';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { s, vs, ms } from '@/theme/scale';
import type { GoalPoint } from '@/lib/goalInsights';

interface GoalsProgressBarProps {
    progress: number; // 0-100
    onPress: () => void;
    goalsCount: number;
    /** Progress across every goal, day by day. */
    series?: GoalPoint[];
}

/**
 * Your goals on the home page: the word, where they stand, and a small line of
 * how they got there. Tap for every goal.
 */
export const GoalsProgressBar: React.FC<GoalsProgressBarProps> = ({ progress, onPress, goalsCount, series = [] }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const value = Math.max(0, Math.min(100, Math.round(progress)));

    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Goals, ${value}% across ${goalsCount}`} onPress={onPress} activeOpacity={0.8}>
            <VoidCard style={styles.container}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Goals</Text>
                    <ValuePill value={`${value}%`} />
                </View>
                {series.length > 1 ? (
                    <View pointerEvents="none" style={styles.chart}>
                        <GoalProgressChart series={series} color={primary} compact height={vs(56)} label="Goal progress over time" />
                    </View>
                ) : (
                    <View style={[styles.track, { backgroundColor: colors.border }]}>
                        <AnimatedFill progress={value / 100} style={[styles.fill, { backgroundColor: primary }]} />
                    </View>
                )}
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { padding: s(18), gap: vs(12) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: ms(17), fontFamily: FontFamily.bold },
    chart: { height: vs(56) },
    track: { height: vs(6), borderRadius: s(3), overflow: 'hidden' },
    fill: { height: '100%', borderRadius: s(3) },
});
