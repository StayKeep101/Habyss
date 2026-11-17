import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AnimatedFill, AppButton, Avatar, CardRail, GameCard, IconButton, IconTile, ListItem, SectionTitle, Text, VoidSheet } from '@/components/ui';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { DIFFICULTY_LABEL, leaveChallenge, myChallenges, respondChallenge, type Run } from '@/lib/challenges';
import { localDateKey } from '@/lib/habitSchedule';
import { Control, Radius, Spacing } from '@/theme/designSystem';

const PROOF_WORD = { health: 'Apple Health', focus: 'Focus timer', photo: 'Photo' } as const;

/** Day 3 of 14, from its first day; "Starts tomorrow" before it. */
function dayOf(run: Run, today = localDateKey(new Date())): string {
    if (run.starts > today) return 'Starts tomorrow';
    const day = Math.min(run.days, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${run.starts}T12:00:00`)) / 86_400_000) + 1);
    return `Day ${day} of ${run.days}`;
}

/**
 * Challenges, on Community: invites waiting on you first (Join or Not now),
 * then the ones you're in, side by side (everyone's days as one bar, all or
 * nothing), then how the last ones ended. The + opens the list to pick from.
 */
export function ChallengeSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const [runs, setRuns] = useState<Run[] | null>(null);
    const [open, setOpen] = useState<Run | null>(null);
    const load = useCallback(() => { myChallenges().then(setRuns).catch(() => setRuns([])); }, []);
    useFocusEffect(load);
    useEffect(() => {
        const subs = [on('challenges_changed', load), on('market_changed', load)];
        return () => subs.forEach(sub => sub.remove());
    }, [load]);
    if (runs === null) return null;
    const pick = () => emit('show_challenges');
    const invites = runs.filter(run => run.myStatus === 'invited' && run.status === 'open');
    const live = runs.filter(run => run.myStatus === 'joined' && (run.status === 'open' || run.status === 'active'));
    const ended = runs.filter(run => run.status === 'won' || run.status === 'failed');
    return (
        <View style={[styles.section, style]}>
            <SectionTitle first right={<IconButton icon="add" label="Pick a challenge" onPress={pick} />}>Your challenges</SectionTitle>
            {invites.map(run => <ListItem key={run.runId}><Invite run={run} /></ListItem>)}
            {live.length ? (
                <CardRail>{live.map(run => <Running key={run.runId} run={run} onPress={() => setOpen(run)} />)}</CardRail>
            ) : !invites.length ? (
                <GameCard onPress={pick} title="Pick a challenge" subtitle="Alone or with friends"
                    lead={<IconTile icon="trophy" color={t.color.cobalt} size={Control.hitTarget} />}
                    badge={{ label: 'Up to 1000', tone: 'cobalt', icon: 'diamond' }} />
            ) : null}
            {ended.map(run => (
                <ListItem key={run.runId}>
                    <GameCard lead={<IconTile icon={run.status === 'won' ? 'trophy' : 'flag'} color={run.status === 'won' ? t.color.cobalt : t.color.textMuted} size={Control.hitTarget} />}
                        title={run.title} subtitle={run.status === 'won' ? `Done, together · +${run.reward} Shards` : 'A day was missed · ended'}
                        badge={run.status === 'won' ? { label: 'Won', tone: 'success', icon: 'trophy' } : { label: 'Ended', tone: 'neutral' }} />
                </ListItem>
            ))}
            <RunSheet run={open} onClose={() => setOpen(null)} />
        </View>
    );
}

function Invite({ run }: { run: Run }) {
    const { successFeedback } = useHaptics();
    const owner = run.members[0];
    const act = (accept: boolean) => respondChallenge(run.runId, accept).then(() => successFeedback())
        .catch((failed: unknown) => Alert.alert('That didn’t go through', failed instanceof Error ? failed.message : 'Try again in a moment.'));
    return (
        <GameCard lead={<Avatar name={owner?.name ?? 'Friend'} uri={owner?.avatar} size={Control.hitTarget} />}
            title={`${owner?.name.split(' ')[0] ?? 'A friend'} invited you`} subtitle={`${run.title} · ${run.days} days · ${run.reward} Shards each`}
            badge={{ label: 'New', tone: 'cobalt', icon: 'trophy' }}
            footer={(
                <View style={styles.buttons}>
                    <View style={styles.grow}><AppButton label="Not now" variant="ghost" onPress={() => void act(false)} /></View>
                    <View style={styles.grow}><AppButton label="Join" icon="trophy" variant="primary" onPress={() => void act(true)} /></View>
                </View>
            )} />
    );
}

/** A challenge under way: the group's days as one bar, and everyone's faces. */
function Running({ run, onPress }: { run: Run; onPress: () => void }) {
    const t = useTokens();
    const joined = run.members.filter(member => member.status === 'joined');
    const kept = joined.reduce((sum, member) => sum + member.kept, 0);
    const share = joined.length ? kept / (joined.length * run.days) : 0;
    return (
        <GameCard onPress={onPress} lead={<IconTile icon={run.icon as never} color={t.color.cobalt} size={Control.hitTarget} />}
            title={run.title} subtitle={`${dayOf(run)} · ${joined.length === 1 ? 'Alone' : `${joined.length} of you`}`}
            badge={{ label: `${run.reward}`, tone: 'cobalt', icon: 'diamond' }}
            accessibilityHint="Shows everyone's days and photos">
            <View style={[styles.track, { backgroundColor: t.color.border }]}>
                <AnimatedFill progress={share} style={[styles.fill, { backgroundColor: t.color.cobalt }]} replay={run.runId} />
            </View>
            <View style={styles.faces}>
                {joined.map(member => <Avatar key={member.id} name={member.name} uri={member.avatar} size={Spacing.xl} />)}
            </View>
        </GameCard>
    );
}

/** One challenge, opened: what it asks, everyone's days, the latest photos, and Give up. */
function RunSheet({ run, onClose }: { run: Run | null; onClose: () => void }) {
    const t = useTokens();
    const { mediumFeedback } = useHaptics();
    if (!run) return <VoidSheet visible={false} onClose={onClose} title=""><View /></VoidSheet>;
    const together = run.members.filter(member => member.status === 'joined').length > 1;
    const leave = () => {
        mediumFeedback();
        Alert.alert(run.status === 'open' ? 'Leave this challenge?' : 'Give up?',
            run.status === 'open' ? 'It hasn’t started yet, so nothing is lost.'
                : together ? 'It’s all or nothing: giving up ends it for everyone, and nobody gets the Shards.' : 'It ends now, without the Shards.', [
                { text: 'Keep going', style: 'cancel' },
                { text: run.status === 'open' ? 'Leave' : 'Give up', style: 'destructive', onPress: () => {
                    void leaveChallenge(run.runId).then(onClose).catch((failed: unknown) => Alert.alert('That didn’t go through', failed instanceof Error ? failed.message : 'Try again.'));
                } },
            ]);
    };
    return (
        <VoidSheet visible onClose={onClose} title={run.title} caption={`${dayOf(run)} · ${DIFFICULTY_LABEL[run.difficulty]}`} scrollable maxShare={0.85}
            footer={<View style={styles.footer}><AppButton label={run.status === 'open' ? 'Leave' : 'Give up'} variant="danger" onPress={leave} /></View>}>
            <View style={styles.body}>
                <View style={styles.reward}>
                    <ShardIcon size={Control.icon} />
                    <Text variant="heading">{run.reward} Shards each</Text>
                    <Text variant="bodySmall" tone="muted">{together ? 'if everyone keeps every day' : 'if you keep every day'}</Text>
                </View>
                <View style={styles.list}>
                    {run.items.map(item => (
                        <View key={item.name} style={styles.line}>
                            <IconTile icon={(item.icon ?? 'checkmark') as never} color={t.color.cobalt} size={Control.hitTarget - Spacing.sm} />
                            <View style={styles.grow}>
                                <Text variant="body" numberOfLines={1}>{item.name}</Text>
                                <Text variant="caption" tone="muted">{item.kind === 'task' ? 'Once, by the last day' : 'Every day'} · {PROOF_WORD[item.proof]}</Text>
                            </View>
                        </View>
                    ))}
                </View>
                <View style={styles.list}>
                    {run.members.map(member => (
                        <View key={member.id} style={styles.line}>
                            <Avatar name={member.name} uri={member.avatar} size={Control.hitTarget - Spacing.sm} />
                            <View style={styles.grow}><Text variant="body" numberOfLines={1}>{member.name}</Text></View>
                            <Text variant="bodySmall" tone="muted" numeric>{member.status === 'invited' ? 'Invited' : `${member.kept} / ${run.days}`}</Text>
                        </View>
                    ))}
                </View>
                {run.proofs.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                        {run.proofs.map(proof => (
                            <Image key={proof.url} source={{ uri: proof.url }} style={styles.photo}
                                accessibilityLabel={`${run.members.find(member => member.id === proof.user)?.name ?? 'Someone'}: ${proof.title}`} />
                        ))}
                    </ScrollView>
                ) : null}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    grow: { flex: 1 },
    buttons: { flexDirection: 'row', gap: Spacing.sm },
    track: { height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
    faces: { flexDirection: 'row', gap: Spacing.xs },
    body: { gap: Spacing.xl, paddingBottom: Spacing.lg },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
    reward: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    list: { gap: Spacing.md },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.hitTarget },
    photos: { gap: Spacing.sm },
    photo: { width: Spacing.xxl * 3, height: Spacing.xxl * 4, borderRadius: Radius.small },
});
