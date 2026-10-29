import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { AppButton, AppIcon, IconButton, SectionTitle, StatTile, Text, VoidCard, VoidModal, ModalHeader } from '@/components/ui';
import { CountUp } from '@/components/ui/Motion';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import { useTokens } from '@/hooks/useTokens';
import { MARKET_ENABLED } from '@/constants/features';
import { SHARDS, WALLET_RANGES, sampleRange, type WalletRange } from '@/lib/shards';
import type { GoalPoint } from '@/lib/goalInsights';
import type { Wallet, WalletActivity } from '@/hooks/useWallet';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION } from '@/theme/motion';

const RANGE_NAME: Record<WalletRange, string> = { '1H': 'Past hour', '24H': 'Past 24 hours', '1W': 'Past week', '1M': 'Past month', '1Y': 'Past year', ALL: 'All time' };
/** A moment under the finger, said as finely as the range is drawn. */
const momentLabel = (iso: string, range: WalletRange) => {
    const at = new Date(iso);
    if (range === '1H' || range === '24H') return at.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    if (range === '1W') return at.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric' });
    return at.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
const ICON: Record<WalletActivity['kind'], string> = { earned: 'sparkles', stake: 'trending-up', payout: 'trophy', refund: 'return-up-back' };
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Your Shards, read like a brokerage account: the balance, what it gained or
 * lost over the period you pick (green up, red down, the line in the same
 * colour), a finger to read any day, what you have to spend and what is on
 * bets, then every transaction. Shards are the currency; Marks are XP.
 */
export function ShardsWallet({ visible, onClose, wallet }: { visible: boolean; onClose: () => void; wallet: Wallet }) {
    const t = useTokens();
    const [range, setRange] = useState<WalletRange>('24H');
    // The line ends at now: moved on every minute while the wallet is open.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!visible) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, [visible]);
    const [scrub, setScrub] = useState<GoalPoint | null>(null);
    const [info, setInfo] = useState(false);

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
                    <GoalProgressChart series={series} color={line} height={200} onScrub={setScrub} unbounded pace={false} label="Shards balance" sticky={false}
                        custom={{ options: WALLET_RANGES.map(({ id, label }) => ({ id, label })), selected: range, onSelect: id => { setScrub(null); setRange(id as WalletRange); } }} />
                </View>

                <VoidCard style={styles.stats}>
                    <StatTile value={wallet.balance.toLocaleString()} label="Available" />
                    <StatTile value={wallet.inPlay.toLocaleString()} label="On bets" />
                    <StatTile value={`+${wallet.today}`} label="Earned today" detail={wallet.capLeft ? `${wallet.capLeft} left today` : 'Limit reached'} />
                </VoidCard>

                {MARKET_ENABLED ? (
                    <AppButton label="Bet on friends’ goals" icon="trending-up" onPress={() => { onClose(); router.navigate('/(root)/(tabs)/community'); }} />
                ) : null}

                <SectionTitle>Activity</SectionTitle>
                {wallet.activity.length ? (
                    <VoidCard style={styles.list}>
                        {wallet.activity.map((row, index) => (
                            <View key={row.key} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                <View style={[styles.rowIcon, { backgroundColor: t.tint('subtle') }]}>
                                    <AppIcon name={ICON[row.kind]} filled size={Spacing.lg} color={t.color.accentText} />
                                </View>
                                <View style={styles.rowText}>
                                    <Text variant="heading" numberOfLines={1}>{row.title}</Text>
                                    <Text variant="caption" tone="muted" numberOfLines={1}>{`${row.detail} · ${shortDay(row.date)}`}</Text>
                                </View>
                                <Text variant="heading" numeric tone={row.amount > 0 ? 'success' : 'danger'}>
                                    {`${row.amount > 0 ? '+' : '−'}${Math.abs(row.amount)}`}
                                </Text>
                            </View>
                        ))}
                    </VoidCard>
                ) : (
                    <Text variant="bodySmall" tone="muted">Finish a habit or task you made before today and your first Shards land here.</Text>
                )}
            </ScrollView>

            {info ? (
                <Animated.View entering={FadeIn.duration(DURATION.quick)} exiting={FadeOut.duration(DURATION.exit)} style={[styles.overlay, { backgroundColor: t.color.background }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfo(false)} accessibilityLabel="Close" accessibilityRole="button" />
                    <VoidCard style={styles.window}>
                        <View style={styles.windowHead}>
                            <Text variant="title">How Shards work</Text>
                            <IconButton icon="close" label="Close" onPress={() => setInfo(false)} />
                        </View>
                        {[
                            ['diamond', 'Shards are Habyss’s currency. Marks are your XP: they rank you and never leave.'],
                            ['checkmark-circle', `Finish habits, tasks and goals to earn: 1 Shard for every ${SHARDS.perMarks} Marks they earn, up to ${SHARDS.dailyCap} a day.`],
                            ['shield-checkmark', 'Only things made before today count, and a miss never costs Shards. No farming.'],
                            ['trending-up', 'Spend them betting on friends’ goals. Win and you take a share of the other side’s Shards.'],
                            ['lock-closed', `Everyone starts with ${SHARDS.starter}. Shards can’t be bought or cashed out.`],
                        ].map(([icon, line]) => (
                            <View key={icon} style={styles.rule}>
                                <AppIcon name={icon} filled size={Control.icon} color={t.color.accentText} />
                                <View style={styles.rowText}><Text variant="body">{line}</Text></View>
                            </View>
                        ))}
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
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.height + Spacing.sm },
    rowIcon: { width: Control.hitTarget - Spacing.sm, height: Control.hitTarget - Spacing.sm, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1 },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: Spacing.xl },
    window: { padding: Spacing.xl, gap: Spacing.md },
    windowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rule: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
});

