import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useFreezes } from '@/hooks/useCheckIns';

const ICE = '#64D2FF';

/**
 * Your streak freezes, on your own profile only (friends never see it), as
 * one quiet line under the card. Each, sent by a friend, covers a day you miss.
 */
export function FreezeCard() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { count } = useFreezes();
    return (
        <View style={styles.row} accessible accessibilityLabel={`${count} streak ${count === 1 ? 'freeze' : 'freezes'}. Each covers a day you miss. Only you see this.`}>
            <AppIcon name="snow" size={14} color={count ? ICE : colors.textTertiary} />
            <CountUp style={[styles.count, { color: count ? colors.textPrimary : colors.textTertiary }]} value={count} />
            <Text style={[styles.text, { color: colors.textTertiary }]}>{count === 1 ? 'streak freeze · covers a missed day' : 'streak freezes · each covers a missed day'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginTop: Spacing.lg, marginHorizontal: Spacing.xl },
    count: { fontFamily: FontFamily.semibold, fontSize: 13, fontVariant: ['tabular-nums'] },
    text: { fontFamily: FontFamily.regular, fontSize: 13 },
});
