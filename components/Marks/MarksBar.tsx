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
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${marks.total} Marks, rank ${marks.rank.name}.${marks.next ? ` ${marks.toNext} to ${marks.next.name}.` : ''} Open the Marks chart.`}
            onPress={() => { lightFeedback(); onPress(); }}
            style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.7 : 1 }]}
        >
            <View style={styles.top}>
                <Text numberOfLines={1} style={[styles.rank, { color: foreground }]}>{marks.rank.name.toUpperCase()}</Text>
                <View style={styles.numberRow}>
                    {change !== 0 ? (
                        <Text style={[styles.change, { color: change > 0 ? colors.success : colors.error }]}>
                            {change > 0 ? '+' : '−'}{Math.abs(change)}
                        </Text>
                    ) : null}
                    <Text style={[styles.total, { color: colors.textPrimary }]}>{marks.total.toLocaleString()}</Text>
                </View>
            </View>
            <View style={[styles.track, { backgroundColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }]}>
                <View style={[styles.fill, { width: `${Math.max(2, marks.progress * 100)}%`, backgroundColor: primary }]} />
            </View>
            <Text numberOfLines={1} style={[styles.caption, { color: colors.textTertiary }]}>
                {marks.next ? `${marks.toNext.toLocaleString()} Marks to ${marks.next.name}` : 'The highest rank'}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'center' },
    top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: s(8) },
    rank: { flexShrink: 1, fontSize: ms(11), letterSpacing: 1.6, fontFamily: FontFamily.semibold },
    numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: s(6) },
    change: { fontSize: ms(11), fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    total: { fontSize: ms(20), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
    track: { height: vs(4), borderRadius: 2, overflow: 'hidden', marginTop: vs(6) },
    fill: { height: '100%', borderRadius: 2 },
    caption: { fontSize: ms(11), fontFamily: FontFamily.regular, marginTop: vs(5) },
});
