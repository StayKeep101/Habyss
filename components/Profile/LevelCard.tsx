import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedFill, CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { rankFor } from '@/lib/marks';

/**
 * Someone's place in the climb, in type alone: the rank their Marks have
 * reached, the Marks themselves, a hairline of how far to the next ledge.
 * Drawn bare, to sit at the top of the profile's one card. Lost is unranked:
 * the first ledge is Beginner.
 */
export function LevelCard({ marks }: { marks: number }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { rank, next, progress, toNext } = rankFor(marks);
    return (
        <View style={styles.wrap}>
            <View style={styles.top}>
                <View style={styles.text}>
                    <Text style={[styles.caption, { color: colors.textTertiary }]}>{rank.min === 0 ? 'Unranked' : 'Rank'}</Text>
                    <Text style={[styles.rank, { color: colors.textPrimary }]}>{rank.name}</Text>
                </View>
                <View style={styles.right}>
                    <Text style={[styles.caption, { color: colors.textTertiary }]}>Marks</Text>
                    <CountUp style={[styles.marks, { color: colors.textPrimary }]} value={marks} />
                </View>
            </View>
            <View style={[styles.track, { backgroundColor: colors.border }]}>
                <AnimatedFill progress={progress} style={[styles.fill, { backgroundColor: primary }]} />
            </View>
            <Text style={[styles.next, { color: colors.textTertiary }]}>
                {/* The climb, in its own words: Lost has not found the wall yet. */}
                {!next ? 'Out of the abyss' : rank.min === 0
                    ? `${toNext.toLocaleString()} to the first ledge`
                    : `${toNext.toLocaleString()} to ${next.name}`}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    top: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
    text: { flex: 1 },
    right: { alignItems: 'flex-end' },
    caption: { fontFamily: FontFamily.medium, fontSize: 12 },
    rank: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
    marks: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
    track: { height: 3, borderRadius: 1.5, overflow: 'hidden', marginTop: Spacing.xs },
    fill: { height: '100%', borderRadius: 1.5 },
    next: { fontFamily: FontFamily.regular, fontSize: 12, textAlign: 'right' },
});
