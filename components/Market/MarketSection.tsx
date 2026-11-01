import { ExposedSection } from './ExposedSection';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
    AppButton, AppIcon, AppTextField, Avatar, ChoicePill, EmptyState, IconTile, ListItem, SectionTitle, SettingsGroup, SettingsRow, SheetSection, Text, VoidCard, VoidSheet,
} from '@/components/ui';
import { AnimatedFill } from '@/components/ui/Motion';
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
 * The market, on Community: your goals and your friends' open to bets, each
 * with both sides' Shards and a way to bet, what you have to spend beside the
 * title, and the way to open one of your own goals. Empty, it says how it
 * works instead of hiding.
 */
export function MarketSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const [markets, setMarkets] = useState<Market[] | null>(null);
    const [spendable, setSpendable] = useState<number | null>(null);
    const [betting, setBetting] = useState<{ market: Market; side: Side } | null>(null);
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

    return (
        <View style={style}>
            <SectionTitle first right={spendable !== null ? (
                <View style={styles.balance} accessible accessibilityLabel={`${spendable} Shards to spend`}>
                    <AppIcon name="diamond" filled size={Spacing.md} color={t.color.accent} />
                    <Text variant="heading" numeric>{spendable.toLocaleString()}</Text>
                </View>
            ) : undefined}>Bets</SectionTitle>

            {markets && markets.length ? (
                <View style={styles.list}>
                    {markets.map(market => (
                        <ListItem key={market.id}>
                            <MarketCard market={market} onBet={side => setBetting({ market, side })} />
                        </ListItem>
                    ))}
                    <AppButton label="Open a goal to bets" icon="add-circle" variant="ghost" onPress={() => setOpening(true)} />
                </View>
            ) : markets ? (
                <VoidCard>
                    <EmptyState icon="trending-up" title="No bets yet"
                        message="Open one of your goals to bets, and friends put Shards on whether you make it. Back yourself too."
                        actionLabel="Open a goal to bets" onAction={() => setOpening(true)} />
                </VoidCard>
            ) : null}

            <ExposedSection />
            {betting ? <StakeSheet market={betting.market} side={betting.side} spendable={spendable} onClose={() => setBetting(null)} /> : null}
            <OpenSheet visible={opening} openKeys={openKeys} onClose={() => setOpening(false)} />
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
                <View style={styles.grow}>
                    <Text variant="heading" numberOfLines={2}>{market.title}</Text>
                    <Text variant="caption" tone="muted">{`${market.mine ? 'You' : market.name} · ${open ? dueLabel(market.deadline) : market.status === 'won' ? 'Made it' : market.status === 'missed' ? 'Missed it' : 'Called off'}`}</Text>
                </View>
                {market.icon ? <IconTile icon={market.icon} color={color} size={Control.hitTarget - Spacing.sm} /> : null}
            </View>

            {/* Both sides, as one bar: backing on the left, doubting on the right. */}
            <View style={[styles.track, { backgroundColor: t.tint('subtle', t.color.danger) }]}
                accessible accessibilityLabel={`${market.pool.make} Shards on makes it, ${market.pool.miss} on misses it`}>
                <AnimatedFill progress={share} style={[styles.fill, { backgroundColor: t.color.success }]} />
            </View>
            <View style={styles.sides}>
                <Text variant="caption" tone="success" numeric>{`${market.pool.make} on makes it`}</Text>
                <Text variant="caption" tone="danger" numeric>{`${market.pool.miss} on misses it`}</Text>
            </View>

            {stake ? (
                <Text variant="bodySmall" tone={result === null ? 'muted' : result > 0 ? 'success' : result < 0 ? 'danger' : 'muted'}>
                    {result === null
                        ? `You put ${stake.amount} Shards on ${stake.side === 'make' ? 'makes it' : 'misses it'}`
                        : result > 0 ? `You won ${result} Shards` : result < 0 ? `You lost ${-result} Shards` : 'Your Shards are back'}
                </Text>
            ) : null}

            {open && (!stake || stake.amount < MAX_STAKE) ? (
                market.mine ? (
                    <AppButton label={stake ? 'Back yourself more' : 'Back yourself'} icon="trending-up" onPress={() => onBet('make')} />
                ) : (
                    <View style={styles.buttons}>
                        {!stake || stake.side === 'make' ? <View style={styles.grow}><AppButton label="Makes it" icon="trending-up" onPress={() => onBet('make')} /></View> : null}
                        {!stake || stake.side === 'miss' ? <View style={styles.grow}><AppButton label="Misses it" icon="trending-down" onPress={() => onBet('miss')} /></View> : null}
                    </View>
                )
            ) : null}
        </VoidCard>
    );
}

/** How many Shards on which side: the amounts, what it would pay, and the bet. */
function StakeSheet({ market, side, spendable, onClose }: { market: Market; side: Side; spendable: number | null; onClose: () => void }) {
    const t = useTokens();
    const { successFeedback, selectionFeedback } = useHaptics();
    const already = market.myStake?.amount ?? 0;
    const room = MAX_STAKE - already;
    const [amount, setAmount] = useState<number>(Math.min(STAKES[0], room));
    // Your own amount, typed: any whole number of Shards up to what is left of the 100 for this goal.
    const [typing, setTyping] = useState(false);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const typedAmount = Math.floor(Number(typed));
    const stake = typing ? (Number.isFinite(typedAmount) ? typedAmount : 0) : amount;
    const tooMuch = stake > room || (spendable !== null && stake > spendable);
    const back = payoutFor(Math.max(0, stake), side, market.pool, already);
    const who = market.mine ? 'you' : market.name;
    const verb = side === 'make' ? (market.mine ? 'make it' : 'makes it') : (market.mine ? 'miss it' : 'misses it');
    const otherSide = market.pool[side === 'make' ? 'miss' : 'make'];
    const place = async () => {
        setBusy(true);
        setError(null);
        try {
            await placeStake(market.id, side, stake);
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
            footer={
                <View style={styles.footer}>
                    <AppButton label={stake > 0 ? `Bet ${stake} Shards` : 'Bet'} icon="diamond" loading={busy} disabled={stake <= 0 || tooMuch} onPress={place} />
                </View>
            }>
            <View style={styles.body}>
                <SheetSection first title="How much" description={spendable === null ? `Up to ${MAX_STAKE} Shards per goal.` : `You have ${spendable.toLocaleString()} Shards. Up to ${MAX_STAKE} per goal.`}>
                    <View style={styles.amounts}>
                        {STAKES.filter(value => value <= room).map(value => (
                            <ChoicePill key={value} label={String(value)} icon="diamond" on={!typing && amount === value} color={t.color.accent}
                                disabled={spendable !== null && spendable < value} accessibilityLabel={`${value} Shards`}
                                onPress={() => { selectionFeedback(); setTyping(false); setAmount(value); }} />
                        ))}
                        <ChoicePill label="Other" icon="create" on={typing} color={t.color.accent} accessibilityLabel="Another amount"
                            onPress={() => { selectionFeedback(); setTyping(true); }} />
                    </View>
                    {typing ? (
                        <View style={styles.typed}>
                            <AppTextField label="Shards" value={typed} onChangeText={text => setTyped(text.replace(/[^0-9]/g, ''))}
                                placeholder={`1 to ${spendable === null ? room : Math.min(room, spendable)}`} keyboardType="number-pad" autoFocus maxLength={3}
                                error={tooMuch ? (stake > room ? `Up to ${room} more on this goal.` : 'You don’t have that many Shards.') : undefined} />
                        </View>
                    ) : null}
                </SheetSection>
                <SettingsGroup title="If it goes your way">
                    {/* Your stake back plus your share of the other side's: said as both. */}
                    <SettingsRow icon="trophy" color={t.color.success} label={`If ${who} ${verb}`} value={`${back} back · +${Math.max(0, back - already - Math.max(0, stake))}`} />
                    <SettingsRow icon="people" color={t.color.accent} label="On the other side" value={otherSide ? `${otherSide} Shards` : 'Nobody yet'} />
                </SettingsGroup>
                {/* With nobody on the other side, the bet is only ever refunded: said once, plainly. */}
                {otherSide ? null : <Text variant="caption" tone="muted">If nobody bets the other way, you get your Shards back.</Text>}
                {error ? <Text variant="bodySmall" tone="danger">{error}</Text> : null}
            </View>
        </VoidSheet>
    );
}

/** Your goals, to open one to bets: the ones that can be (a deadline three or more days away), and why the rest can't. */
function OpenSheet({ visible, openKeys, onClose }: { visible: boolean; openKeys: Set<string>; onClose: () => void }) {
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
    balance: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    list: { gap: Spacing.sm },
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    grow: { flex: 1 },
    track: { height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
    sides: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -Spacing.xs },
    buttons: { flexDirection: 'row', gap: Spacing.sm },
    amounts: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    typed: { marginTop: Spacing.md },
    // A sheet that does not scroll pads its own content and footer, as every sheet in the app does.
    body: { gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
