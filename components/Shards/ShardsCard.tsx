import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { CountUp } from '@/components/ui/Motion';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { burstShards, recentRewardAction, onOrbLanded, registerShardsTarget } from '@/lib/marksOrbs';
import type { GoalPoint } from '@/lib/goalInsights';
import { sampleRange } from '@/lib/shards';
import type { Wallet } from '@/hooks/useWallet';
import { Control, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';

/**
 * Your wallet on Home, beside your picture: the Shards balance with its gem
 * at its foot, and the week's line in green or red, like a stock in a watchlist. Shards you
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
        if (before !== null && recentRewardAction() && wallet.earned > before) burstShards(wallet.earned - before);
    }, [wallet.earned]);

    // The past week, drawn the way the wallet draws it.
    const week = useMemo<GoalPoint[]>(
        () => sampleRange(wallet.timeline, '1W').map(point => ({ date: new Date(point.t).toISOString(), actual: point.value, pace: point.value, value: point.value })),
        [wallet.timeline],
    );
    const up = week.length > 1 ? week[week.length - 1].actual >= week[0].actual : true;

    return (
        // Beside your picture on Home, with no card of its own: the balance and its gem, today's
        // change, and the week's line filling the rest, like a holding in a portfolio app.
        <Pressable onPress={() => { lightFeedback(); onPress(); }} accessibilityRole="button" style={styles.wrap}
            accessibilityLabel={`Wallet: ${wallet.balance} Shards. ${wallet.today ? `${wallet.today > 0 ? 'Up' : 'Down'} ${Math.abs(wallet.today)} today.` : ''} Open your wallet.`}>
            {/* The balance alone, its gem tucked at the foot of the last digit. */}
            <View style={styles.balance}>
                <Animated.View ref={balanceRef} collapsable={false} style={bumpStyle}>
                    <CountUp style={[t.type.screenTitle, { color: t.color.textPrimary }]} value={wallet.balance.toLocaleString()} />
                </Animated.View>
                <ShardIcon size={Spacing.lg} />
            </View>
            {week.length > 1 ? (
                <View style={styles.spark} pointerEvents="none">
                    <GoalProgressChart series={week} color={up ? t.color.success : t.color.danger} compact unbounded pace={false} height={Control.height} label="Shards this week" />
                </View>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    balance: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs / 2 },
    spark: { flex: 1, height: Control.height },
});
