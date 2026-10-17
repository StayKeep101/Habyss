import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconButton } from '@/components/ui/IconButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useInsightAction } from '@/hooks/useInsightAction';
import { dismissInsight } from '@/lib/echoMemory';
import { shiftDay } from '@/lib/habitDays';
import type { Insight } from '@/lib/echoInsights';

/** One thing Echo noticed: the line, the numbers behind it, one action, and a cross. */
export function InsightRow({ insight, today }: { insight: Insight; today: string }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const act = useInsightAction();
    return (
        <VoidCard style={styles.card}>
            <View style={styles.row}>
                <Text style={[styles.text, { color: colors.textPrimary }]}>{insight.text}</Text>
                <IconButton icon="close" label="Not now" diameter={26} size={13} color={colors.textTertiary}
                    onPress={() => { selectionFeedback(); void dismissInsight(insight.id, shiftDay(today, 3)); }} />
            </View>
            <Text style={[styles.evidence, { color: colors.textTertiary }]}>{insight.evidence}</Text>
            {insight.action && insight.actionLabel ? (
                <Pressable accessibilityRole="button" style={styles.actionWrap}
                    onPress={() => { selectionFeedback(); act(insight.action!); if (insight.action!.type === 'remember') void dismissInsight(insight.id, shiftDay(today, 365)); }}>
                    <MatteSurface radius={Radius.pill} level="control" tint={primary} style={styles.action}>
                        <Text style={[styles.actionText, { color: textOn(primary) }]}>{insight.actionLabel}</Text>
                    </MatteSurface>
                </Pressable>
            ) : null}
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { padding: Spacing.lg, gap: Spacing.xs + 2 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    text: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
    evidence: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17 },
    actionWrap: { alignSelf: 'flex-start', marginTop: Spacing.xs },
    action: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    actionText: { fontFamily: FontFamily.semibold, fontSize: 13 },
});
