import React, { useState } from 'react';
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
    AppButton, AppIcon, AppTextField, Avatar, ChoicePill, Crown, GameCard, IconTile, ListItem, SectionTitle, SheetSection, Text, VoidCard, VoidSheet,
} from '@/components/ui';
import { AnimatedFill, CountUp } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import type { CrewWeek } from '@/hooks/useCrewWeek';
import { CHALLENGE_PRESETS, MISSION_MARKS, issueChallenge, joinChallenge, missionText, revealText, type Mission } from '@/lib/weekly';
import { Control, Radius, Spacing } from '@/theme/designSystem';

const endsLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });

/**
 * Community's This week, the crew's week in one place: who wears the crown
 * and the race for the next one, the king's challenge, the crew quest (passed
 * in, it has its own card), then your secret mission and last week's secrets.
 */
export function WeekView({ week, meId, quest, style }: { week: CrewWeek; meId: string | null; quest?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    return (
        <View style={[styles.stack, style]}>
            <SectionTitle first>King of the Week</SectionTitle>
            <KingCard week={week} meId={meId} />
            {week.challenges.map(challenge => (
                <ListItem key={challenge.kingId}>
                    <ChallengeCard challenge={challenge} weekFrom={week.week.from} mine={challenge.kingId === meId} onChanged={week.reload} />
                </ListItem>
            ))}

            {/* The crew quest titles itself, and stays away with fewer than two in the crew. */}
            {quest}

            {/* Yours alone, so last: the shared things come first. */}
            <SectionTitle>Secret mission</SectionTitle>
            <MissionCard mission={week.mission} />
            {week.revealed.length ? <RevealedCard week={week} /> : null}
        </View>
    );
}

/** The crown: who holds it this week (last week's most consistent), and the race for next week's. */
function KingCard({ week, meId }: { week: CrewWeek; meId: string | null }) {
    const t = useTokens();
    const [setting, setSetting] = useState(false);
    const { king, race } = week;
    const youRule = !!king && king.userId === meId;
    const leader = race.find(person => person.days > 0);
    const myPlace = race.findIndex(person => person.userId === meId);
    const top = race.slice(0, 3);
    const hasChallenge = week.challenges.some(challenge => challenge.kingId === meId);
    return (
        <VoidCard style={styles.card}>
            {king ? (
                <View style={styles.head}>
                    <Avatar name={king.name} uri={king.avatarUrl} size={Control.hitTarget + Spacing.md} ring={t.color.silver} badge={<Crown size={Spacing.lg + 2} />} />
                    <View style={styles.grow}>
                        <View style={styles.nameRow}>
                            <Text variant="title" numberOfLines={1}>{youRule ? 'You' : king.name}</Text>
                            <Crown size={Spacing.lg} />
                        </View>
                        <Text variant="bodySmall" tone="muted">{`${youRule ? 'Hold' : 'Holds'} the crown · ${king.days} of 7 days last week`}</Text>
                    </View>
                </View>
            ) : (
                <View style={styles.head}>
                    <View style={[styles.empty, { backgroundColor: t.tint('subtle', t.color.silver) }]}><Crown size={Control.icon + 4} /></View>
                    <View style={styles.grow}>
                        <Text variant="title">The crown is free</Text>
                        <Text variant="bodySmall" tone="muted">Show up the most days this week and it’s yours next week.</Text>
                    </View>
                </View>
            )}

            {/* The race for next week's crown: the top three this week, and where you are. */}
            {top.length ? (
                <View style={styles.race}>
                    <Text variant="caption" tone="muted">This week’s race</Text>
                    {top.map((person, index) => (
                        <View key={person.userId} style={styles.raceRow}>
                            <Text variant="caption" tone="muted" numeric>{String(index + 1)}</Text>
                            <Avatar name={person.name} uri={person.avatarUrl} size={Spacing.xxl} />
                            <View style={styles.grow}><Text variant="bodySmall" numberOfLines={1}>{person.userId === meId ? 'You' : person.name}</Text></View>
                            <View style={[styles.track, { backgroundColor: t.color.surfaceRaised }]}>
                                <AnimatedFill progress={person.days / 7} style={[styles.fill, { backgroundColor: index === 0 ? t.color.silver : t.color.cobalt }]} />
                            </View>
                            <Text variant="caption" numeric>{`${person.days}d`}</Text>
                        </View>
                    ))}
                    {myPlace >= 3 ? <Text variant="caption" tone="muted">{`You’re #${myPlace + 1}. ${leader ? `${leader.days - race[myPlace].days} days behind.` : ''}`}</Text> : null}
                </View>
            ) : null}

            {youRule && !hasChallenge ? (
                <AppButton label="Set this week’s challenge" icon="flash" onPress={() => setSetting(true)} />
            ) : null}
            <ChallengeSheet visible={setting} weekFrom={week.week.from} onClose={() => setSetting(false)} onSet={week.reload} />
        </VoidCard>
    );
}

/** The king's challenge for the crew: what it is, who's in, and the way in. */
function ChallengeCard({ challenge, weekFrom, mine, onChanged }: { challenge: CrewWeek['challenges'][number]; weekFrom: string; mine: boolean; onChanged: () => void }) {
    const t = useTokens();
    const { successFeedback } = useHaptics();
    const join = () => {
        joinChallenge(challenge.kingId, weekFrom)
            .then(() => { successFeedback(); onChanged(); })
            .catch((failed: unknown) => Alert.alert('Couldn’t join', failed instanceof Error ? failed.message : 'Try again in a moment.'));
    };
    return (
        <GameCard
            lead={<IconTile icon="flash" color={t.color.silver} size={Control.hitTarget} />}
            title={challenge.text}
            subtitle={mine ? 'Your challenge' : `${challenge.kingName}’s challenge`}
            badge={challenge.joinedByMe ? { label: 'You’re in', tone: 'cobalt', icon: 'checkmark' }
                : { label: challenge.joined ? `${challenge.joined} in` : 'Be first', tone: challenge.joined ? 'accent' : 'neutral', icon: 'people' }}
            footer={!mine && !challenge.joinedByMe ? <AppButton label="I’m in" icon="hand-right" onPress={join} /> : null} />
    );
}

/** Your secret mission: what to get your friend to do, how far along, what it's worth. Only you see it. */
function MissionCard({ mission }: { mission: Mission | null }) {
    const t = useTokens();
    if (!mission) {
        return (
            <GameCard lead={<IconTile icon="eye-off" color={t.color.textMuted} size={Control.hitTarget} />}
                title="No mission yet" subtitle="Add a friend and one arrives each week" />
        );
    }
    return (
        <GameCard
            lead={<Avatar name={mission.friendName} uri={mission.friendAvatar} size={Control.hitTarget} badge={<AppIcon name="eye-off" filled size={Spacing.md} color={t.color.textPrimary} />} />}
            title={missionText(mission.kind, mission.friendName, mission.target)}
            subtitle={mission.completed ? 'Secret until the week ends' : `Only you see this · ends ${endsLabel(mission.ends)}`}
            badge={mission.completed ? { label: `+${MISSION_MARKS} Marks`, tone: 'cobalt', icon: 'checkmark' } : { label: `+${MISSION_MARKS} Marks`, tone: 'cobalt' }}>
            <View style={styles.progress} accessible accessibilityLabel={`${mission.progress} of ${mission.target}`}>
                <View style={[styles.track, styles.grow, { backgroundColor: t.color.surfaceRaised }]}>
                    <AnimatedFill progress={mission.progress / mission.target} style={[styles.fill, { backgroundColor: mission.completed ? t.color.cobalt : t.color.cobalt }]} />
                </View>
                <CountUp value={`${mission.progress}/${mission.target}`} style={[t.type.heading, { color: t.color.textPrimary }]} />
            </View>
        </GameCard>
    );
}

/** Last week's secrets, now out: the ones about you, and how yours went. */
function RevealedCard({ week }: { week: CrewWeek }) {
    return (
        <VoidCard style={styles.card}>
            <Text variant="caption" tone="muted">Secrets from last week</Text>
            {week.revealed.map((item, index) => (
                <View key={`${item.ownerName}-${index}`} style={styles.head}>
                    <Avatar name={item.mine ? item.friendName : item.ownerName} uri={item.mine ? undefined : item.ownerAvatar} size={Spacing.xxl + Spacing.sm} />
                    <View style={styles.grow}><Text variant="bodySmall">{revealText(item)}</Text></View>
                </View>
            ))}
        </VoidCard>
    );
}

/** The king sets the crew's challenge: one of a few, or their own words. */
function ChallengeSheet({ visible, weekFrom, onClose, onSet }: { visible: boolean; weekFrom: string; onClose: () => void; onSet: () => void }) {
    const t = useTokens();
    const { successFeedback, selectionFeedback } = useHaptics();
    const [chosen, setChosen] = useState<string>(CHALLENGE_PRESETS[0]);
    const [own, setOwn] = useState('');
    const [busy, setBusy] = useState(false);
    const text = own.trim() || chosen;
    const send = async () => {
        setBusy(true);
        try {
            await issueChallenge(weekFrom, text);
            successFeedback();
            onSet();
            onClose();
        } catch (failed) {
            Alert.alert('Couldn’t set it', failed instanceof Error ? failed.message : 'Try again in a moment.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Your challenge" caption="For your crew, this week" scrollable
            footer={<View style={styles.footer}><AppButton label="Set the challenge" icon="flash" loading={busy} disabled={text.length < 3} onPress={() => { void send(); }} /></View>}>
            <SheetSection first title="Pick one" description="Your crew gets a notification and can say they’re in.">
                <View style={styles.pills}>
                    {CHALLENGE_PRESETS.map(preset => (
                        <ChoicePill key={preset} label={preset} lines={2} on={!own.trim() && chosen === preset} color={t.color.accent} radius={Radius.control}
                            onPress={() => { selectionFeedback(); setOwn(''); setChosen(preset); }} />
                    ))}
                </View>
            </SheetSection>
            <SheetSection title="Or your own">
                <AppTextField label="Challenge" value={own} onChangeText={setOwn} placeholder="Read 20 pages a day" maxLength={90} />
            </SheetSection>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    stack: { gap: Spacing.md },
    card: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    grow: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    empty: { width: Control.hitTarget, height: Control.hitTarget, borderRadius: Control.hitTarget / 2, alignItems: 'center', justifyContent: 'center' },
    race: { gap: Spacing.sm },
    raceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    track: { width: Control.hitTarget * 1.6, height: Spacing.xs + 2, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
    progress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    pills: { gap: Spacing.sm },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});

