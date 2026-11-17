import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton, Avatar, EmptyState, ListItem, Receipt, Text, VoidSheet } from '@/components/ui';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { challengeCatalog, DIFFICULTY_LABEL, startChallenge, type Challenge, type Difficulty } from '@/lib/challenges';
import { FriendsService, type Friend } from '@/lib/friendsService';
import { Control, Spacing } from '@/theme/designSystem';
import { ChallengeIcon, Group, GroupTitle, ItemRow, PROOF_WORD, Reward } from './ChallengeParts';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Pick a challenge, from the + on Community or the + on Challenges: the list
 * Habyss offers, grouped by level like an iOS inset list, then one opened
 * (what it adds to your plan, the reward, friends to invite). Alone it starts
 * today; with friends, tomorrow. Mounted once over the app.
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

    const levels = useMemo(() => LEVELS.map(level => ({ level, items: (list ?? []).filter(item => item.difficulty === level) }))
        .filter(group => group.items.length), [list]);

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
            title={chosen && !started ? chosen.title : 'Pick a challenge'}
            caption={chosen && !started ? `${chosen.days} days · ${DIFFICULTY_LABEL[chosen.difficulty]}` : 'Alone or with friends · all or nothing'}
            footer={chosen && !started ? (
                <View style={styles.footer}>
                    <AppButton label={invited.length ? `Start with ${invited.length} ${invited.length === 1 ? 'friend' : 'friends'}` : 'Start alone'}
                        variant="primary" loading={starting} onPress={start} />
                    <AppButton label="Back" variant="ghost" onPress={() => setChosen(null)} />
                </View>
            ) : undefined}>
            {started && chosen ? (
                <Receipt title="Challenge on" amount={undefined}
                    line={invited.length ? 'Starts tomorrow. It’s in your plan, and your friends have their invite.' : 'Starts today. It’s in your plan.'}
                    onDone={close} />
            ) : chosen ? (
                <View style={styles.body}>
                    <View style={styles.hero}>
                        <ChallengeIcon icon={chosen.icon} difficulty={chosen.difficulty} size={Control.height} />
                        <Text variant="body" tone="muted" grow>{chosen.summary}</Text>
                    </View>

                    <View style={styles.section}>
                        <GroupTitle>In your plan</GroupTitle>
                        <Group>{chosen.items.map(item => <ItemRow key={item.name} item={item} difficulty={chosen.difficulty} />)}</Group>
                    </View>

                    <View style={styles.section}>
                        <GroupTitle>Reward</GroupTitle>
                        <Group>
                            <View style={styles.rewardRow}>
                                <View style={styles.grow}>
                                    <Text variant="body">{invited.length ? 'If everyone keeps every day' : 'If you keep every day'}</Text>
                                    <Text variant="caption" tone="muted">{invited.length ? 'One missed day by anyone ends it' : 'One missed day ends it'}</Text>
                                </View>
                                <Reward amount={chosen.reward} each={invited.length > 0} />
                            </View>
                        </Group>
                    </View>

                    {friends.length ? (
                        <View style={styles.section}>
                            <GroupTitle>Invite friends</GroupTitle>
                            <Group>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces}>
                                    {friends.map(friend => {
                                        const picked = invited.includes(friend.userId);
                                        const name = friend.displayName ?? friend.username;
                                        return (
                                            <Pressable key={friend.userId} onPress={() => toggle(friend.userId)} style={styles.face}
                                                accessibilityRole="checkbox" accessibilityState={{ checked: picked }} accessibilityLabel={`Invite ${name}`}>
                                                <View>
                                                    <Avatar name={name} uri={friend.avatarUrl} size={Control.height} ring={picked ? t.color.accent : undefined} />
                                                    {picked ? (
                                                        <View style={[styles.tick, { backgroundColor: t.color.accent, borderColor: t.color.surface }]}>
                                                            <AppIcon name="checkmark" size={Spacing.md} color={t.color.background} />
                                                        </View>
                                                    ) : null}
                                                </View>
                                                <Text variant="caption" tone={picked ? 'accent' : 'muted'} align="center" numberOfLines={1}>{name.split(' ')[0]}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </Group>
                        </View>
                    ) : null}
                </View>
            ) : (
                <View style={styles.body}>
                    {list === null ? null : list.length === 0 ? (
                        <EmptyState icon="trophy" title="No challenges right now" message="New ones arrive without an update." />
                    ) : levels.map(({ level, items }) => (
                        <View key={level} style={styles.section}>
                            <GroupTitle>{DIFFICULTY_LABEL[level]}</GroupTitle>
                            <Group>
                                {items.map(challenge => (
                                    <ListItem key={challenge.id}>
                                        <Pressable onPress={() => { selectionFeedback(); setChosen(challenge); }} style={styles.row}
                                            accessibilityRole="button" accessibilityLabel={`${challenge.title}, ${challenge.days} days, ${DIFFICULTY_LABEL[challenge.difficulty]}, ${challenge.reward} Shards`}>
                                            <ChallengeIcon icon={challenge.icon} difficulty={challenge.difficulty} />
                                            <View style={styles.grow}>
                                                <Text variant="body" numberOfLines={1}>{challenge.title}</Text>
                                                <Text variant="caption" tone="muted" numberOfLines={1}>
                                                    {challenge.days} days · {PROOF_WORD[challenge.items[0]?.proof ?? 'photo']}
                                                </Text>
                                            </View>
                                            <Reward amount={challenge.reward} />
                                            <AppIcon name="chevron-forward" size={Spacing.lg} color={t.color.textMuted} />
                                        </Pressable>
                                    </ListItem>
                                ))}
                            </Group>
                        </View>
                    ))}
                </View>
            )}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.xl, paddingBottom: Spacing.lg },
    section: { gap: Spacing.sm },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.xs },
    hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.height + Spacing.sm },
    rewardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.height + Spacing.sm },
    grow: { flex: 1, gap: Spacing.xs / 2 },
    faces: { gap: Spacing.lg, paddingVertical: Spacing.md },
    face: { alignItems: 'center', gap: Spacing.xs, width: Control.height + Spacing.md },
    tick: { position: 'absolute', right: -Spacing.xs / 2, bottom: -Spacing.xs / 2, width: Spacing.xl, height: Spacing.xl, borderRadius: Spacing.xl / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
