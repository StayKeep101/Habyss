import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

/**
 * One of the small cards beside the streak: an icon, a big figure, what it
 * is in two words, and one line saying what it means right now.
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
                {/* Just the icon, in its colour: no tile behind it. */}
                <AppIcon filled name={icon as never} size={24} color={tint} />
                <View style={styles.readout}>
                    <CountUp style={[styles.value, { color: colors.textPrimary }]} value={value} />
                    <Text numberOfLines={1} style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
                </View>
                {note ? <Text numberOfLines={1} style={[styles.note, { color: noteTint ?? colors.textSecondary }]}>{note}</Text> : null}
            </VoidCard>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touch: { flex: 1 },
    card: { flex: 1, padding: Spacing.sm + 2, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs + 2, minHeight: 100 },
    readout: { alignItems: 'center' },
    value: { fontSize: 22, lineHeight: 26, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    label: { fontSize: 11, fontFamily: FontFamily.medium },
    note: { fontSize: 11, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
});
