import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { AppIcon, Text, VoidCard } from '@/components/ui';
import { CountUp } from '@/components/ui/Motion';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { burstShards, onOrbLanded, registerShardsTarget } from '@/lib/marksOrbs';
import type { GoalPoint } from '@/lib/goalInsights';
import { sampleRange } from '@/lib/shards';
import type { Wallet } from '@/hooks/useWallet';
import { Control, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';

/**
 * Your wallet on Home: the Shards balance with its gem, today's change, and
 * the week's line in green or red, like a stock in a watchlist. Shards you
 * earn fly here as gems (lib/marksOrbs.ts), counted from what the balance
 * really gained, so the animation never shows Shards that did not count.
 */
export function ShardsCard({ wallet, onPress }: { wallet: Wallet; onPress: () => void }) {
    const t = useTokens();
    const { lightFeedback } = useHaptics();

    // Where the gems land while Home is in front; each one bumps the balance.
    const balanceRef = useRef<View>(null);
    useFocusEffect(useCallback(() => registerShardsTarget('shards-card', done => {
        const node = balanceRef.current;
        if (!node) { done(null); return; }
        node.measureInWindow((x, y, width, height) => done(width ? { x: x + width / 2, y: y + height / 2 } : null));
    }), []));
    const bump = useSharedValue(1);
    useEffect(() => onOrbLanded(() => {
        bump.set(withSequence(withTiming(1.08, { duration: DURATION.tap / 2 }), withTiming(1, { duration: DURATION.tap })));
    }, 'shards'), [bump]);
    const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

    // What doing just earned, sent as gems: never on first read, never for a bet's movement.
    const seen = useRef<number | null>(null);
    useEffect(() => {
        const before = seen.current;
        seen.current = wallet.earned;
        if (before !== null && wallet.earned > before) burstShards(wallet.earned - before);
    }, [wallet.earned]);

    // The past week, drawn the way the wallet draws it.
    const month = useMemo<GoalPoint[]>(
        () => sampleRange(wallet.timeline, '1W').map(point => ({ date: new Date(point.t).toISOString(), actual: point.value, pace: point.value, value: point.value })),
        [wallet.timeline],
    );
    const up = month.length > 1 ? month[month.length - 1].actual >= month[0].actual : true;

    return (
        <Pressable onPress={() => { lightFeedback(); onPress(); }} accessibilityRole="button"
            accessibilityLabel={`Wallet: ${wallet.balance} Shards. ${wallet.today ? `Up ${wallet.today} today.` : ''} Open your wallet.`}>
            <VoidCard style={styles.card}>
                <View style={[styles.gem, { backgroundColor: t.tint('subtle') }]}>
                    <AppIcon name="diamond" filled size={Control.icon} color={t.color.accent} />
                </View>
                <View style={styles.text}>
                    <Text variant="caption" tone="muted">Wallet</Text>
                    <View style={styles.balance}>
                        <Animated.View ref={balanceRef} collapsable={false} style={bumpStyle}>
                            <CountUp style={[t.type.title, { color: t.color.textPrimary }]} value={wallet.balance.toLocaleString()} />
                        </Animated.View>
                        <Text variant="bodySmall" tone="muted">Shards</Text>
                        {wallet.today ? <Text variant="caption" tone="success" numeric>{`+${wallet.today} today`}</Text> : null}
                    </View>
                </View>
                {month.length > 1 ? (
                    <View style={styles.spark} pointerEvents="none">
                        <GoalProgressChart series={month} color={up ? t.color.success : t.color.danger} compact unbounded pace={false} height={Control.hitTarget} label="Shards this week" />
                    </View>
                ) : null}
                <AppIcon name="chevron-forward" size={Spacing.lg} color={t.color.textSubtle} />
            </VoidCard>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    gem: { width: Control.hitTarget, height: Control.hitTarget, borderRadius: Control.hitTarget / 2, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1 },
    balance: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    spark: { width: Control.hitTarget * 2, height: Control.hitTarget },
});
