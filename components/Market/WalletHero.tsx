import React, { useCallback, useEffect, useState } from 'react';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Badge, CountUp, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { on } from '@/lib/appEvents';
import { myWallet } from '@/lib/market';
import { Control, Spacing } from '@/theme/designSystem';

/**
 * The top of Bets: your Shards, large, the one bold thing on the page — the
 * way a wallet opens on its balance. What is riding on bets and duels sits
 * beside it as a pill. Counts up on arrival and rolls when a bet lands.
 */
export function WalletHero({ style, compact }: { style?: StyleProp<ViewStyle>; compact?: boolean }) {
    const t = useTokens();
    const [wallet, setWallet] = useState<{ spendable: number | null; inPlay: number } | null>(null);
    const load = useCallback(() => { myWallet().then(setWallet).catch(() => undefined); }, []);
    useFocusEffect(load);
    useEffect(() => {
        const sub = on('market_changed', load);
        return () => sub.remove();
    }, [load]);
    if (!wallet || wallet.spendable === null) return null;
    // In a heading (Challenges): the crystal and the balance, on the title's line.
    if (compact) return (
        <View style={[styles.compact, style]} accessible accessibilityLabel={`${wallet.spendable} Shards${wallet.inPlay ? `, ${wallet.inPlay} in play` : ''}`}>
            <ShardIcon size={Spacing.xl} />
            <CountUp value={wallet.spendable.toLocaleString()} style={[t.type.heading, styles.figure, { color: t.color.textPrimary }]} />
        </View>
    );
    return (
        <View style={[styles.hero, style]} accessible accessibilityLabel={`${wallet.spendable} Shards${wallet.inPlay ? `, ${wallet.inPlay} in play` : ''}`}>
            <Text variant="bodySmall" tone="muted">Shards</Text>
            <View style={styles.row}>
                <ShardIcon size={Control.hitTarget - Spacing.md} />
                <CountUp value={wallet.spendable.toLocaleString()} style={[t.type.display, styles.figure, { color: t.color.textPrimary }]} />
            </View>
            {wallet.inPlay ? <Badge label={`${wallet.inPlay.toLocaleString()} in play`} tone="cobalt" icon="flash" /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    figure: { fontVariant: ['tabular-nums'] },
    compact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
