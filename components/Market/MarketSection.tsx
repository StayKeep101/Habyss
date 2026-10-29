import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Avatar, ChoicePill, IconTile, ListItem, SectionTitle, Text, VoidCard, VoidSheet } from '@/components/ui';
import { AnimatedFill } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { MAX_STAKE, STAKES, marketFeed, myWallet, payoutFor, placeStake, resultFor, type Market, type Side } from '@/lib/market';
import { Control, Radius, Spacing } from '@/theme/designSystem';

const dueLabel = (deadline: string) =>
    `by ${new Date(`${deadline}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;

/**
 * The market, on Community: your goals and your friends' that are open to
 * bets, each with both sides' Shards, and the bet sheet. Shown only once
 * there is something on it; a goal is opened to bets from its own page.
 */
export function MarketSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [betting, setBetting] = useState<{ market: Market; side: Side } | null>(null);
    const load = useCallback(() => { marketFeed().then(setMarkets).catch(() => undefined); }, []);
    useFocusEffect(load);
    useEffect(() => {
        const sub = on('market_changed', load);
        return () => sub.remove();
    }, [load]);

    if (!markets.length) return null;
    return (
        <View style={style}>
            <SectionTitle first>Bets</SectionTitle>
            <View style={styles.list}>
                {markets.map(market => (
                    <ListItem key={market.id}>
                        <MarketCard market={market} onBet={side => setBetting({ market, side })} />
                    </ListItem>
                ))}
            </View>
            {betting ? <StakeSheet market={betting.market} side={betting.side} onClose={() => setBetting(null)} /> : null}
        </View>
    );
}

/** One goal on the market: who, what, by when, both sides' Shards, and the two ways to bet. */
function MarketCard({ market, onBet }: { market: Market; onBet: (side: Side) => void }) {
    const t = useTokens();
    const color = market.color ?? t.color.accent;
    const total = market.pool.make + market.pool.miss;
    const share = total ? market.pool.make / total : 0.5;
    const open = market.status === 'open';
    const result = resultFor(market);
    const stake = market.myStake;
    return (
        <VoidCard style={styles.card}>
            <View style={styles.head}>
                <Avatar name={market.name} uri={market.avatarUrl} size={Control.hitTarget - Spacing.sm} />
                <View style={styles.headText}>
                    <Text variant="heading" numberOfLines={2}>{market.title}</Text>
                    <Text variant="caption" tone="muted">{`${market.mine ? 'You' : market.name} · ${open ? dueLabel(market.deadline) : market.status === 'won' ? 'Made it' : market.status === 'missed' ? 'Missed it' : 'Called off'}`}</Text>
                </View>
                {market.icon ? <IconTile icon={market.icon} color={color} size={Control.hitTarget - Spacing.sm} /> : null}
            </View>

            {/* Both sides, as one bar: backing on the left, doubting on the right. */}
            <View style={[styles.track, { backgroundColor: t.tint('subtle', t.color.danger) }]}
                accessible accessibilityLabel={`${market.pool.make} Shards say they make it, ${market.pool.miss} say they miss it`}>
                <AnimatedFill progress={share} style={[styles.fill, { backgroundColor: t.color.success }]} />
            </View>
            <View style={styles.sides}>
                <Text variant="caption" tone="success" numeric>{`◆ ${market.pool.make} makes it · ${market.people.make}`}</Text>
                <Text variant="caption" tone="danger" numeric>{`${market.people.miss} · misses it ◆ ${market.pool.miss}`}</Text>
            </View>

            {stake ? (
                <Text variant="bodySmall" tone={result === null ? 'muted' : result > 0 ? 'success' : result < 0 ? 'danger' : 'muted'}>
                    {result === null
                        ? `You: ◆ ${stake.amount} on ${stake.side === 'make' ? 'makes it' : 'misses it'}`
                        : result > 0 ? `You won ◆ ${result}` : result < 0 ? `You lost ◆ ${-result}` : 'Your Shards are back'}
                </Text>
            ) : null}

            {open && (!stake || stake.amount < MAX_STAKE) ? (
                market.mine ? (
                    <AppButton label={stake ? 'Back yourself more' : 'Back yourself'} icon="trending-up" onPress={() => onBet('make')} />
                ) : (
                    <View style={styles.buttons}>
                        {!stake || stake.side === 'make' ? <View style={styles.button}><AppButton label="Makes it" icon="trending-up" onPress={() => onBet('make')} /></View> : null}
                        {!stake || stake.side === 'miss' ? <View style={styles.button}><AppButton label="Misses it" icon="trending-down" onPress={() => onBet('miss')} /></View> : null}
                    </View>
                )
            ) : null}
        </VoidCard>
    );
}

/** How many Shards on which side: the amounts, what it would pay, and the bet. */
function StakeSheet({ market, side, onClose }: { market: Market; side: Side; onClose: () => void }) {
    const t = useTokens();
    const { successFeedback, selectionFeedback } = useHaptics();
    const already = market.myStake?.amount ?? 0;
    const room = MAX_STAKE - already;
    const [amount, setAmount] = useState<number>(Math.min(STAKES[0], room));
    const [spendable, setSpendable] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { myWallet().then(wallet => setSpendable(wallet.spendable)).catch(() => undefined); }, []);

    const back = payoutFor(amount, side, market.pool, already);
    const who = market.mine ? 'you' : market.name;
    const place = async () => {
        setBusy(true);
        setError(null);
        try {
            await placeStake(market.id, side, amount);
            successFeedback();
            onClose();
        } catch (failed) {
            setError(failed instanceof Error ? failed.message : 'That bet didn’t go through.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <VoidSheet visible onClose={onClose} title={side === 'make' ? 'Makes it' : 'Misses it'} caption={market.title}
            footer={<AppButton label={busy ? 'Placing…' : `Bet ◆ ${amount}`} icon="diamond" loading={busy} disabled={amount <= 0 || (spendable !== null && spendable < amount)} onPress={place} />}>
            <View style={styles.sheet}>
                <Text variant="body" tone="muted">{spendable === null ? ' ' : `You have ◆ ${spendable.toLocaleString()} Shards to spend.`}</Text>
                <View style={styles.amounts}>
                    {STAKES.filter(value => value <= room).map(value => (
                        <ChoicePill key={value} label={`◆ ${value}`} on={amount === value} color={t.color.accent}
                            disabled={spendable !== null && spendable < value}
                            onPress={() => { selectionFeedback(); setAmount(value); }} />
                    ))}
                </View>
                <VoidCard style={styles.preview}>
                    <Text variant="caption" tone="muted">{`If ${who} ${side === 'make' ? 'make' + (market.mine ? '' : 's') + ' it' : 'miss' + (market.mine ? '' : 'es') + ' it'}`}</Text>
                    <Text variant="title" tone="success" numeric>{`◆ ${back} back`}</Text>
                    <Text variant="caption" tone="muted">{market.pool[side === 'make' ? 'miss' : 'make'] ? 'Your share of the other side, as the bets stand now.' : 'Nobody’s on the other side yet. If it stays that way, you get your Shards back.'}</Text>
                </VoidCard>
                {error ? <Text variant="bodySmall" tone="danger">{error}</Text> : null}
                <Text variant="caption" tone="muted">{`Up to ◆ ${MAX_STAKE} per goal. Shards can’t be bought or cashed out.`}</Text>
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    list: { gap: Spacing.sm },
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headText: { flex: 1 },
    track: { height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
    sides: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -Spacing.xs },
    buttons: { flexDirection: 'row', gap: Spacing.sm },
    button: { flex: 1 },
    sheet: { gap: Spacing.lg },
    amounts: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    preview: { padding: Spacing.lg, gap: Spacing.xs },
});
