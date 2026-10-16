import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { router } from 'expo-router';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconTile } from '@/components/ui/IconTile';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp, useProgress } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSleep } from '@/hooks/useSleep';
import { formatSleep } from '@/lib/sleepLog';
import { MARKS } from '@/lib/marks';
import { localDateKey } from '@/lib/habitSchedule';

const BAR_HEIGHT = 56;
const NIGHTS = 7;

/**
 * Last night's sleep, from Apple Health, and the week behind it. A night that
 * reaches your goal earns 5 Marks; a recorded night short of it costs 5. The goal is set
 * in Settings. Without Health connected, it offers the way to connect it.
 */
export function SleepCard() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const sleep = useSleep();

    if (!sleep.connected) {
        return (
            <Pressable onPress={() => { lightFeedback(); router.push('/(root)/integrations'); }} accessibilityRole="button"
                accessibilityLabel="Connect Apple Health to count your sleep">
                <VoidCard style={styles.connect}>
                    <IconTile icon="moon" color={primary} size={36} />
                    <View style={styles.flex}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Sleep</Text>
                        <Text style={[styles.sub, { color: colors.textTertiary }]}>Connect Apple Health and good nights earn Marks</Text>
                    </View>
                    <AppIcon name="chevron-forward" size={16} color={colors.textTertiary} />
                </VoidCard>
            </Pressable>
        );
    }

    const today = new Date();
    const mornings = Array.from({ length: NIGHTS }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (NIGHTS - 1 - index));
        return { key: localDateKey(date), label: date.toLocaleDateString(undefined, { weekday: 'narrow' }) };
    });
    const last = sleep.nights[mornings[NIGHTS - 1].key];
    const met = last !== undefined && last >= sleep.target;
    const ceiling = Math.max(sleep.target * 1.25, ...mornings.map(day => sleep.nights[day.key] ?? 0));

    return (
        <VoidCard style={styles.card}>
            <View style={styles.head}>
                <IconTile icon="moon" color={primary} size={32} />
                <Text style={[styles.title, styles.flex, { color: colors.textPrimary }]}>Sleep</Text>
                {last !== undefined ? (
                    // What last night did to your Marks: +5 at your goal, −5 short of it.
                    <View style={[styles.earned, { backgroundColor: (met ? colors.success : colors.error) + '22' }]}>{/* ui-allow: tint */}
                        <AppIcon name={met ? 'sparkles' : 'trending-down'} size={12} color={met ? colors.success : colors.error} />
                        <Text style={[styles.earnedText, { color: met ? colors.success : colors.error }]}>
                            {met ? `+${MARKS.complete.sleep}` : `${MARKS.miss.sleep}`} Marks
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.body}>
                <View style={styles.flex}>
                    <CountUp style={[styles.value, { color: colors.textPrimary }]} value={last !== undefined ? formatSleep(last) : '—'} />
                    <Text style={[styles.sub, { color: colors.textTertiary }]}>{last !== undefined ? 'Last night' : 'No sleep recorded last night'}</Text>
                    {/* The goal is set in Settings. */}
                    <Text style={[styles.goalText, { color: colors.textSecondary }]}>Goal {formatSleep(sleep.target)}</Text>
                </View>
                <View style={styles.bars} accessible accessibilityLabel={`Last ${NIGHTS} nights`}>
                    {mornings.map((day, index) => {
                        const minutes = sleep.nights[day.key];
                        return (
                            <View key={day.key} style={styles.barCol}>
                                <Bar share={minutes ? minutes / ceiling : 0} index={index}
                                    color={minutes === undefined ? colors.surfaceTertiary : minutes >= sleep.target ? colors.success : primary} />
                                <Text style={[styles.barLabel, { color: colors.textTertiary }]}>{day.label}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </VoidCard>
    );
}

function Bar({ share, index, color }: { share: number; index: number; color: string }) {
    const grown = useProgress(Math.max(0.06, Math.min(1, share)), index * 40);
    const style = useAnimatedStyle(() => ({ height: grown.get() * BAR_HEIGHT }));
    return (
        <View style={styles.barTrack}>
            <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    connect: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2 },
    title: { fontFamily: FontFamily.semibold, fontSize: 16 },
    sub: { fontFamily: FontFamily.regular, fontSize: 12 },
    earned: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: 999 },
    earnedText: { fontFamily: FontFamily.semibold, fontSize: 12 },
    body: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.lg },
    value: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
    goalText: { fontFamily: FontFamily.medium, fontSize: 13, fontVariant: ['tabular-nums'], marginTop: Spacing.sm },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs + 2 },
    barCol: { alignItems: 'center', gap: Spacing.xs },
    barTrack: { width: 10, height: BAR_HEIGHT, justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 5 },
    barLabel: { fontFamily: FontFamily.regular, fontSize: 10 },
});
