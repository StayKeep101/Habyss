import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Avatar, CardRail, GameCard, IconButton, IconTile, ListItem, SectionTitle, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit, on } from '@/lib/appEvents';
import { canAnswer, DIFFICULTY_LABEL, leaveChallenge, myChallenges, respondChallenge, type Run } from '@/lib/challenges';
import { localDateKey } from '@/lib/habitSchedule';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { ChallengeIcon, DangerLink, DayStrip, FaceStack, Group, GroupTitle, ItemRow, MemberRow, Reward } from './ChallengeParts';
import { oopsTitle } from '@/lib/voice';

/** Day 3 of 14, from its first day; "Starts tomorrow" before it. */
function dayOf(run: Run, today = localDateKey(new Date())): string {
    if (run.starts > today) return 'Starts tomorrow';
    const day = Math.min(run.days, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${run.starts}T12:00:00`)) / 86_400_000) + 1);
    return `Day ${day} of ${run.days}`;
}

/** "Alone", "3 of you", "1 invited". */
function whoLine(run: Run): string {
    const joined = run.members.filter(member => member.status === 'joined').length;
    const invited = run.members.length - joined;
    if (invited) return `${invited} invited`;
    if (joined <= 1) return 'Alone';
    return `${joined} of you`;
}

const act = (run: () => Promise<void>, done?: () => void) => run().then(done)
    .catch((failed: unknown) => Alert.alert(oopsTitle(), failed instanceof Error ? failed.message : 'Try again in a moment.'));

/**
 * Challenges, on Community: invites waiting on you first (Join or Not now),
 * then the ones you're in, side by side: its icon, which day it is, your days
 * as small segments, and who's in it. The + opens the list to pick from.
 */
export function ChallengeSection({ style }: { style?: StyleProp<ViewStyle> }) {
    const t = useTokens();
    const [runs, setRuns] = useState<Run[] | null>(null);
    // The one opened, kept while its sheet slides away.
    const [open, setOpen] = useState<Run | null>(null);
    const [shown, setShown] = useState(false);
    const load = useCallback(() => { myChallenges().then(setRuns).catch(() => setRuns([])); }, []);
    useFocusEffect(load);
    useEffect(() => {
        const subs = [on('challenges_changed', load), on('market_changed', load)];
        return () => subs.forEach(sub => sub.remove());
    }, [load]);
    if (runs === null) return null;
    const pick = () => emit('show_challenges');
    const show = (run: Run) => { setOpen(run); setShown(true); };
    const today = localDateKey(new Date());
    const invites = runs.filter(run => canAnswer(run, today));
    const live = runs.filter(run => run.myStatus === 'joined' && (run.status === 'open' || run.status === 'active'));
    const ended = runs.filter(run => run.status === 'won' || run.status === 'failed');
    return (
        <View style={[styles.section, style]}>
            <SectionTitle first right={<IconButton icon="add" label="Pick a challenge" onPress={pick} />}>Your challenges</SectionTitle>
            {invites.map(run => <ListItem key={run.runId}><Invite run={run} onPress={() => show(run)} /></ListItem>)}
            {live.length ? (
                <CardRail>{live.map(run => <Running key={run.runId} run={run} onPress={() => show(run)} />)}</CardRail>
            ) : !invites.length ? (
                <GameCard onPress={pick} title="Pick a challenge" subtitle="Alone or with friends"
                    lead={<IconTile icon="trophy" color={t.color.accent} size={Control.hitTarget} shape="square" muted />}
                    badge={{ label: 'Up to 1000', tone: 'cobalt', icon: 'diamond' }} />
            ) : null}
            {ended.map(run => (
                <ListItem key={run.runId}>
                    <GameCard lead={<ChallengeIcon icon={run.status === 'won' ? 'trophy' : run.icon} difficulty={run.difficulty} />}
                        title={run.title} subtitle={run.status === 'won' ? `Done, together · +${run.reward} Shards` : 'A day was missed'}
                        badge={run.status === 'won' ? { label: 'Won', tone: 'success', icon: 'trophy' } : { label: 'Ended', tone: 'neutral' }} />
                </ListItem>
            ))}
            <RunSheet run={open} visible={shown} onClose={() => setShown(false)} />
        </View>
    );
}

function Invite({ run, onPress }: { run: Run; onPress: () => void }) {
    const { successFeedback } = useHaptics();
    const owner = run.members[0];
    return (
        <GameCard onPress={onPress} lead={<Avatar name={owner?.name ?? 'Friend'} uri={owner?.avatar} size={Control.hitTarget} />}
            title={`${owner?.name.split(' ')[0] ?? 'A friend'} invited you`} subtitle={`${run.title} · ${run.days} days`}
            badge={{ label: `${run.reward}`, tone: 'cobalt', icon: 'diamond' }}
            footer={(
                <View style={styles.buttons}>
                    <View style={styles.grow}><AppButton label="Decline" variant="ghost" onPress={() => void act(() => respondChallenge(run.runId, false))} /></View>
                    <View style={styles.grow}><AppButton label="Join" variant="primary" onPress={() => void act(() => respondChallenge(run.runId, true), successFeedback)} /></View>
                </View>
            )} />
    );
}

/** A challenge you're in: which day, your days as segments, and who's with you. */
function Running({ run, onPress }: { run: Run; onPress: () => void }) {
    const kept = run.myDays.length;
    return (
        <GameCard onPress={onPress} lead={<ChallengeIcon icon={run.icon} difficulty={run.difficulty} />}
            title={run.title} subtitle={`${dayOf(run)} · ${whoLine(run)}`}
            badge={{ label: `${run.reward}`, tone: 'cobalt', icon: 'diamond' }}
            accessibilityHint="Shows everyone's days and photos">
            <DayStrip kept={kept} days={run.days} />
            <View style={styles.between}>
                <FaceStack members={run.members} />
                <Text variant="bodySmall" tone="muted" numeric>{kept} of {run.days} days</Text>
            </View>
        </GameCard>
    );
}

/** One challenge, opened: the reward, what it asks, everyone's days, the latest photos. */
function RunSheet({ run, visible, onClose }: { run: Run | null; visible: boolean; onClose: () => void }) {
    const { mediumFeedback, successFeedback } = useHaptics();
    if (!run) return null;
    const invited = run.myStatus === 'invited';
    const together = run.members.length > 1;
    const leave = () => {
        mediumFeedback();
        Alert.alert(run.status === 'open' ? 'Leave this challenge?' : 'Give up?',
            run.status === 'open' ? 'It hasn’t started yet, so nothing is lost.'
                : together ? 'It’s all or nothing: giving up ends it for everyone, and nobody gets the Shards.' : 'It ends now, without the Shards.', [
                { text: 'Keep going', style: 'cancel' },
                { text: run.status === 'open' ? 'Leave' : 'Give up', style: 'destructive', onPress: () => void act(() => leaveChallenge(run.runId), onClose) },
            ]);
    };
    return (
        <VoidSheet visible={visible} onClose={onClose} title={run.title} caption={`${dayOf(run)} · ${DIFFICULTY_LABEL[run.difficulty]}`} scrollable maxShare={0.88}
            footer={(
                <View style={styles.footer}>
                    {invited ? (
                        <View style={styles.buttons}>
                            <View style={styles.grow}><AppButton label="Decline" variant="ghost" onPress={() => void act(() => respondChallenge(run.runId, false), onClose)} /></View>
                            <View style={styles.grow}><AppButton label="Join" variant="primary" onPress={() => void act(() => respondChallenge(run.runId, true), () => { successFeedback(); onClose(); })} /></View>
                        </View>
                    ) : <DangerLink label={run.status === 'open' ? 'Leave challenge' : 'Give up'} onPress={leave} />}
                </View>
            )}>
            <View style={styles.body}>
                <View style={styles.part}>
                    <GroupTitle>Reward</GroupTitle>
                    <Group>
                        <View style={styles.rewardRow}>
                            <View style={styles.grow}>
                                <Text variant="body">{together ? 'If everyone keeps every day' : 'If you keep every day'}</Text>
                                <Text variant="caption" tone="muted">{together ? 'One missed day by anyone ends it' : 'One missed day ends it'}</Text>
                            </View>
                            <Reward amount={run.reward} each={together} />
                        </View>
                    </Group>
                </View>
                <View style={styles.part}>
                    <GroupTitle>In your plan</GroupTitle>
                    <Group>{run.items.map(item => <ItemRow key={item.name} item={item} difficulty={run.difficulty} />)}</Group>
                </View>
                <View style={styles.part}>
                    <GroupTitle>People</GroupTitle>
                    <Group>{run.members.map(member => <MemberRow key={member.id} member={member} days={run.days} me={member.id === run.meId} />)}</Group>
                </View>
                {run.proofs.length ? (
                    <View style={styles.part}>
                        <GroupTitle>Proof</GroupTitle>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                            {run.proofs.map(proof => (
                                <Image key={proof.url} source={{ uri: proof.url }} style={styles.photo}
                                    accessibilityLabel={`${run.members.find(member => member.id === proof.user)?.name ?? 'Someone'}: ${proof.title}`} />
                            ))}
                        </ScrollView>
                    </View>
                ) : null}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.md },
    grow: { flex: 1, gap: Spacing.xs / 2 },
    buttons: { flexDirection: 'row', gap: Spacing.sm },
    between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    body: { gap: Spacing.xl, paddingBottom: Spacing.lg },
    part: { gap: Spacing.sm },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
    rewardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: Control.height + Spacing.sm },
    photos: { gap: Spacing.sm },
    photo: { width: Spacing.xxl * 4, height: Spacing.xxl * 5, borderRadius: Radius.card },
});
