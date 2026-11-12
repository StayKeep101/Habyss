import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { Alert, Pressable, Text as RNText, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
    AppButton, AppIcon, Avatar, CardRail, CountUp, GameCard, HoldButton, IconButton, Receipt, IconTile, ListItem, MatteSurface, SectionTitle, SettingsGroup, SettingsRow, SheetSection, StepSlider, Text, VersusBar, VoidSheet,
    type BadgeProps,
} from '@/components/ui';
import { textOn } from '@/theme/tokens';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { on } from '@/lib/appEvents';
import { addDays } from '@/lib/goalInsights';
import { MAX_STAKE, STAKES, marketFeed, myWallet, openMarket, payoutFor, placeStake, resultFor, type Market, type Side } from '@/lib/market';
import type { Habit } from '@/lib/habitsSQLite';
import { Control, Radius, Spacing } from '@/theme/designSystem';

const dueLabel = (deadline: string) =>
    `by ${new Date(`${deadline}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;

/**
 * The market, on Community: goals open to bets, swiped side by side like a
 * trading app's markets. Each card is a face, a goal, a pill for how the crowd
 * leans, and both sides as one bar. Tap one to bet. Empty, one card that
 * opens your first.
 */
export function MarketSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const [markets, setMarkets] = useState<Market[] | null>(null);
    const [spendable, setSpendable] = useState<number | null>(null);
    const [betting, setBetting] = useState<Market | null>(null);
    const [opening, setOpening] = useState(false);
    const load = useCallback(() => {
        marketFeed().then(setMarkets).catch(() => setMarkets([]));
        myWallet().then(wallet => setSpendable(wallet.spendable)).catch(() => undefined);
    }, []);
    useFocusEffect(load);
    useEffect(() => {
        const sub = on('market_changed', load);
        return () => sub.remove();
    }, [load]);

    const openKeys = useMemo(() => new Set((markets ?? []).filter(market => market.mine && market.status === 'open').map(market => market.goalKey)), [markets]);
    const live = (markets ?? []).filter(market => market.status === 'open');
    const done = (markets ?? []).filter(market => market.status !== 'open');

    return (
        <View style={[styles.section, style]}>
            <SectionTitle right={<IconButton icon="add" label="Open a goal to bets" onPress={() => setOpening(true)} />}>Bets</SectionTitle>
            {live.length ? (
                <CardRail>{live.map(market => <MarketCard key={market.id} market={market} onBet={() => setBetting(market)} />)}</CardRail>
            ) : markets ? (
                <GameCard onPress={() => setOpening(true)} title="Open a goal to bets" subtitle="Friends bet Shards on you"
                    lead={<IconTile icon="trending-up" color={t.color.cobalt} size={Control.hitTarget} />}
                    badge={{ label: 'Back yourself', tone: 'cobalt' }} />
            ) : null}
            {done.map(market => <ListItem key={market.id}><MarketCard market={market} onBet={() => undefined} /></ListItem>)}

            {betting ? <StakeSheet market={betting} spendable={spendable} onClose={() => setBetting(null)} /> : null}
            <OpenSheet visible={opening} openKeys={openKeys} onClose={() => setOpening(false)} />
        </View>
    );
}

/** How the crowd leans, said as a pill: the market's mood in one word. */
function moodOf(market: Market): BadgeProps {
    if (market.status === 'won') return { label: 'Made it', tone: 'cobalt', icon: 'checkmark' };
    if (market.status === 'missed') return { label: 'Missed', tone: 'silver', icon: 'close' };
    if (market.status === 'void') return { label: 'Called off', tone: 'neutral' };
    const total = market.pool.make + market.pool.miss;
    if (!total) return { label: 'New', tone: 'cobalt', icon: 'sparkles' };
    const share = market.pool.make / total;
    if (share >= 0.75) return { label: 'Very likely', tone: 'cobalt', icon: 'trending-up' };
    if (share >= 0.55) return { label: 'Likely', tone: 'cobalt', icon: 'trending-up' };
    if (share > 0.45) return { label: 'Split', tone: 'neutral', icon: 'swap-horizontal' };
    if (share > 0.25) return { label: 'Doubted', tone: 'silver', icon: 'trending-down' };
    return { label: 'Very doubted', tone: 'silver', icon: 'trending-down' };
}

/** One goal on the market: who, what, by when, how the crowd leans, both sides as one bar. Tap to bet. */
function MarketCard({ market, onBet }: { market: Market; onBet: () => void }) {
    const t = useTokens();
    const total = market.pool.make + market.pool.miss;
    const make = total ? (market.pool.make / total) * 100 : 50;
    const open = market.status === 'open';
    const result = resultFor(market);
    const stake = market.myStake;
    const canBet = open && (!stake || stake.amount < MAX_STAKE);
    return (
        <GameCard
            onPress={canBet ? onBet : undefined}
            accessibilityHint={`Opens the bet. ${Math.round(make)}% say makes it`}
            lead={<Avatar name={market.name} uri={market.avatarUrl} size={Control.hitTarget} />}
            title={market.title}
            subtitle={`${market.mine ? 'You' : market.name.split(' ')[0]} · ${dueLabel(market.deadline)}`}
            badge={moodOf(market)}
            footer={stake ? (
                <View style={styles.stake}>
                    <ShardIcon size={Spacing.md} />
                    <Text variant="bodySmall" tone="muted" grow numberOfLines={1}>{`${stake.amount} on ${stake.side === 'make' ? 'makes it' : 'misses it'}`}</Text>
                    {result !== null ? (
                        <Text variant="heading" numeric tone={result > 0 ? 'success' : result < 0 ? 'danger' : 'muted'}>{result > 0 ? `+${result}` : result < 0 ? `−${-result}` : '±0'}</Text>
                    ) : null}
                </View>
            ) : null}>
            <VersusBar left={{ label: 'Makes it', percent: make, color: t.color.cobalt }}
                right={{ label: 'Misses', percent: 100 - make, color: t.color.silver }} />
        </GameCard>
    );
}

/**
 * The bet: pick a side (each says how the crowd leans), slide how many Shards,
 * and watch what it would win grow as you slide.
 */
function StakeSheet({ market, spendable, onClose }: { market: Market; spendable: number | null; onClose: () => void }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const already = market.myStake?.amount ?? 0;
    const room = MAX_STAKE - already;
    const cap = spendable === null ? room : Math.min(room, spendable);
    // Your own goal is only ever backed; a side you are already on is kept.
    const locked: Side | null = market.mine ? 'make' : market.myStake?.side ?? null;
    const [side, setSide] = useState<Side>(locked ?? 'make');
    const steps = useMemo(() => {
        const fits = STAKES.filter(value => value <= cap) as number[];
        return fits.length ? fits : cap > 0 ? [cap] : [0];
    }, [cap]);
    const [amount, setAmount] = useState<number>(steps[Math.min(1, steps.length - 1)]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Placed: the sheet becomes the receipt, then closes.
    const [paid, setPaid] = useState(false);

    const total = market.pool.make + market.pool.miss;
    const back = payoutFor(amount, side, market.pool, already);
    const gain = Math.max(0, back - already - amount);
    const place = async () => {
        setBusy(true);
        setError(null);
        try {
            await placeStake(market.id, side, amount);
            setPaid(true);
        } catch (failed) {
            setError(failed instanceof Error ? failed.message : 'That bet didn’t go through.');
        } finally {
            setBusy(false);
        }
    };
    const sideButton = (value: Side) => {
        const on = side === value;
        const color = value === 'make' ? t.color.cobalt : t.color.silver;
        const share = total ? Math.round((market.pool[value] / total) * 100) : 50;
        return (
            <Pressable key={value} style={styles.grow} accessibilityRole="radio" accessibilityState={{ selected: on }}
                accessibilityLabel={`${value === 'make' ? 'Makes it' : 'Misses it'}, ${share}%`}
                onPress={() => { selectionFeedback(); setSide(value); }}>
                <MatteSurface radius={Radius.control} level="control"
                    style={[styles.side, on && { backgroundColor: color }]}>
                    <AppIcon name={value === 'make' ? 'trending-up' : 'trending-down'} size={Control.icon} color={on ? textOn(color) : color} />
                    {/* On a solid fill, the colour that reads on it (theme/tokens textOn). */}
                    <RNText style={[t.type.heading, { color: on ? textOn(color) : t.color.textPrimary }]}>{value === 'make' ? 'Makes it' : 'Misses it'}</RNText>
                    <RNText style={[t.type.bodySmall, styles.numeric, { color: on ? textOn(color) : t.color.textMuted }]}>{`${share}%`}</RNText>
                </MatteSurface>
            </Pressable>
        );
    };

    return (
        <VoidSheet visible onClose={onClose} title={market.title} caption={market.mine ? 'Back yourself' : `${market.name.split(' ')[0]}’s goal · ${dueLabel(market.deadline)}`}
            footer={paid ? undefined : (
                <View style={styles.footer}>
                    {/* Held, like paying: the fill builds, the buzz builds, it lands. */}
                    {amount > 0 ? <HoldButton label={`Hold to bet ${amount} Shards`} icon="shard" loading={busy} onComplete={() => void place()} />
                        : <AppButton label="Not enough Shards" disabled onPress={() => undefined} />}
                </View>
            )}>
            {paid ? (
                <Receipt title="Bet placed" amount={-amount}
                    line={`On ${side === 'make' ? 'makes it' : 'misses it'}${gain ? ` · wins ${gain} if you’re right` : ''}`} onDone={onClose} />
            ) : (
            <View style={styles.body}>
                {locked ? null : <View style={styles.sides}>{(['make', 'miss'] as const).map(sideButton)}</View>}
                {steps.length > 1 ? (
                    <StepSlider label="How much" values={steps} value={amount} onChange={setAmount} say={value => `${value} Shards`} />
                ) : null}
                {/* What it would win, growing as the slider moves. */}
                <View style={styles.win} accessible accessibilityLabel={total && market.pool[side === 'make' ? 'miss' : 'make'] ? `Wins ${gain} Shards` : 'Nobody on the other side yet. You get your Shards back.'}>
                    <Text variant="caption" tone="muted">{market.pool[side === 'make' ? 'miss' : 'make'] ? 'If you’re right' : 'Nobody on the other side yet'}</Text>
                    <View style={styles.winRow}>
                        <CountUp value={`+${gain}`} style={[t.type.display, { color: gain ? t.color.cobalt : t.color.textMuted }]} />
                        <ShardIcon size={Control.icon} />
                    </View>
                </View>
                {error ? <Text variant="bodySmall" tone="danger" align="center">{error}</Text> : null}
            </View>
            )}
        </VoidSheet>
    );
}

/** Your goals, to open one to bets: the ones that can be (a deadline three or more days away), and why the rest can't. */
export function OpenSheet({ visible, openKeys, onClose }: { visible: boolean; openKeys: Set<string>; onClose: () => void }) {
    const { goals, today } = useGoalsInsights();
    const { successFeedback } = useHaptics();
    const earliest = addDays(today, 3);
    const deadlineOf = (goal: Habit) => goal.targetDate?.slice(0, 10);
    const ready = goals.filter(goal => !openKeys.has(goal.id) && (deadlineOf(goal) ?? '') >= earliest);
    const notYet = goals.filter(goal => !openKeys.has(goal.id) && !((deadlineOf(goal) ?? '') >= earliest));

    const open = (goal: Habit) => {
        openMarket({ id: goal.id, name: goal.name, icon: goal.icon, color: goal.color, targetDate: deadlineOf(goal)! })
            .then(() => { successFeedback(); onClose(); })
            .catch((failed: unknown) => Alert.alert('Couldn’t open it', failed instanceof Error ? failed.message : 'Try again in a moment.'));
    };

    return (
        <VoidSheet visible={visible} onClose={onClose} title="Open to bets" caption="Friends bet Shards on whether you make it" scrollable>
            {ready.length ? (
                <SettingsGroup title="Your goals">
                    {ready.map(goal => (
                        <SettingsRow key={goal.id} icon={goal.icon || 'flag'} color={goal.color} label={goal.name} value={dueLabel(deadlineOf(goal)!)} onPress={() => open(goal)} />
                    ))}
                </SettingsGroup>
            ) : (
                <SheetSection first title="Nothing to open yet" description="A goal can be opened to bets once it has a deadline at least three days away. Set one from the goal’s page." />
            )}
            {notYet.length ? (
                <SettingsGroup title="Need a deadline 3+ days away">
                    {notYet.map(goal => (
                        <SettingsRow key={goal.id} icon={goal.icon || 'flag'} color={goal.color} label={goal.name} value={deadlineOf(goal) ? 'Too soon' : 'No deadline'} disabled />
                    ))}
                </SettingsGroup>
            ) : null}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    grow: { flex: 1 },
    numeric: { fontVariant: ['tabular-nums'] },
    stake: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sides: { flexDirection: 'row', gap: Spacing.sm },
    side: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
    win: { alignItems: 'center', gap: Spacing.xs },
    winRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    // A sheet that does not scroll pads its own content and footer, as every sheet in the app does.
    body: { gap: Spacing.xl, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
