import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, AppIcon, Avatar, CardRail, Divider, GameCard, IconButton, IconTile, ListItem, SectionTitle, Text, VersusBar, VoidCard } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { cancelDuel, daysLeft, leader, myDuels, respondDuel, shareOf, type Duel } from '@/lib/duels';
import { Control, Spacing } from '@/theme/designSystem';

const stakeLabel = (duel: Duel) => (duel.stake ? `${duel.stake} Shards` : 'For pride');

/**
 * Your duels, on Community's Bets, laid out like a trading app: a challenge
 * waiting for an answer first (it has buttons), then the ones running side by
 * side to swipe through (you against them, as one bar, and a pill saying who
 * is ahead), then past results as a short ledger. With none, one card that
 * starts the first.
 */
export function DuelSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const [duels, setDuels] = useState<Duel[] | null>(null);
    const load = useCallback(() => { myDuels().then(setDuels).catch(() => setDuels([])); }, []);
    useFocusEffect(load);
    useEffect(() => {
        const sub = on('market_changed', load);
        return () => sub.remove();
    }, [load]);
    if (duels === null) return null;
    const start = () => emit('show_duel');
    const waiting = duels.filter(duel => duel.status === 'proposed');
    const running = duels.filter(duel => duel.status === 'active');
    const past = duels.filter(duel => duel.status !== 'proposed' && duel.status !== 'active');
    return (
        <View style={[styles.section, style]}>
            <SectionTitle first right={<IconButton icon="add" label="Duel a friend" onPress={start} />}>Duels</SectionTitle>
            {waiting.map(duel => <ListItem key={duel.id}><Challenge duel={duel} /></ListItem>)}
            {running.length ? (
                <CardRail>{running.map(duel => <Running key={duel.id} duel={duel} />)}</CardRail>
            ) : !waiting.length ? (
                <GameCard onPress={start} title="Duel a friend" subtitle="Who keeps their plan better"
                    lead={<IconTile icon="flash" color={t.color.cobalt} size={Control.hitTarget} />}
                    badge={{ label: '3–14 days', tone: 'neutral' }} />
            ) : null}
            {past.length ? (
                <VoidCard style={styles.ledger}>
                    {past.map((duel, index) => (
                        <React.Fragment key={duel.id}>
                            {index ? <Divider inset /> : null}
                            <Result duel={duel} />
                        </React.Fragment>
                    ))}
                </VoidCard>
            ) : null}
        </View>
    );
}

/** A challenge not yet answered: theirs to you (accept it), or yours to them (take it back). */
function Challenge({ duel }: { duel: Duel }) {
    const { successFeedback, selectionFeedback } = useHaptics();
    const act = (run: () => Promise<void>) => run().then(() => successFeedback())
        .catch((failed: unknown) => Alert.alert('That didn’t go through', failed instanceof Error ? failed.message : 'Try again in a moment.'));
    return (
        <GameCard
            lead={<Avatar name={duel.name} uri={duel.avatarUrl} size={Control.hitTarget} />}
            title={duel.mine ? duel.name : `${duel.name} challenged you`}
            subtitle={`${duel.days} days · ${stakeLabel(duel)}`}
            badge={duel.mine ? { label: 'Waiting', tone: 'neutral', dot: true } : { label: 'New', tone: 'cobalt', icon: 'flash' }}
            footer={duel.mine ? (
                <AppButton label="Take it back" variant="ghost" onPress={() => { selectionFeedback(); void act(() => cancelDuel(duel.id)); }} />
            ) : (
                <View style={styles.buttons}>
                    <View style={styles.grow}><AppButton label="Not now" variant="ghost" onPress={() => void act(() => respondDuel(duel.id, false))} /></View>
                    <View style={styles.grow}><AppButton label="Accept" icon="flash" onPress={() => void act(() => respondDuel(duel.id, true))} /></View>
                </View>
            )} />
    );
}

/** A duel under way: you against them as one bar, and who is in front. */
function Running({ duel }: { duel: Duel }) {
    const t = useTokens();
    const mine = shareOf(duel.me) * 100, theirs = shareOf(duel.them) * 100;
    const ahead = leader(duel);
    const left = daysLeft(duel.ends);
    const started = duel.starts ? new Date(`${duel.starts}T00:00:00`) <= new Date() : false;
    return (
        <GameCard
            lead={<Avatar name={duel.name} uri={duel.avatarUrl} size={Control.hitTarget} />}
            title={`vs ${duel.name}`}
            subtitle={`${started ? `${left} ${left === 1 ? 'day' : 'days'} left` : 'Starts tomorrow'} · ${stakeLabel(duel)}`}
            badge={!started ? { label: 'Soon', tone: 'neutral' }
                : ahead === 'me' ? { label: 'Ahead', tone: 'cobalt', icon: 'trending-up' }
                    : ahead === 'them' ? { label: 'Behind', tone: 'silver', icon: 'trending-down' }
                        : { label: 'Even', tone: 'neutral', icon: 'remove' }}>
            <VersusBar left={{ label: 'You', percent: mine, color: t.color.cobalt }}
                right={{ label: duel.name.split(' ')[0], percent: theirs, color: t.color.silver }} />
        </GameCard>
    );
}

/** A finished duel, as a ledger line: what happened, and what it paid. */
function Result({ duel }: { duel: Duel }) {
    const t = useTokens();
    const won = duel.winnerId === null ? null : duel.winnerId !== duel.friendId;
    const settled = duel.status === 'settled';
    const title = settled
        ? (won === null ? `Draw with ${duel.name}` : won ? `You beat ${duel.name}` : `${duel.name} won`)
        : duel.status === 'declined' ? `${duel.mine ? duel.name : 'You'} passed` : 'Taken back';
    const icon = settled && won ? 'trophy' : settled && won === false ? 'flag' : 'remove-circle';
    const color = settled && won ? t.color.silver : settled && won === false ? t.color.silver : t.color.textMuted;
    return (
        <View style={styles.row} accessible accessibilityLabel={`${title}, ${duel.days} days${settled && duel.stake ? (won === null ? ', Shards back' : won ? `, won ${duel.stake * 2} Shards` : `, lost ${duel.stake} Shards`) : ''}`}>
            <IconTile icon={icon} color={color} size={Control.hitTarget - Spacing.xs} />
            <View style={styles.grow}>
                <Text variant="heading" numberOfLines={1}>{title}</Text>
                <Text variant="bodySmall" tone="muted">{`${duel.days} days`}</Text>
            </View>
            {settled && duel.stake ? (
                <View style={styles.amount}>
                    <Text variant="heading" tone={won === null ? 'muted' : won ? 'success' : 'danger'} numeric>
                        {won === null ? '±0' : won ? `+${duel.stake * 2}` : `−${duel.stake}`}
                    </Text>
                    <AppIcon name="diamond" filled size={Spacing.md} color={t.color.textMuted} />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    grow: { flex: 1 },
    buttons: { flexDirection: 'row', gap: Spacing.sm },
    ledger: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    amount: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
