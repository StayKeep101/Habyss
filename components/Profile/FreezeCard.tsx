import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useFreezes } from '@/hooks/useCheckIns';

const ICE = '#64D2FF';

/**
 * Your streak freezes, on your own profile only: friends never see it. Each
 * one, sent by a friend, covers a day you miss so your streak survives it.
 */
export function FreezeCard() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { count } = useFreezes();
    return (
        <VoidCard style={styles.card}>
            <AppIcon name="snow" filled size={26} color={ICE} />
            <View style={styles.text}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Streak freezes</Text>
                <Text style={[styles.sub, { color: colors.textTertiary }]}>Only you see this. One covers a day you miss.</Text>
            </View>
            <CountUp style={[styles.count, { color: count ? ICE : colors.textTertiary }]} value={count} />
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, marginHorizontal: Spacing.xl, marginTop: Spacing.lg },
    text: { flex: 1, gap: 2 },
    title: { fontFamily: FontFamily.semibold, fontSize: 15 },
    sub: { fontFamily: FontFamily.regular, fontSize: 12 },
    count: { fontFamily: FontFamily.bold, fontSize: 26, fontVariant: ['tabular-nums'] },
});
