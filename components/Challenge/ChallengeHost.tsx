import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton, Avatar, Badge, EmptyState, IconTile, ListItem, Receipt, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { challengeCatalog, DIFFICULTY_LABEL, startChallenge, type Challenge } from '@/lib/challenges';
import { FriendsService, type Friend } from '@/lib/friendsService';
import { Control, Spacing } from '@/theme/designSystem';

const PROOF_WORD = { health: 'Apple Health', focus: 'Focus timer', photo: 'Photo' } as const;
const TONE = { easy: 'success', medium: 'warning', hard: 'danger' } as const;

/**
 * Pick a challenge, from the + on Community: the list Habyss offers, then one
 * opened (what it adds to your plan, how each is proven, the reward), with
 * friends to invite. Alone it starts today; with friends, tomorrow.
 * Mounted once over the app.
 */
export function ChallengeHost() {
    const t = useTokens();
    const { selectionFeedback, successFeedback } = useHaptics();
    const [visible, setVisible] = useState(false);
    const [list, setList] = useState<Challenge[] | null>(null);
    const [chosen, setChosen] = useState<Challenge | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [invited, setInvited] = useState<string[]>([]);
    const [starting, setStarting] = useState(false);
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const sub = on('show_challenges', () => {
            setVisible(true);
            setChosen(null);
            setInvited([]);
            setStarted(false);
            challengeCatalog().then(setList).catch(() => setList([]));
            FriendsService.getFriends().then(setFriends).catch(() => setFriends([]));
        });
        return () => sub.remove();
    }, []);

    const close = () => setVisible(false);
    const start = () => {
        if (!chosen || starting) return;
        setStarting(true);
        startChallenge(chosen.id, invited)
            .then(() => { successFeedback(); setStarted(true); })
            .catch((failed: unknown) => Alert.alert('Couldn’t start it', failed instanceof Error ? failed.message : 'Try again in a moment.'))
            .finally(() => setStarting(false));
    };

    const toggle = (id: string) => {
        selectionFeedback();
        setInvited(current => (current.includes(id) ? current.filter(one => one !== id) : [...current, id]));
    };

    return (
        <VoidSheet visible={visible} onClose={close} scrollable maxShare={0.9}
            title={chosen ? chosen.title : 'Pick a challenge'}
            caption={chosen ? `${chosen.days} days · ${DIFFICULTY_LABEL[chosen.difficulty]}` : 'All or nothing'}
            footer={chosen && !started ? (
                <View style={styles.footer}>
                    <AppButton label={invited.length ? `Start with ${invited.length} ${invited.length === 1 ? 'friend' : 'friends'}` : 'Start alone'}
                        icon="trophy" variant="primary" loading={starting} onPress={start} />
                    <AppButton label="Back to the list" variant="ghost" onPress={() => setChosen(null)} />
                </View>
            ) : undefined}>
            {started && chosen ? (
                <Receipt title="Challenge on" amount={undefined}
                    line={invited.length ? 'Starts tomorrow. Its habits are in your plan; your friends have their invite.' : 'Starts today. Its habits are in your plan.'}
                    onDone={close} />
            ) : chosen ? (
                <View style={styles.body}>
                    <Text variant="body" tone="muted">{chosen.summary}</Text>
                    <View style={styles.list}>
                        {chosen.items.map(item => (
                            <View key={item.name} style={styles.line}>
                                <IconTile icon={(item.icon ?? 'checkmark') as never} color={t.color.cobalt} size={Control.hitTarget - Spacing.sm} />
                                <View style={styles.grow}>
                                    <Text variant="body" numberOfLines={1}>{item.name}</Text>
                                    <Text variant="caption" tone="muted">{item.kind === 'task' ? 'Once, by the last day' : 'Every day'} · proven by {PROOF_WORD[item.proof]}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                    <Badge label={`${chosen.reward} Shards each if everyone keeps every day`} tone="cobalt" icon="diamond" />
                    {friends.length ? (
                        <View style={styles.list}>
                            <Text variant="heading">Invite friends</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces}>
                                {friends.map(friend => {
                                    const picked = invited.includes(friend.userId);
                                    const name = friend.displayName ?? friend.username;
                                    return (
                                        <Pressable key={friend.userId} onPress={() => toggle(friend.userId)} style={styles.face}
                                            accessibilityRole="checkbox" accessibilityState={{ checked: picked }} accessibilityLabel={`Invite ${name}`}>
                                            <Avatar name={name} uri={friend.avatarUrl} size={Control.height} ring={picked ? t.color.accent : undefined} dim={invited.length > 0 && !picked} />
                                            <Text variant="caption" tone={picked ? 'accent' : 'muted'} align="center">{name.split(' ')[0]}</Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                            <Text variant="caption" tone="muted">One missed day by anyone ends it for everyone.</Text>
                        </View>
                    ) : null}
                </View>
            ) : (
                <View style={styles.body}>
                    {list === null ? null : list.length === 0 ? (
                        <EmptyState icon="trophy" title="No challenges right now" message="Check back soon: new ones arrive without an update." />
                    ) : list.map(challenge => (
                        <ListItem key={challenge.id}>
                            <Pressable onPress={() => { selectionFeedback(); setChosen(challenge); }} style={styles.line}
                                accessibilityRole="button" accessibilityLabel={`${challenge.title}, ${challenge.days} days, ${DIFFICULTY_LABEL[challenge.difficulty]}, ${challenge.reward} Shards`}>
                                <IconTile icon={challenge.icon as never} color={t.color.cobalt} size={Control.hitTarget} />
                                <View style={styles.grow}>
                                    <Text variant="heading" numberOfLines={1}>{challenge.title}</Text>
                                    <Text variant="caption" tone="muted">{challenge.days} days · {challenge.reward} Shards</Text>
                                </View>
                                <Badge label={DIFFICULTY_LABEL[challenge.difficulty]} tone={TONE[challenge.difficulty]} />
                            </Pressable>
                        </ListItem>
                    ))}
                </View>
            )}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.lg, paddingBottom: Spacing.lg },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.xs },
    list: { gap: Spacing.md },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.hitTarget },
    grow: { flex: 1 },
    faces: { gap: Spacing.md, paddingVertical: Spacing.xs },
    face: { alignItems: 'center', gap: Spacing.xs, minWidth: Control.height },
});
