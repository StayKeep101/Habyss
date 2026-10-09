import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { s, vs, ms } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Marks } from '@/hooks/useMarks';

/**
 * Your Marks and rank, beside your picture.
 *
 * Quiet on purpose: a rank name, a number, a hairline of progress to the next
 * rank. It is a record of discipline rather than a game score, so there is no
 * confetti, no level-up badge, nothing to tap for a dopamine hit — only the
 * number moving, and a chart behind it for anybody who wants to read it.
 */
export const MarksBar: React.FC<{ marks: Marks; onPress: () => void }> = ({ marks, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary, foreground } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const change = marks.todayChange;

    return (
        // A static style, deliberately: a Pressable whose style is a function
        // does not stretch with flex on this React Native, which is why the bar
        // stopped halfway across the screen.
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${marks.total} Marks, rank ${marks.rank.name}.${marks.next ? ` ${marks.toNext} to ${marks.next.name}.` : ''} Open the Marks chart.`}
            onPress={() => { lightFeedback(); onPress(); }}
            style={styles.wrap}
        >
            <View style={styles.top}>
                <View style={styles.rankRow}>
                    <View style={[styles.rankDot, { backgroundColor: primary }]} />
                    <Text numberOfLines={1} style={[styles.rank, { color: foreground }]}>{marks.rank.name.toUpperCase()}</Text>
                </View>
                <Text style={[styles.total, { color: colors.textPrimary }]}>
                    {marks.total.toLocaleString()}
                    <Text style={[styles.unit, { color: colors.textTertiary }]}> marks</Text>
                </Text>
            </View>
            <View style={[styles.track, { backgroundColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }]}>
                <View style={[styles.fill, { width: `${Math.max(2, marks.progress * 100)}%`, backgroundColor: primary }]} />
            </View>
            <View style={styles.bottom}>
                <Text numberOfLines={1} style={[styles.caption, { color: colors.textTertiary }]}>
                    {marks.next ? `${marks.toNext.toLocaleString()} to ${marks.next.name}` : 'Highest rank'}
                </Text>
                {change !== 0 ? (
                    <Text style={[styles.change, { color: change > 0 ? colors.success : colors.error }]}>
                        {change > 0 ? '+' : '−'}{Math.abs(change)} today
                    </Text>
                ) : null}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    wrap: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', gap: vs(6) },
    top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: s(8) },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: s(6), flexShrink: 1 },
    rankDot: { width: s(6), height: s(6), borderRadius: s(3) },
    rank: { flexShrink: 1, fontSize: ms(11), letterSpacing: 1.8, fontFamily: FontFamily.semibold },
    total: { fontSize: ms(22), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    unit: { fontSize: ms(11), fontFamily: FontFamily.medium, letterSpacing: 0 },
    track: { height: vs(5), borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: s(8) },
    caption: { flexShrink: 1, fontSize: ms(11), fontFamily: FontFamily.regular },
    change: { fontSize: ms(11), fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
});
