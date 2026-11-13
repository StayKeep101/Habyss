import React, { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { HomeStatCard, STAT_FIGURE } from '@/components/Home/HomeStatCard';
import { useHaptics } from '@/hooks/useHaptics';
import { onOrbLanded, registerShardsTarget } from '@/lib/marksOrbs';
import type { Wallet } from '@/hooks/useWallet';
import { DURATION } from '@/theme/motion';

/**
 * Your wallet on Home: the first of the four stats beside your picture, the
 * Shard as big as its figure, then the balance. Tap for the wallet and its
 * line. Shards you earn fly here (lib/marksOrbs.ts), counted from what the
 * balance really gained, so the animation never shows Shards that did not count.
 */
export function ShardsCard({ wallet, onPress }: { wallet: Wallet; onPress: () => void }) {
    const { lightFeedback } = useHaptics();

    // Where the Shards land while Home is in front; each one bumps the Shard.
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

    // What doing earns flies here as Shards from the tick itself (lib/marksOrbs.ts burstMarks).

    return (
        <HomeStatCard
            glyph={<Animated.View style={bumpStyle}><ShardIcon size={STAT_FIGURE} /></Animated.View>}
            value={wallet.balance.toLocaleString()}
            valueRef={balanceRef}
            onPress={() => { lightFeedback(); onPress(); }}
            accessibilityLabel={`Wallet: ${wallet.balance} Shards. ${wallet.today ? `${wallet.today > 0 ? 'Up' : 'Down'} ${Math.abs(wallet.today)} today.` : ''} Open your wallet.`}
        />
    );
}
