import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AnimatedFill } from '@/components/ui/Motion';
import { AppIcon } from '@/components/ui/AppIcon';
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
 * how they got there. Press or drag along the line to read a day (its date and
 * percent take the header's place); let go and it is today again. Only the
 * header row, with its chevron, opens every goal.
 */
const dayName = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const GoalsProgressBar: React.FC<GoalsProgressBarProps> = ({ progress, onPress, goalsCount, series = [] }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const value = Math.max(0, Math.min(100, Math.round(progress)));

    const [reading, setReading] = useState<GoalPoint | null>(null);
    const shown = reading ? Math.max(0, Math.min(100, Math.round(reading.actual))) : value;

    return (
        <VoidCard style={styles.container}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Goals, ${value}% across ${goalsCount}. Open every goal`} onPress={onPress} activeOpacity={0.7} style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Goals</Text>
                    {reading ? <Text style={[styles.day, { color: colors.textTertiary }]}>{dayName(reading.date)}</Text> : null}
                </View>
                <View style={styles.titleRow}>
                    <ValuePill value={`${shown}%`} />
                    <AppIcon name="chevron-forward" size={s(16)} color={colors.textTertiary} />
                </View>
            </TouchableOpacity>
            {series.length > 1 ? (
                <View style={styles.chart}>
                    {/* Read, not sticky: the reading goes when the finger lifts. No range buttons. */}
                    <GoalProgressChart series={series} color={primary} ranges={[]} sticky={false} pace={false} height={vs(56)}
                        label="Goal progress over time" onScrub={setReading} />
                </View>
            ) : (
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                    <AnimatedFill progress={value / 100} style={[styles.fill, { backgroundColor: primary }]} />
                </View>
            )}
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    container: { padding: s(18), paddingTop: s(10), gap: vs(8) },
    // The one part that opens every goal: a full-height row, the chevron saying so.
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    day: { fontSize: ms(13), fontFamily: FontFamily.medium },
    title: { fontSize: ms(17), fontFamily: FontFamily.bold },
    chart: { height: vs(56) },
    track: { height: vs(6), borderRadius: s(3), overflow: 'hidden' },
    fill: { height: '100%', borderRadius: s(3) },
});
