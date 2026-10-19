import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { focusDuration, focusSummary } from '@/lib/focusStats';
import { todayKey } from '@/lib/tasks';

/** This week's focus time, on your profile; a tap opens the Focus page. */
export function FocusCard({ onPress }: { onPress: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const summary = focusSummary(useFocusRecords(), todayKey());
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Focus: ${focusDuration(summary.week)} this week`}>
            <VoidCard style={styles.card}>
                <AppIcon name="timer" filled size={26} color={primary} />
                <View style={styles.text}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Focus</Text>
                    <Text style={[styles.sub, { color: colors.textTertiary }]}>
                        {summary.sessions ? `This week · ${summary.streak} day${summary.streak === 1 ? '' : 's'} in a row` : 'Every focus session shows up here.'}
                    </Text>
                </View>
                <CountUp style={[styles.count, { color: summary.week ? colors.textPrimary : colors.textTertiary }]} value={focusDuration(summary.week)} />
                <AppIcon name="chevron-forward" size={16} color={colors.textTertiary} />
            </VoidCard>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, marginHorizontal: Spacing.xl, marginTop: Spacing.lg },
    text: { flex: 1, gap: 2 },
    title: { fontFamily: FontFamily.semibold, fontSize: 15 },
    sub: { fontFamily: FontFamily.regular, fontSize: 12 },
    count: { fontFamily: FontFamily.bold, fontSize: 20, fontVariant: ['tabular-nums'] },
});
