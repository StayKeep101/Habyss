import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton, AppIcon, Avatar, ChoicePill, CountUp, MatteSurface, Text, VersusBar } from '@/components/ui';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { useTokens } from '@/hooks/useTokens';
import { BET_CAP, BET_STAKES, betOnRace, betPayout, finishRace, timeLeft, type Race, type RaceSide } from '@/lib/races';
import { oopsTitle } from '@/lib/voice';
import { Control, Radius, Spacing } from '@/theme/designSystem';

/**
 * A race against the clock, as a card: who is racing and what, the time left
 * ticking down in large type over a bar that drains, the tasks (ticked as
 * they are done, on your own race), the Shards on it (and Habyss's match),
 * and friends' bets for and against, split on one line. On a friend's race:
 * back them or bet against, with what it would pay. On yours: give up. Once
 * it is over: how it went.
 */
export function RaceCard({ race, onChanged, onOpenPerson }: { race: Race; onChanged: () => void; onOpenPerson?: (userId: string) => void }) {
    const t = useTokens();
    const { selectionFeedback, mediumFeedback } = useHaptics();
    const tasks = useTasks();
    const [now, setNow] = useState(() => Date.now());
    const running = race.status === 'open' && now < race.endsAt;
    useEffect(() => {
        if (race.status !== 'open') return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [race.status]);

    const [side, setSide] = useState<RaceSide | null>(race.myBet?.side ?? null);
    const [amount, setAmount] = useState<number>(25);
    const [busy, setBusy] = useState(false);
    const room = BET_CAP - (race.myBet?.amount ?? 0);
    const share = Math.max(0, Math.min(1, (race.endsAt - now) / Math.max(1, race.endsAt - race.startsAt)));
    const done = race.mine ? race.tasks.filter(item => tasks.find(task => task.id === item.key)?.status === 'done').length : null;
    const total = race.pool.for + race.pool.against;
    const tone = race.status === 'won' ? t.color.success : race.status === 'missed' ? t.color.danger : t.color.accent;

    const bet = async () => {
        if (!side || busy) return;
        setBusy(true);
        try { await betOnRace(race.id, side, Math.min(amount, room)); mediumFeedback(); onChanged(); }
        catch (failed) { Alert.alert(oopsTitle(), failed instanceof Error ? failed.message : 'Try again in a moment.'); }
        finally { setBusy(false); }
    };
    const giveUp = () => Alert.alert('Give up this race?', `Your ${race.stake.toLocaleString()} Shards go to friends who bet against you.`, [
        { text: 'Keep racing', style: 'cancel' },
        { text: 'Give up', style: 'destructive', onPress: () => { void finishRace(race.id, false).then(onChanged); } },
    ]);

    const result = race.status === 'won' ? `Beat the clock · +${((race.payout ?? race.stake) - race.stake).toLocaleString()} Shards`
        : race.status === 'missed' ? `Out of time · −${race.stake.toLocaleString()} Shards`
        : race.status === 'void' ? 'Called off' : null;

    return (
        <MatteSurface radius={Radius.card} style={styles.card}>
            {/* The clock: a glow of the race's colour, draining with the time left. */}
            <LinearGradient pointerEvents="none" colors={[t.tint('soft', tone), 'transparent']} style={[styles.glow, { width: `${(running ? share : 1) * 100}%` }]} />
            <View style={styles.body}>
                <Pressable style={styles.head} disabled={race.mine || !onOpenPerson} onPress={() => onOpenPerson?.(race.ownerId)}
                    accessibilityRole={race.mine ? undefined : 'button'} accessibilityLabel={race.mine ? undefined : `Open ${race.name}'s profile`}>
                    <Avatar name={race.name} uri={race.avatarUrl} size={Control.hitTarget - Spacing.xs} />
                    <View style={styles.flex}>
                        <Text variant="heading" numberOfLines={1}>{race.mine ? 'Your race' : `${race.name.split(' ')[0]} is racing`}</Text>
                        <Text variant="caption" tone="muted" numberOfLines={1}>{race.title}</Text>
                    </View>
                    <View style={styles.stake} accessible accessibilityLabel={`${race.stake} Shards staked${race.match ? `, matched by Habyss up to ${race.match}` : ''}`}>
                        <ShardIcon size={Spacing.lg + Spacing.xs} />
                        <Text variant="heading" numeric>{race.stake.toLocaleString()}</Text>
                    </View>
                </Pressable>

                {/* Time left, or how it ended. */}
                {result ? (
                    <Text variant="title" tone={race.status === 'won' ? 'success' : race.status === 'missed' ? 'danger' : 'muted'}>{result}</Text>
                ) : (
                    <View accessible accessibilityLabel={timeLeft(race.endsAt, now)} accessibilityLiveRegion="polite">
                        <CountUp value={timeLeft(race.endsAt, now).replace(' left', '')} style={[t.type.display, { color: t.color.textPrimary }]} />
                        <Text variant="caption" tone="muted">{race.match ? `left · a win is matched with ${race.match.toLocaleString()} more` : 'left'}</Text>
                    </View>
                )}

                {/* The tasks: ticked as they are done (on your own race). */}
                <View style={styles.tasks}>
                    {race.tasks.map(item => {
                        const ticked = race.mine ? tasks.find(task => task.id === item.key)?.status === 'done' : race.status === 'won';
                        return (
                            <View key={item.key} style={styles.task}>
                                <AppIcon name={ticked ? 'checkmark-circle' : 'ellipse-outline'} filled={ticked} size={Spacing.lg + 2} color={ticked ? tone : t.color.textSubtle} />
                                <Text variant="bodySmall" grow numberOfLines={1} tone={ticked ? 'primary' : 'muted'}>{item.title}</Text>
                            </View>
                        );
                    })}
                    {done !== null && running ? <Text variant="caption" tone="muted">{`${done} of ${race.tasks.length} done`}</Text> : null}
                </View>

                {/* Friends' bets, for and against. */}
                {total > 0 ? (
                    <VersusBar replay={total}
                        left={{ label: `${race.people.for} for`, percent: Math.round((race.pool.for / total) * 100), color: t.color.success }}
                        right={{ label: `${race.people.against} against`, percent: Math.round((race.pool.against / total) * 100), color: t.color.danger }} />
                ) : running ? <Text variant="caption" tone="muted">{race.mine ? 'No bets yet. Your friends have been told.' : 'No bets yet. Be the first.'}</Text> : null}

                {/* A friend's race: back them or bet against. */}
                {!race.mine && running && room > 0 ? (
                    <View style={styles.bet}>
                        <View style={styles.sides}>
                            <View style={styles.flex}>
                                <ChoicePill label="Back them" icon="thumbs-up" on={side === 'for'} color={t.color.success} disabled={!!race.myBet && race.myBet.side !== 'for'}
                                    onPress={() => { selectionFeedback(); setSide('for'); }} />
                            </View>
                            <View style={styles.flex}>
                                <ChoicePill label="Against" icon="thumbs-down" on={side === 'against'} color={t.color.danger} disabled={!!race.myBet && race.myBet.side !== 'against'}
                                    onPress={() => { selectionFeedback(); setSide('against'); }} />
                            </View>
                        </View>
                        {side ? (
                            <>
                                <View style={styles.sides}>
                                    {BET_STAKES.filter(step => step <= room).map(step => (
                                        <ChoicePill key={step} label={String(step)} on={amount === step} color={t.color.accent} onPress={() => { selectionFeedback(); setAmount(step); }} />
                                    ))}
                                </View>
                                <AppButton label={busy ? 'Betting…' : `Bet ${Math.min(amount, room)} · wins ${betPayout(Math.min(amount, room), side, race.pool, race.stake, race.myBet?.amount ?? 0)}`}
                                    icon="flash" variant="primary" loading={busy} disabled={busy} onPress={() => void bet()} />
                            </>
                        ) : null}
                    </View>
                ) : null}
                {race.myBet && !running ? (
                    <Text variant="caption" tone="muted">{`You bet ${race.myBet.amount} ${race.myBet.side === 'for' ? 'for' : 'against'}${race.myBet.payout !== null ? ` · ${race.myBet.payout - race.myBet.amount >= 0 ? '+' : '−'}${Math.abs(race.myBet.payout - race.myBet.amount)}` : ''}`}</Text>
                ) : null}

                {race.mine && running ? <AppButton label="Give up" variant="ghost" onPress={giveUp} /> : null}
            </View>
        </MatteSurface>
    );
}

const styles = StyleSheet.create({
    card: { overflow: 'hidden' },
    glow: { position: 'absolute', top: 0, bottom: 0, left: 0 },
    body: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    flex: { flex: 1 },
    stake: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    tasks: { gap: Spacing.xs },
    task: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    bet: { gap: Spacing.sm },
    sides: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
