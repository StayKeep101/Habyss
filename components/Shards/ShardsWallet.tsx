import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { AppButton, AppIcon, IconButton, ModalHeader, SectionTitle, StatTile, Text, VoidCard, VoidModal } from '@/components/ui';
import { CountUp } from '@/components/ui/Motion';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { PerfectLadder } from '@/components/Marks/PerfectLadder';
import { useTokens } from '@/hooks/useTokens';
import { MARKET_ENABLED } from '@/constants/features';
import { SHARDS, WALLET_RANGES, sampleRange, type ShardMove, type WalletRange } from '@/lib/shards';
import type { GoalPoint } from '@/lib/goalInsights';
import type { Wallet } from '@/hooks/useWallet';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';

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
    const rules = SHARDS.rules;

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

            {/* How Shards work: everything that earns and costs them, nothing to take on trust. */}
            {info ? (
                <Animated.View entering={FadeIn.duration(DURATION.quick)} exiting={FadeOut.duration(DURATION.exit)} style={[styles.overlay, { backgroundColor: t.color.background }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfo(false)} accessibilityLabel="Close" accessibilityRole="button" />
                    <VoidCard style={styles.window}>
                        <View style={styles.windowHead}>
                            <Text variant="title">How Shards work</Text>
                            <IconButton icon="close" label="Close" onPress={() => setInfo(false)} />
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.windowBody}>
                            {/* Said first, plainly: a game currency, not money. */}
                            <View style={[styles.notice, { backgroundColor: t.tint('subtle', t.color.warning) }]} accessible>
                                <AppIcon name="warning" filled size={Control.icon} color={t.color.warning} />
                                <View style={styles.grow}>
                                    <Text variant="heading">Game currency only</Text>
                                    <Text variant="bodySmall" tone="muted">Shards are for fun inside Habyss. They aren’t real money and have no cash value. They can’t be bought, sold, cashed out, transferred outside the app or exchanged for money or prizes. Bets are a game between friends.</Text>
                                </View>
                            </View>

                            <Text variant="bodySmall" tone="muted">Shards are your currency in Habyss. Marks are your XP: they only go up.</Text>

                            <View style={[styles.table, { backgroundColor: t.color.surfaceRaised }]}>
                                <View style={styles.tableRow}>
                                    <View style={styles.first} />
                                    {(['Habit', 'Task', 'Goal'] as const).map(label => (
                                        <View key={label} style={styles.cell}><Text variant="caption" tone="muted" align="right">{label}</Text></View>
                                    ))}
                                </View>
                                {(['add', 'complete', 'miss'] as const).map(kind => (
                                    <View key={kind} style={styles.tableRow}>
                                        <View style={styles.first}><Text variant="bodySmall" tone="muted">{VERB[kind]}</Text></View>
                                        {(['habit', 'task', 'goal'] as const).map(item => {
                                            const points = rules[kind][item];
                                            return (
                                                <View key={item} style={styles.cell}>
                                                    <Text variant="bodySmall" numeric align="right" tone={points > 0 ? 'primary' : 'danger'}>{`${points > 0 ? '+' : '−'}${Math.abs(points)}`}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>

                            <View style={[styles.table, { backgroundColor: t.color.surfaceRaised }]}>
                                {([
                                    ['Sleep goal reached', rules.complete.sleep],
                                    ['Sleep goal missed', rules.miss.sleep],
                                    ['Milestone reached', rules.complete.milestone],
                                ] as const).map(([label, points]) => (
                                    <View key={label} style={styles.tableRow}>
                                        <View style={styles.grow}><Text variant="bodySmall" tone="muted">{label}</Text></View>
                                        <Text variant="bodySmall" numeric tone={points > 0 ? 'primary' : 'danger'}>{`${points > 0 ? '+' : '−'}${Math.abs(points)}`}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Perfect days in a row multiply what completing earns. */}
                            <View style={[styles.table, { backgroundColor: t.color.surfaceRaised }]}>
                                <PerfectLadder multiplier={multiplier} run={perfectRun} />
                            </View>

                            {[
                                ['shield-checkmark', `No farming: finishing something made the same day earns nothing, and neither does a habit ticked days later. A goal pays only if it existed ${SHARDS.goalMinDays} days. Adding things earns at most ${SHARDS.addCap} a day, milestones ${SHARDS.milestonesPerDay} a day, and no day earns more than ${SHARDS.dailyCap}. Deleting something takes back what it earned.`],
                                ['trending-up', 'Bet them on friends’ goals. Win and you take a share of the other side’s Shards.'],
                                ['lock-closed', `Everyone starts with ${SHARDS.starter}. Never below zero.`],
                            ].map(([icon, sentence]) => (
                                <View key={icon} style={styles.rule}>
                                    <AppIcon name={icon} filled size={Control.icon} color={t.color.accentText} />
                                    <View style={styles.grow}><Text variant="bodySmall">{sentence}</Text></View>
                                </View>
                            ))}
                        </ScrollView>
                    </VoidCard>
                </Animated.View>
            ) : null}
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
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: Spacing.xl },
    window: { maxHeight: '82%', padding: Spacing.xl, gap: Spacing.md },
    windowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    windowBody: { gap: Spacing.md, paddingBottom: Spacing.sm },
    notice: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', padding: Spacing.md, borderRadius: Radius.small },
    table: { borderRadius: Radius.small, padding: Spacing.md, gap: Spacing.sm },
    tableRow: { flexDirection: 'row', alignItems: 'center' },
    first: { flex: 1.4 },
    cell: { flex: 1 },
    rule: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
});
