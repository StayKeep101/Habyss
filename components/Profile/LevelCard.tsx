import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconTile } from '@/components/ui/IconTile';
import { AnimatedFill, CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { rankFor } from '@/lib/marks';

/**
 * Someone's place in the climb: the rank their Marks have reached, the total,
 * and how far to the next ledge. The same card on your profile and on a
 * friend's page. Lost is unranked: the first ledge is Beginner.
 */
export function LevelCard({ marks }: { marks: number }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { rank, next, progress, toNext } = rankFor(marks);
    return (
        <VoidCard style={styles.card}>
            <View style={styles.top}>
                <IconTile icon="trophy" color={primary} size={44} shape="square" />
                <View style={styles.text}>
                    <Text style={[styles.rank, { color: colors.textPrimary }]}>{rank.name}</Text>
                    <Text style={[styles.sub, { color: colors.textTertiary }]}>{rank.min === 0 ? 'Unranked' : 'Rank'}</Text>
                </View>
                <View style={styles.right}>
                    <CountUp style={[styles.marks, { color: colors.textPrimary }]} value={marks} />
                    <Text style={[styles.sub, { color: colors.textTertiary }]}>Marks</Text>
                </View>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
                <AnimatedFill progress={progress} style={[styles.fill, { backgroundColor: primary }]} />
            </View>
            <Text style={[styles.next, { color: colors.textTertiary }]}>
                {/* The climb, in its own words: Lost has not found the wall yet. */}
                {!next ? 'Out of the abyss' : rank.min === 0
                    ? `${toNext.toLocaleString()} Marks to the first ledge`
                    : `${toNext.toLocaleString()} Marks to ${next.name}`}
            </Text>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.md },
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    text: { flex: 1, gap: 2 },
    right: { alignItems: 'flex-end', gap: 2 },
    rank: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
    marks: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
    sub: { fontFamily: FontFamily.regular, fontSize: 12 },
    track: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    next: { fontFamily: FontFamily.regular, fontSize: 12 },
});
