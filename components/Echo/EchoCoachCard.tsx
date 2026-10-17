import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { router } from 'expo-router';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconButton } from '@/components/ui/IconButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useInsightAction } from '@/hooks/useInsightAction';
import { dismissInsight, setEnergy, type Energy } from '@/lib/echoMemory';
import { shiftDay } from '@/lib/habitDays';
import type { Insight } from '@/lib/echoInsights';

const ENERGY: { id: Energy; label: string }[] = [{ id: 'low', label: 'Low' }, { id: 'ok', label: 'Okay' }, { id: 'high', label: 'High' }];

/**
 * Echo on Home: the one thing worth knowing right now, with the one action
 * that helps, and a cross to wave it away for a few days. When there is
 * nothing worth saying, it asks how your energy is today (once), and
 * otherwise stays out of the way.
 */
export function EchoCoachCard({ insight, energy, today }: { insight: Insight | undefined; energy: Energy | null; today: string }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback, lightFeedback } = useHaptics();
    const act = useInsightAction();

    if (!insight && energy) return null;

    return (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(220)}>
            <VoidCard style={styles.card}>
                <View style={styles.head}>
                    <AppIcon name="sparkles" size={13} color={primary} />
                    <Pressable onPress={() => { lightFeedback(); router.push('/(root)/echo' as never); }} hitSlop={8} style={styles.flex}
                        accessibilityRole="button" accessibilityLabel="Open Echo">
                        <Text style={[styles.label, { color: colors.textTertiary }]}>Echo</Text>
                    </Pressable>
                    {insight ? (
                        <IconButton icon="close" label="Not now" diameter={26} size={13} color={colors.textTertiary}
                            onPress={() => { selectionFeedback(); void dismissInsight(insight.id, shiftDay(today, 3)); }} />
                    ) : null}
                </View>

                {insight ? (
                    <>
                        <Text style={[styles.text, { color: colors.textPrimary }]}>{insight.text}</Text>
                        <Text style={[styles.evidence, { color: colors.textTertiary }]}>{insight.evidence}</Text>
                        {insight.action && insight.actionLabel ? (
                            <Pressable onPress={() => { selectionFeedback(); act(insight.action!); if (insight.action!.type === 'remember') void dismissInsight(insight.id, shiftDay(today, 365)); }}
                                accessibilityRole="button" style={styles.actionWrap}>
                                <MatteSurface radius={Radius.pill} level="control" tint={primary} style={styles.action}>
                                    <Text style={[styles.actionText, { color: textOn(primary) }]}>{insight.actionLabel}</Text>
                                </MatteSurface>
                            </Pressable>
                        ) : null}
                    </>
                ) : (
                    <>
                        <Text style={[styles.text, { color: colors.textPrimary }]}>How’s your energy today?</Text>
                        <View style={styles.row}>
                            {ENERGY.map(option => (
                                <Pressable key={option.id} style={styles.flex} accessibilityRole="button" accessibilityLabel={`Energy ${option.label}`}
                                    onPress={() => { selectionFeedback(); void setEnergy(today, option.id); }}>
                                    <MatteSurface radius={Radius.pill} level="control" style={styles.chip}>
                                        <Text style={[styles.chipText, { color: colors.textSecondary }]}>{option.label}</Text>
                                    </MatteSurface>
                                </Pressable>
                            ))}
                        </View>
                    </>
                )}
            </VoidCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    card: { padding: Spacing.lg, gap: Spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
    label: { fontFamily: FontFamily.medium, fontSize: 12 },
    text: { fontFamily: FontFamily.semibold, fontSize: 15, lineHeight: 21 },
    evidence: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17 },
    actionWrap: { alignSelf: 'flex-start', marginTop: Spacing.xs },
    action: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
    actionText: { fontFamily: FontFamily.semibold, fontSize: 13 },
    row: { flexDirection: 'row', gap: Spacing.sm },
    chip: { paddingVertical: Spacing.sm, alignItems: 'center' },
    chipText: { fontFamily: FontFamily.medium, fontSize: 13 },
});
