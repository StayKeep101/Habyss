import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { RankGem } from '@/components/ui/RankGem';
import { rankTone } from '@/theme/tokens';
import { useHaptics } from '@/hooks/useHaptics';
import { AnimatedFill, CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { rankFor } from '@/lib/marks';

/**
 * Someone's place in the climb: their rank's gem and name, the Marks
 * themselves, a hairline in the rank's colour of how far to the next ledge.
 * A tap opens every rank as a collection (app/(root)/ranks.tsx).
 * Drawn bare, to sit at the top of the profile's one card. Lost is unranked:
 * the first ledge is Beginner.
 */
export function LevelCard({ marks }: { marks: number }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback } = useHaptics();
    const { rank, next, progress, toNext } = rankFor(marks);
    return (
        <Pressable style={styles.wrap} accessibilityRole="button" accessibilityLabel={`${rank.name}, ${marks} Marks. See every rank.`}
            onPress={() => { lightFeedback(); router.push({ pathname: '/(root)/ranks' as never, params: { marks: String(marks) } }); }}>
            <View style={styles.top}>
                <RankGem rank={rank.name} size={Spacing.xxl * 2} />
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
                <AnimatedFill progress={progress} style={[styles.fill, { backgroundColor: rankTone(rank.name).color }]} />
            </View>
            <Text style={[styles.next, { color: colors.textTertiary }]}>
                {/* The climb, in its own words: Lost has not found the wall yet. */}
                {!next ? 'Out of the abyss' : rank.min === 0
                    ? `${toNext.toLocaleString()} to the first ledge`
                    : `${toNext.toLocaleString()} to ${next.name}`}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    text: { flex: 1 },
    right: { alignItems: 'flex-end' },
    caption: { fontFamily: FontFamily.medium, fontSize: 12 },
    rank: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
    marks: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
    track: { height: 3, borderRadius: 1.5, overflow: 'hidden', marginTop: Spacing.xs },
    fill: { height: '100%', borderRadius: 1.5 },
    next: { fontFamily: FontFamily.regular, fontSize: 12, textAlign: 'right' },
});
