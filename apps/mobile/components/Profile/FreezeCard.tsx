import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { IconTile } from '@/components/ui/IconTile';
import { CountUp } from '@/components/ui/Motion';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useFreezes } from '@/hooks/useCheckIns';

const ICE = '#64D2FF';
/** The most anyone holds (the server's rule). */
const MOST = 5;

/**
 * Your streak freezes, on your own profile only (friends never see it).
 * Each covers a day you miss, spent on its own the morning after. How you get
 * them is said plainly: every 7 days in a row earns one, and friends can send
 * one. Five slots, filled as many as you hold.
 */
export function FreezeCard() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { count, days } = useFreezes();
    return (
        <VoidCard style={styles.card}>
            <View style={styles.row} accessible
                accessibilityLabel={`${count} of ${MOST} streak freezes. Each covers a day you miss. Earn one every 7 days in a row, or a friend can send you one.${days.length ? ` ${days.length} ${days.length === 1 ? 'day' : 'days'} covered so far.` : ''}`}>
                <IconTile icon="snow" color={ICE} size={36} muted={!count} />
                <View style={styles.text}>
                    <View style={styles.titleRow}>
                        <CountUp style={[styles.count, { color: colors.textPrimary }]} value={count} />
                        <Text style={[styles.title, { color: colors.textPrimary }]}>{count === 1 ? 'Streak freeze' : 'Streak freezes'}</Text>
                    </View>
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>
                        Covers a day you miss. Earn one every 7 days in a row, or get one from a friend.
                    </Text>
                </View>
            </View>
            <View style={styles.slots}>
                {Array.from({ length: MOST }, (_, index) => (
                    <View key={index} style={[styles.slot, { backgroundColor: index < count ? ICE : colors.border }]}>
                        {index < count ? <AppIcon name="snow" size={10} color={Colors.common.black} /> : null}
                    </View>
                ))}
                {days.length ? (
                    <Text style={[styles.covered, { color: colors.textTertiary }]}>{`${days.length} ${days.length === 1 ? 'day' : 'days'} saved`}</Text>
                ) : null}
            </View>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { marginHorizontal: Spacing.xl, marginTop: Spacing.md, padding: Spacing.lg, gap: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    text: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs + 2 },
    count: { fontFamily: FontFamily.bold, fontSize: 17, fontVariant: ['tabular-nums'] },
    title: { fontFamily: FontFamily.semibold, fontSize: 15 },
    sub: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
    slots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
    slot: { flex: 1, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    covered: { fontFamily: FontFamily.medium, fontSize: 12, marginLeft: Spacing.xs },
});
