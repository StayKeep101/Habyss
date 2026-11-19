import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SectionTitle, StatTile, VoidCard } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useWeekNumbers } from '@/hooks/useWeekNumbers';
import { Control, Spacing } from '@/theme/designSystem';

interface Tile { key: string; value: string; label: string; detail?: string; route?: string }

/**
 * This week in five numbers: focus, the top 3, goals, sleep and time against
 * the plan. Each one opens where it is counted. A number with nothing behind
 * it yet (no Health, too few samples) is left out rather than shown as zero.
 */
export function WeekNumbers() {
    const { selectionFeedback } = useHaptics();
    const week = useWeekNumbers();
    const tiles: Tile[] = [
        { key: 'focus', value: `${week.focusHours} h`, label: 'Focused',
            detail: week.focusChange ? `${week.focusChange > 0 ? '+' : '−'}${Math.abs(week.focusChange)} h` : undefined, route: '/(root)/focus-stats' },
        ...(week.topRate !== null ? [{ key: 'top', value: `${week.topRate}%`, label: 'Top 3 done', detail: week.topNote ?? undefined, route: '/(root)/task-stats' }] : []),
        ...(week.goals !== null ? [{ key: 'goals', value: `${week.goals}%`, label: 'Goals', route: '/(root)/goal-stats' }] : []),
        ...(week.sleep !== null ? [{ key: 'sleep', value: `${week.sleep} h`, label: 'Sleep' }] : []),
        ...(week.plan !== null ? [{ key: 'plan', value: `${week.plan}×`, label: 'Time vs plan' }] : []),
    ];
    const rows = [tiles.slice(0, 3), tiles.slice(3)].filter(row => row.length);
    return (
        <View style={styles.section}>
            <SectionTitle>This week</SectionTitle>
            <VoidCard style={styles.card}>
                {rows.map((row, index) => (
                    <View key={index} style={styles.row}>
                        {row.map(tile => (
                            <Pressable key={tile.key} style={styles.tile} disabled={!tile.route}
                                accessibilityRole={tile.route ? 'button' : undefined}
                                onPress={() => { if (!tile.route) return; selectionFeedback(); router.push(tile.route as never); }}>
                                <StatTile value={tile.value} label={tile.label} detail={tile.detail} />
                            </Pressable>
                        ))}
                    </View>
                ))}
            </VoidCard>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.sm },
    card: { gap: Spacing.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md },
    row: { flexDirection: 'row' },
    tile: { flex: 1, minHeight: Control.hitTarget },
});
