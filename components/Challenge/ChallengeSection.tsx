import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppButton, Avatar, CardRail, GameCard, ListItem, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { canAnswer, DIFFICULTY_LABEL, leaveChallenge, myChallenges, respondChallenge, type Run } from '@/lib/challenges';
import { Heartbeat } from './ChallengeCard';
import { LinearGradient } from 'expo-linear-gradient';
import { CountUp, MatteSurface } from '@/components/ui';
import { localDateKey } from '@/lib/habitSchedule';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { ChallengeIcon, DangerLink, DayStrip, FaceStack, Group, GroupTitle, ItemRow, MemberRow, Reward, useLevelColor } from './ChallengeParts';
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
export function ChallengeSection({ style, onShown }: { style?: StyleProp<ViewStyle>; onShown?: (shown: boolean) => void }) {
    const [runs, setRuns] = useState<Run[] | null>(null);
    // The one opened, kept while its sheet slides away.
    const [open, setOpen] = useState<Run | null>(null);
    const [sheetShown, setSheetShown] = useState(false);
    const load = useCallback(() => { myChallenges().then(setRuns).catch(() => setRuns([])); }, []);
    useFocusEffect(load);
    useEffect(() => {
        const subs = [on('challenges_changed', load), on('market_changed', load)];
        return () => subs.forEach(sub => sub.remove());
    }, [load]);
    const today = localDateKey(new Date());
    const invites = (runs ?? []).filter(run => canAnswer(run, today));
    const live = (runs ?? []).filter(run => run.myStatus === 'joined' && (run.status === 'open' || run.status === 'active'));
    const ended = (runs ?? []).filter(run => run.status === 'won' || run.status === 'failed');
    // Tells the page whether there is anything here, so an empty page can say where new ones come from.
    const shown = invites.length + live.length + ended.length > 0;
    const loaded = runs !== null;
    useEffect(() => { if (loaded) onShown?.(shown); }, [loaded, shown, onShown]);
    if (!loaded) return null;
    const show = (run: Run) => { setOpen(run); setSheetShown(true); };
    return (
        <View style={[styles.section, style]}>
            {/* No title: the page's own heading says Challenges. A new one is picked from the + button. */}
            {invites.map(run => <ListItem key={run.runId}><Invite run={run} onPress={() => show(run)} /></ListItem>)}
            {live.length ? <CardRail>{live.map(run => <Running key={run.runId} run={run} onPress={() => show(run)} />)}</CardRail> : null}
            {ended.map(run => (
                <ListItem key={run.runId}>
                    <GameCard lead={<ChallengeIcon icon={run.status === 'won' ? 'trophy' : run.icon} difficulty={run.difficulty} />}
                        title={run.title} subtitle={run.status === 'won' ? `Done, together · +${run.reward} Shards` : 'A day was missed'}
                        badge={run.status === 'won' ? { label: 'Won', tone: 'success', icon: 'trophy' } : { label: 'Ended', tone: 'neutral' }} />
                </ListItem>
            ))}
            <RunSheet run={open} visible={sheetShown} onClose={() => setSheetShown(false)} />
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

/**
 * A challenge you're in, as a card that keeps the pressure on: which day,
 * huge, out of how many; your days as segments; how many rules today; who's
 * in it with you (one miss by anyone ends it for all).
 */
function Running({ run, onPress }: { run: Run; onPress: () => void }) {
    const t = useTokens();
    const color = useLevelColor()[run.difficulty];
    const kept = run.myDays.length;
    const today = localDateKey(new Date());
    const day = run.starts > today ? 0 : Math.min(run.days, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${run.starts}T12:00:00`)) / 86_400_000) + 1);
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${run.title}. ${dayOf(run)}. ${kept} of ${run.days} days kept. ${whoLine(run)}`}
            accessibilityHint="Shows everyone's days and photos">
            <MatteSurface radius={Radius.card} elevation="floating" style={styles.running}>
                <LinearGradient pointerEvents="none" colors={[t.tint('soft', color), 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={styles.between}>
                    <Text variant="heading" numberOfLines={1} grow>{run.title}</Text>
                    <Heartbeat icon={run.icon} color={color} size={Spacing.xxl} />
                </View>
                <View style={styles.dayRow}>
                    {day > 0 ? (
                        <>
                            <Text variant="caption" tone="muted">Day</Text>
                            <CountUp value={String(day)} style={[t.type.display, { color: t.color.textPrimary }]} />
                            <Text variant="heading" tone="muted">{`of ${run.days}`}</Text>
                        </>
                    ) : <Text variant="title">Starts tomorrow</Text>}
                </View>
                <DayStrip kept={kept} days={run.days} />
                <View style={styles.between}>
                    <FaceStack members={run.members} />
                    <Text variant="caption" tone="danger">{`${run.items.length} rules today · miss one, it’s over`}</Text>
                </View>
            </MatteSurface>
        </Pressable>
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
    running: { padding: Spacing.lg, gap: Spacing.md, overflow: 'hidden' },
    dayRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
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
