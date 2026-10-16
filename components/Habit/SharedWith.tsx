import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ListItem } from '@/components/ui/Motion';
import { ValuePill } from '@/components/Goal/GoalRows';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { FriendsService } from '@/lib/friendsService';
import { sharedState, type Participant } from '@/lib/shared';
import { currentProfile } from '@/lib/profile';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));
const FACE = 36;

/**
 * Who else is on this habit, and who it is still waiting on.
 *
 * The same card as the rest of the page: a section title, then one matte card
 * with a row per person — their face, their name, and where they stand today.
 * It updates live: when a friend ticks it, their row turns to Done.
 *
 * Shown only when somebody else is actually on it.
 */
export const SharedWith: React.FC<{ habitId: string; doneToday: boolean }> = ({ habitId, doneToday }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary } = useAccentGradient();
    const [people, setPeople] = useState<Participant[] | null>(null);

    const load = useCallback(() => {
        return FriendsService.getSharedItemParticipants(habitId, 'habit')
            .then(rows => rows.map(row => ({
                userId: row.userId,
                username: row.username,
                // Your own face from the one profile store.
                avatarUrl: row.isYou ? currentProfile().avatar ?? undefined : row.avatarUrl,
                // Your own state is known exactly on this phone.
                done: row.isYou ? doneToday : !!row.completedToday,
                isYou: !!row.isYou,
                pending: !!row.pending,
            })))
            .catch(() => [] as Participant[]);
    }, [habitId, doneToday]);

    useEffect(() => {
        let alive = true;
        void FriendsService.refreshSharedIds().catch(() => undefined);
        void load().then(list => { if (alive) setPeople(list); });
        // A friend ticking it shows here without leaving the page.
        let stop: (() => void) | undefined;
        const { listenToFriends } = require('@/lib/livePulse') as typeof import('@/lib/livePulse');
        void listenToFriends(() => { void load().then(list => { if (alive) setPeople(list); }); })
            .then(unsubscribe => { stop = unsubscribe; });
        return () => { alive = false; stop?.(); };
    }, [load]);

    if (!people || people.length < 2) return null;

    const state = sharedState(people);
    const status = (person: Participant) => person.pending
        ? { label: 'Invited', tone: colors.textTertiary }
        : person.done ? { label: 'Done', tone: colors.success } : { label: 'Waiting', tone: colors.textSecondary };

    return (
        <Animated.View entering={FadeIn.duration(220)} layout={MORPH} style={styles.wrap}>
            <SectionTitle>Together</SectionTitle>
            <VoidCard style={styles.card}>
                {state.people.map((person, index) => {
                    const { label, tone: statusTone } = status(person);
                    return (
                        <ListItem key={person.userId} index={index}>
                            <View style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                <View style={{ width: FACE, height: FACE, opacity: person.pending ? 0.6 : 1 }}>
                                    <View style={[styles.face, { backgroundColor: tone.raised, borderColor: person.done ? colors.success : tone.fill }]}>
                                        {person.avatarUrl
                                            ? <Image source={{ uri: person.avatarUrl }} style={styles.photo} />
                                            : <Text style={[styles.initial, { color: primary }]}>{(person.isYou ? 'You' : person.username).slice(0, 1).toUpperCase()}</Text>}
                                    </View>
                                    {person.done ? (
                                        <View style={[styles.tick, { backgroundColor: colors.success, borderColor: tone.fill }]}>
                                            <AppIcon name="checkmark" size={10} color={colors.background} />
                                        </View>
                                    ) : null}
                                </View>
                                <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>
                                    {person.isYou ? 'You' : person.username}
                                </Text>
                                <ValuePill value={label} tone={statusTone} />
                            </View>
                        </ListItem>
                    );
                })}
            </VoidCard>
            {/* The rule, once, and only while it matters. */}
            {!state.complete && state.total > 1 ? (
                <Text style={[styles.foot, { color: colors.textTertiary }]}>Counts for everyone once everyone's done it.</Text>
            ) : null}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: { marginTop: Spacing.xl },
    card: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    face: { width: FACE, height: FACE, borderRadius: FACE / 2, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%', resizeMode: 'cover' },
    initial: { fontSize: 14, fontFamily: FontFamily.bold },
    tick: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    name: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium },
    foot: { fontSize: 12, lineHeight: 18, fontFamily: FontFamily.regular, marginTop: Spacing.sm },
});
