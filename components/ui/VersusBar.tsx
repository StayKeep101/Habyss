import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { Radius, Spacing } from '@/theme/designSystem';
import { CountUp, useProgress } from './Motion';
import { Text } from './Text';

export interface VersusSide {
    /** What this side is: "You", "Makes it". */
    label: string;
    /** Its figure, 0 to 100, said as a percentage. */
    percent: number;
    color: string;
}

/**
 * Two sides on one line, the way a market shows long against short:
 * "22% Long ━━━━━━ 78% Short". The bar splits where the two figures meet;
 * the side in front is drawn in full colour, the other faded, so who is
 * winning reads before a number does. Figures count up and the split glides.
 */
export function VersusBar({ left, right, replay }: { left: VersusSide; right: VersusSide; replay?: unknown }) {
    const t = useTokens();
    const total = left.percent + right.percent;
    const split = total > 0 ? left.percent / total : 0.5;
    const shown = useProgress(split, 0, replay);
    const leftGrow = useAnimatedStyle(() => ({ flex: Math.max(0.001, shown.get()) }));
    const rightGrow = useAnimatedStyle(() => ({ flex: Math.max(0.001, 1 - shown.get()) }));
    const leftLeads = left.percent >= right.percent;
    const rightLeads = right.percent >= left.percent;
    const side = (item: VersusSide, leads: boolean, end: boolean) => (
        <View style={[styles.side, end && styles.end]}>
            <CountUp value={`${Math.round(item.percent)}%`} replay={replay}
                style={[t.type.heading, styles.figure, { color: leads ? item.color : t.color.textMuted }]} />
            <Text variant="bodySmall" tone="muted" numberOfLines={1}>{item.label}</Text>
        </View>
    );
    return (
        <View style={styles.row} accessible accessibilityRole="progressbar"
            accessibilityLabel={`${left.label} ${Math.round(left.percent)}%, ${right.label} ${Math.round(right.percent)}%`}>
            {side(left, leftLeads, false)}
            <View style={styles.track}>
                <Animated.View style={[styles.half, { backgroundColor: leftLeads ? left.color : t.tint('soft', left.color) }, leftGrow]} />
                <Animated.View style={[styles.half, { backgroundColor: rightLeads ? right.color : t.tint('soft', right.color) }, rightGrow]} />
            </View>
            {side(right, rightLeads, true)}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    side: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, flexShrink: 1 },
    end: { justifyContent: 'flex-end' },
    figure: { fontVariant: ['tabular-nums'] },
    track: { flex: 1, flexDirection: 'row', gap: Spacing.xs, height: Spacing.sm },
    half: { height: '100%', borderRadius: Radius.pill },
});
