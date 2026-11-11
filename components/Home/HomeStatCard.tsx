import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

/**
 * One of the small cards beside the streak: its icon on the left, a touch
 * larger than the figure, and the figure beside it. `label` names it for
 * VoiceOver only; a `note`, when there is one, says what it means right now.
 */
export function HomeStatCard({ icon, tint, value, label, note, noteTint, onPress, accessibilityLabel }: {
    icon: string; tint: string; value: string | number; label: string; note?: string; noteTint?: string;
    onPress: () => void; accessibilityLabel: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.touch}>
            <VoidCard style={styles.card}>
                {/* The icon first, a little larger than the figure, then the figure
                    beside it, the way Duolingo lays out a stat. Its name is for
                    VoiceOver (accessibilityLabel); the icon says it on screen. */}
                <AppIcon filled name={icon as never} size={28} color={tint} />
                <View style={styles.readout}>
                    <CountUp style={[styles.value, { color: colors.textPrimary }]} value={value} />
                    {note ? <Text numberOfLines={1} style={[styles.note, { color: noteTint ?? colors.textSecondary }]}>{note}</Text> : null}
                </View>
            </VoidCard>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touch: { flex: 1 },
    card: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 56 },
    readout: { flex: 1, minWidth: 0 },
    value: { fontSize: 22, lineHeight: 26, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    note: { fontSize: 11, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
});
