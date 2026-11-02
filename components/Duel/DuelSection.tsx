import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { AppButton, AppIcon, Avatar, ListItem, MatteSurface, SectionTitle, Text } from '@/components/ui';
import { useProgress } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { cancelDuel, daysLeft, leader, myDuels, respondDuel, shareOf, type Duel } from '@/lib/duels';
import { Control, Radius, Spacing } from '@/theme/designSystem';

/**
 * Your duels, on Community's Bets: a challenge waiting for your answer first,
 * then the ones running (a tug of war between your share of your plan and
 * theirs), then the last two weeks' results. Nothing to show, it stays out
 * of the way: the + starts one.
 */
export function DuelSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const [duels, setDuels] = useState<Duel[]>([]);
    const load = useCallback(() => { myDuels().then(setDuels).catch(() => setDuels([])); }, []);
    useFocusEffect(load);
    useEffect(() => {
        const sub = on('market_changed', load);
        return () => sub.remove();
    }, [load]);
    if (!duels.length) return null;
    return (
        <View style={[styles.section, style]}>
            <SectionTitle first right={<AppButton label="Duel" icon="flash" variant="ghost" fullWidth={false} onPress={() => emit('show_duel')} />}>Duels</SectionTitle>
            <View style={styles.list}>
                {duels.map(duel => <ListItem key={duel.id}><DuelCard duel={duel} /></ListItem>)}
            </View>
        </View>
    );
}

function DuelCard({ duel }: { duel: Duel }) {
    const t = useTokens();
    const { successFeedback, selectionFeedback } = useHaptics();
    const act = (run: () => Promise<void>) => run().then(() => successFeedback())
        .catch((failed: unknown) => Alert.alert('That didn’t go through', failed instanceof Error ? failed.message : 'Try again in a moment.'));
    const stake = duel.stake ? `${duel.stake} Shards each` : 'For pride';
    const head = (line: string) => (
        <View style={styles.head}>
            <Avatar name={duel.name} uri={duel.avatarUrl} size={Control.hitTarget} />
            <View style={styles.grow}>
                <Text variant="heading">{line}</Text>
                <Text variant="caption" tone="muted">{`${duel.days} days · ${stake}`}</Text>
            </View>
        </View>
    );

    if (duel.status === 'proposed') {
        return (
            <MatteSurface radius={Radius.card} style={styles.card}>
                {head(duel.mine ? `Waiting for ${duel.name}` : `${duel.name} challenged you`)}
                {duel.mine ? (
                    <AppButton label="Take it back" variant="ghost" onPress={() => { selectionFeedback(); void act(() => cancelDuel(duel.id)); }} />
                ) : (
                    <View style={styles.buttons}>
                        <View style={styles.grow}><AppButton label="Not now" variant="ghost" onPress={() => void act(() => respondDuel(duel.id, false))} /></View>
                        <View style={styles.grow}><AppButton label="Accept" icon="flash" onPress={() => void act(() => respondDuel(duel.id, true))} /></View>
                    </View>
                )}
            </MatteSurface>
        );
    }

    const mine = shareOf(duel.me), theirs = shareOf(duel.them);
    const ahead = leader(duel);
    if (duel.status === 'active') {
        const left = daysLeft(duel.ends);
        const started = duel.starts ? new Date(`${duel.starts}T00:00:00`) <= new Date() : false;
        return (
            <MatteSurface radius={Radius.card} style={styles.card}>
                {head(!started ? `Starts tomorrow vs ${duel.name}` : ahead === 'me' ? `You’re ahead of ${duel.name}` : ahead === 'them' ? `${duel.name} is ahead` : `Neck and neck with ${duel.name}`)}
                <Tug mine={mine} theirs={theirs} color={t.color.accent} other={t.color.textSubtle} />
                <View style={styles.sides}>
                    <Text variant="bodySmall" numeric>{`You ${Math.round(mine * 100)}%`}</Text>
                    <Text variant="caption" tone="muted">{started ? `${left} ${left === 1 ? 'day' : 'days'} left` : 'Not started'}</Text>
                    <Text variant="bodySmall" tone="muted" numeric>{`${Math.round(theirs * 100)}%`}</Text>
                </View>
            </MatteSurface>
        );
    }

    const won = duel.winnerId === null ? null : duel.winnerId !== duel.friendId;
    const result = duel.status === 'settled'
        ? (won === null ? 'A draw' : won ? `You beat ${duel.name}` : `${duel.name} won this one`)
        : duel.status === 'declined' ? `${duel.mine ? duel.name : 'You'} passed` : 'Taken back';
    return (
        <MatteSurface radius={Radius.card} style={styles.card}>
            <View style={styles.head}>
                <AppIcon name={won ? 'trophy' : won === false ? 'flag' : 'remove-circle'} filled size={Control.icon} color={won ? t.color.warning : t.color.textSubtle} />
                <View style={styles.grow}><Text variant="heading">{result}</Text></View>
                {duel.status === 'settled' && duel.stake ? (
                    <Text variant="bodySmall" tone={won ? 'success' : 'muted'} numeric>{won === null ? 'Refunded' : won ? `+${duel.stake * 2}` : `−${duel.stake}`}</Text>
                ) : null}
            </View>
        </MatteSurface>
    );
}

/** The tug of war: your share pulling from the left, theirs from the right, meeting where you stand. */
function Tug({ mine, theirs, color, other }: { mine: number; theirs: number; color: string; other: string }) {
    const split = mine + theirs > 0 ? mine / (mine + theirs) : 0.5;
    const shown = useProgress(split);
    const left = useAnimatedStyle(() => ({ flex: Math.max(0.001, shown.get()) }));
    const right = useAnimatedStyle(() => ({ flex: Math.max(0.001, 1 - shown.get()) }));
    return (
        <View style={styles.tug} accessible accessibilityRole="progressbar" accessibilityLabel="You against them" accessibilityValue={{ min: 0, max: 100, now: Math.round(split * 100) }}>
            <Animated.View style={[styles.half, { backgroundColor: color }, left]} />
            <View style={[styles.knot, { backgroundColor: color }]} />
            <Animated.View style={[styles.half, { backgroundColor: other }, right]} />
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    list: { gap: Spacing.sm },
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    grow: { flex: 1 },
    buttons: { flexDirection: 'row', gap: Spacing.sm },
    tug: { flexDirection: 'row', alignItems: 'center', height: Spacing.sm, gap: Spacing.xs },
    half: { height: '100%', borderRadius: Radius.pill },
    knot: { width: Spacing.xs, height: Spacing.md, borderRadius: Radius.pill },
    sides: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -Spacing.xs },
});
