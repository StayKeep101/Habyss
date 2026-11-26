import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton, Avatar, ListItem, Receipt, Text, VoidSheet } from '@/components/ui';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { challengeCatalog, startChallenge, type Challenge, type ChallengeItem } from '@/lib/challenges';
import { FriendsService, type Friend } from '@/lib/friendsService';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { Group, GroupTitle, Reward, useLevelColor } from './ChallengeParts';
import { ChallengeCard, Heartbeat } from './ChallengeCard';
import { CreateChallenge } from './CreateChallenge';
import { FeedService } from '@/lib/feedService';
import { oopsTitle } from '@/lib/voice';


/**
 * Pick a challenge, from the + on Community or the + on Challenges: the list
 * Habyss offers, grouped by level like an iOS inset list, then one opened
 * (what it adds to your plan, the reward, friends to invite). Alone it starts
 * today; with friends, tomorrow. Mounted once over the app.
 */
export function ChallengeHost() {
    const t = useTokens();
    const { selectionFeedback, successFeedback, mediumFeedback } = useHaptics();
    const [meId, setMeId] = useState<string | null>(null);
    useEffect(() => { void FeedService.me().then(setMeId).catch(() => undefined); }, []);
    const [visible, setVisible] = useState(false);
    const [list, setList] = useState<Challenge[] | null>(null);
    const [chosen, setChosen] = useState<Challenge | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [invited, setInvited] = useState<string[]>([]);
    const [starting, setStarting] = useState(false);
    const [started, setStarted] = useState(false);
    // Writing your own (components/Challenge/CreateChallenge.tsx).
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const sub = on('show_challenges', event => {
            setVisible(true);
            setChosen(null);
            setCreating(false);
            setInvited([]);
            setStarted(false);
            const want = event && typeof event === 'object' ? event.id : undefined;
            challengeCatalog().then(found => { setList(found); if (want) setChosen(found.find(item => item.id === want) ?? null); }).catch(() => setList([]));
            FriendsService.getFriends().then(setFriends).catch(() => setFriends([]));
        });
        return () => sub.remove();
    }, []);


    const close = () => setVisible(false);
    const start = () => {
        if (!chosen || starting) return;
        mediumFeedback();
        setStarting(true);
        startChallenge(chosen.id, invited)
            .then(() => { successFeedback(); setStarted(true); })
            .catch((failed: unknown) => Alert.alert(oopsTitle(), failed instanceof Error ? failed.message : 'Try again in a moment.'))
            .finally(() => setStarting(false));
    };
    const toggle = (id: string) => {
        selectionFeedback();
        setInvited(current => (current.includes(id) ? current.filter(one => one !== id) : [...current, id]));
    };

    return (
        <VoidSheet visible={visible} onClose={close} scrollable maxShare={0.9}
            title={creating ? 'Your own challenge' : chosen && !started ? chosen.title : 'Pick a challenge'}
            caption={creating ? 'Your rules, your days' : chosen && !started ? `${chosen.days} days · ${chosen.items.length} rules a day · no cheat days` : 'Alone or with friends · all or nothing'}
            footer={chosen && !started ? (
                <View style={styles.footer}>
                    <AppButton label={invited.length ? `I’m in, with ${invited.length} ${invited.length === 1 ? 'friend' : 'friends'}` : 'I’m in'} icon="flame"
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
                    {/* The stakes, said plainly, before anything else. */}
                    <View style={[styles.warning, { backgroundColor: t.tint('subtle', t.color.danger) }]}>
                        <Heartbeat icon="skull" color={t.color.danger} size={Spacing.xxl} />
                        <View style={styles.grow}>
                            <Text variant="heading">{`Day 1 starts ${invited.length ? 'tomorrow' : 'now'}.`}</Text>
                            <Text variant="bodySmall" tone="muted">{`Miss one rule, on one day, and it’s over${invited.length ? ' for all of you' : ''}. No cheat days. No second chances. ${chosen.days} days in a row, or nothing.`}</Text>
                        </View>
                    </View>
                    <Text variant="body" tone="muted">{chosen.summary}</Text>

                    {/* Every rule, its own card: what it is, and how it is checked. */}
                    <View style={styles.section}>
                        <GroupTitle>{`The rules, every day`}</GroupTitle>
                        {chosen.items.map((item, index) => <RuleCard key={item.name} item={item} index={index} />)}
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
            ) : creating ? (
                <CreateChallenge onMade={id => { challengeCatalog().then(found => { setList(found); setChosen(found.find(item => item.id === id) ?? null); setCreating(false); }).catch(() => setCreating(false)); }}
                    onCancel={() => setCreating(false)} />
            ) : (
                <View style={styles.body}>
                    {list === null ? null : (
                        <>
                            {list.filter(item => !item.custom).map((challenge, index) => (
                                <ListItem key={challenge.id} index={index}>
                                    <ChallengeCard challenge={challenge} big={index === 0} onPress={() => { mediumFeedback(); setChosen(challenge); }} />
                                </ListItem>
                            ))}
                            {list.some(item => item.custom) ? <GroupTitle>Yours and your friends’</GroupTitle> : null}
                            {list.filter(item => item.custom).map((challenge, index) => (
                                <ListItem key={challenge.id} index={index}>
                                    <ChallengeCard challenge={challenge} by={challenge.ownerId === meId ? 'By you' : 'By a friend'} onPress={() => { mediumFeedback(); setChosen(challenge); }} />
                                </ListItem>
                            ))}
                            {/* Your own: your rules, your days. */}
                            <Pressable onPress={() => { selectionFeedback(); setCreating(true); }} accessibilityRole="button" accessibilityLabel="Create your own challenge">
                                <View style={[styles.create, { borderColor: t.color.border }]}>
                                    <AppIcon name="add-circle" filled size={Spacing.xxl} color={t.color.accent} />
                                    <View style={styles.grow}>
                                        <Text variant="heading">Create your own</Text>
                                        <Text variant="caption" tone="muted">Your rules, 7 to 75 days, alone or with friends</Text>
                                    </View>
                                    <AppIcon name="chevron-forward" size={Spacing.lg} color={t.color.textSubtle} />
                                </View>
                            </Pressable>
                        </>
                    )}
                </View>
            )}
        </VoidSheet>
    );
}

const PROOF_ICON: Record<ChallengeItem['proof'], string> = { health: 'heart', focus: 'hourglass', photo: 'camera', tick: 'hand-right' };
const PROOF_SAID: Record<ChallengeItem['proof'], string> = {
    health: 'Apple Health counts it: it ticks itself',
    focus: 'The focus timer counts it',
    photo: 'A photo, taken there and then',
    tick: 'On your word',
};

/** One rule of a challenge, as its own card: its number, what it is, and how it is checked. */
function RuleCard({ item, index }: { item: ChallengeItem; index: number }) {
    const t = useTokens();
    const color = useLevelColor().hard;
    const amount = item.proof === 'health' && item.target ? `${item.target} ${item.unit ?? ''}`.trim() : item.proof === 'focus' && item.minutes ? `${item.minutes} min` : null;
    return (
        <ListItem index={index}>
            <View style={[styles.rule, { backgroundColor: t.color.surfaceRaised }]} accessible accessibilityLabel={`Rule ${index + 1}: ${item.name}. ${PROOF_SAID[item.proof]}`}>
                <View style={[styles.ruleNumber, { backgroundColor: t.tint('subtle', color) }]}><AppIcon name={(item.icon ?? 'checkmark-circle') as never} filled size={Spacing.xl} color={color} /></View>
                <View style={styles.grow}>
                    <Text variant="heading">{item.name}</Text>
                    <View style={styles.proof}>
                        <AppIcon name={PROOF_ICON[item.proof] as never} filled size={Spacing.md} color={t.color.textSubtle} />
                        <Text variant="caption" tone="muted">{`${PROOF_SAID[item.proof]}${amount ? ` · ${amount}` : ''}`}</Text>
                    </View>
                </View>
            </View>
        </ListItem>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.xl, paddingBottom: Spacing.lg },
    section: { gap: Spacing.sm },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.xs },
    warning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.card },
    rule: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.card },
    ruleNumber: { width: Control.hitTarget, height: Control.hitTarget, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
    proof: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    create: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.card, borderWidth: 1, borderStyle: 'dashed' },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.height + Spacing.sm },
    rewardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.height + Spacing.sm },
    grow: { flex: 1, gap: Spacing.xs / 2 },
    faces: { gap: Spacing.lg, paddingVertical: Spacing.md },
    face: { alignItems: 'center', gap: Spacing.xs, width: Control.height + Spacing.md },
    tick: { position: 'absolute', right: -Spacing.xs / 2, bottom: -Spacing.xs / 2, width: Spacing.xl, height: Spacing.xl, borderRadius: Spacing.xl / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
