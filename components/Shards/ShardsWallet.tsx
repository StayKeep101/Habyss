import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, AppIcon, ModalHeader, SectionTitle, StatTile, Text, VoidCard, VoidModal } from '@/components/ui';
import { CountUp } from '@/components/ui/Motion';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { ShardsRules } from './ShardsRules';
import { useTokens } from '@/hooks/useTokens';
import { MARKET_ENABLED } from '@/constants/features';
import { SHARDS, WALLET_RANGES, sampleRange, type ShardMove, type WalletRange } from '@/lib/shards';
import type { GoalPoint } from '@/lib/goalInsights';
import type { Wallet } from '@/hooks/useWallet';
import { Control, Spacing } from '@/theme/designSystem';

const RANGE_NAME: Record<WalletRange, string> = { '1H': 'Past hour', '24H': 'Past 24 hours', '1W': 'Past week', '1M': 'Past month', '1Y': 'Past year', ALL: 'All time' };
const VERB: Record<ShardMove['kind'], string> = { add: 'Added', complete: 'Completed', miss: 'Missed', stake: 'Bet placed', payout: 'Bet won', refund: 'Bet refunded' };
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
/** A moment under the finger, said as finely as the range is drawn. */
const momentLabel = (iso: string, range: WalletRange) => {
    const at = new Date(iso);
    if (range === '1H' || range === '24H') return at.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    if (range === '1W') return at.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric' });
    return at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
/** What a move was, under its title, the way the Marks page said it. */
const meta = (move: ShardMove) => {
    const what = move.item === 'sleep' ? (move.kind === 'miss' ? 'Slept short of your goal' : 'Slept your goal')
        : move.item === 'focus' ? 'Finished the day’s tasks'
        : move.item ? `${VERB[move.kind]} ${move.item}` : VERB[move.kind];
    return `${what} · ${shortDay(move.date)}`;
};

/**
 * Your Shards, read like a brokerage account: the balance, what it gained or
 * lost over the period you pick (green up, red down, the line in the same
 * colour, by the hour or the year), a finger to read any moment (with the
 * ticks a trading app gives), what you have and what is on bets, then every
 * transaction. The ⓘ explains exactly what earns and costs Shards, and that
 * they are a game currency with no real-money value. Marks are XP.
 */
export function ShardsWallet({ visible, onClose, wallet, multiplier, perfectRun }: {
    visible: boolean; onClose: () => void; wallet: Wallet; multiplier: number; perfectRun: number;
}) {
    const t = useTokens();
    const [range, setRange] = useState<WalletRange>('24H');
    const [scrub, setScrub] = useState<GoalPoint | null>(null);
    const [info, setInfo] = useState(false);
    // The line ends at now: moved on every minute while the wallet is open.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!visible) return;
        const opened = setTimeout(() => setNow(Date.now()), 0);
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => { clearTimeout(opened); clearInterval(timer); };
    }, [visible]);

    // The range drawn point by point: every 2 minutes over an hour, every 30 over a day, and so on.
    const series = useMemo<GoalPoint[]>(
        () => sampleRange(wallet.timeline, range, now).map(point => ({ date: new Date(point.t).toISOString(), actual: point.value, pace: point.value, value: point.value })),
        [wallet.timeline, range, now],
    );
    // The change over the period shown, the way a stock app states it.
    const start = series[0]?.actual ?? SHARDS.starter;
    const end = scrub ? scrub.actual : wallet.balance;
    const change = end - start;
    const percent = start > 0 ? (change / start) * 100 : 0;
    const tone = change > 0 ? t.color.success : change < 0 ? t.color.danger : t.color.textMuted;
    const line = change >= 0 ? t.color.success : t.color.danger;

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader title="WALLET" onBack={onClose} onAction={() => setInfo(true)} actionIcon="information-circle-outline" actionLabel="How Shards work" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.label}>
                    <AppIcon name="diamond" filled size={Control.icon} color={t.color.accent} />
                    <Text variant="heading" tone="muted">Shards balance</Text>
                </View>
                <CountUp style={[t.type.display, { color: t.color.textPrimary }]} value={end.toLocaleString()} />
                <View style={styles.change}>
                    {scrub ? (
                        <Text variant="bodySmall" tone="muted">{momentLabel(scrub.date, range)}</Text>
                    ) : (
                        <>
                            <AppIcon name={change > 0 ? 'caret-up' : change < 0 ? 'caret-down' : 'remove'} size={Spacing.md} color={tone} />
                            <Text variant="heading" numeric tone={change > 0 ? 'success' : change < 0 ? 'danger' : 'muted'}>
                                {`${change >= 0 ? '+' : '−'}${Math.abs(change).toLocaleString()} (${Math.abs(percent).toFixed(1)}%)`}
                            </Text>
                            <Text variant="bodySmall" tone="muted">{RANGE_NAME[range]}</Text>
                        </>
                    )}
                </View>

                <View style={styles.chart}>
                    <GoalProgressChart series={series} color={line} height={200} onScrub={setScrub} unbounded pace={false} label="Shards balance" sticky={false} ticks
                        custom={{ options: WALLET_RANGES.map(({ id, label }) => ({ id, label })), selected: range, onSelect: id => { setScrub(null); setRange(id as WalletRange); } }} />
                </View>

                <VoidCard style={styles.stats}>
                    <StatTile value={wallet.balance.toLocaleString()} label="Available" />
                    <StatTile value={wallet.inPlay.toLocaleString()} label="On bets" />
                    <StatTile value={`${wallet.today >= 0 ? '+' : '−'}${Math.abs(wallet.today)}`} label="Today" tone={wallet.today > 0 ? 'success' : wallet.today < 0 ? 'danger' : 'primary'} />
                </VoidCard>

                {MARKET_ENABLED ? (
                    <AppButton label="Bet on friends’ goals" icon="trending-up" onPress={() => { onClose(); router.navigate('/(root)/(tabs)/community'); }} />
                ) : null}

                {/* Every transaction, as the Marks page listed them: what, how, when, and the Shards. */}
                <SectionTitle>Recent</SectionTitle>
                {wallet.activity.length ? (
                    <VoidCard style={styles.list}>
                        {wallet.activity.map((move, index) => (
                            <View key={`${move.t}-${index}`} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                <View style={styles.grow}>
                                    <Text variant="heading" numberOfLines={1}>{move.title}</Text>
                                    <Text variant="caption" tone="muted" numberOfLines={1}>{meta(move)}</Text>
                                </View>
                                <Text variant="heading" numeric tone={move.amount > 0 ? 'success' : 'danger'}>
                                    {`${move.amount > 0 ? '+' : '−'}${Math.abs(move.amount)}`}
                                </Text>
                            </View>
                        ))}
                    </VoidCard>
                ) : (
                    <Text variant="bodySmall" tone="muted">Add a habit, task or goal and your first Shards land here.</Text>
                )}
            </ScrollView>

            {/* How Shards work: the app's own sheet, game-currency notice first. */}
            <ShardsRules visible={info} onClose={() => setInfo(false)} multiplier={multiplier} perfectRun={perfectRun} />
        </VoidModal>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.section + Spacing.lg, gap: Spacing.lg },
    label: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    change: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: -Spacing.sm },
    chart: { marginTop: Spacing.sm },
    stats: { flexDirection: 'row', paddingVertical: Spacing.lg },
    list: { paddingHorizontal: Spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    grow: { flex: 1 },
});
