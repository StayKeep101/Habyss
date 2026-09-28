import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService } from '@/lib/friendsService';
import { nameList, sharedState, type Participant } from '@/lib/shared';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/**
 * Who else is doing this habit, and whether it is waiting on anyone.
 *
 * Shown only when somebody else is actually on it: a card announcing that a
 * habit is yours alone is noise on every screen in the app.
 *
 * A friend's state is now exact: `shared_completions` records who finished
 * which item on which day, so "waiting on Sam" means Sam has not done *this*.
 * Before that table the only available answer was "did Sam do anything today",
 * which called them done because they had ticked something else.
 */
export const SharedWith: React.FC<{ habitId: string; doneToday: boolean }> = ({ habitId, doneToday }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();

    const [people, setPeople] = useState<Participant[] | null>(null);

    useEffect(() => {
        let alive = true;
        // Opening a shared habit is the other moment the cached list can be
        // stale: somebody may have shared this one with you since last time.
        void FriendsService.refreshSharedIds().catch(() => undefined);
        FriendsService.getSharedItemParticipants(habitId, 'habit')
            .then(rows => {
                if (!alive) return;
                setPeople(rows.map(row => ({
                    userId: row.userId,
                    username: row.username,
                    avatarUrl: row.avatarUrl,
                    // Your own state is known exactly, and it is *yours* — not
                    // the owner's. A habit a friend shared with you made them
                    // "you" here, and gave them your check-in.
                    done: row.isYou ? doneToday : !!row.completedToday,
                    isYou: !!row.isYou,
                })));
            })
            .catch(() => { if (alive) setPeople([]); });
        return () => { alive = false; };
    }, [habitId, doneToday]);

    // Alone on it, or not loaded: say nothing rather than reserve the space.
    if (!people || people.length < 2) return null;

    const state = sharedState(people);
    const tint = state.complete ? colors.success : state.waitingOnYou ? colors.warning : primary;

    return (
        <Animated.View entering={FadeIn.duration(220)} layout={MORPH}>
            <VoidCard
                glass={!isTrueDark}
                intensity={isLight ? 20 : 80}
                style={[styles.card, isLight && { backgroundColor: colors.surfaceSecondary }, { borderColor: tint + '44' }]}
            >
                <View style={styles.head}>
                    <Ionicons name={state.complete ? 'people' : 'people-outline'} size={s(16)} color={tint} />
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{state.line}</Text>
                </View>

                <View style={styles.faces}>
                    {state.people.map(person => (
                        <View
                            key={person.userId}
                            style={[styles.face, {
                                borderColor: person.done ? colors.success : colors.border,
                                backgroundColor: primary + '18',
                            }]}
                        >
                            {person.avatarUrl ? (
                                <Image source={{ uri: person.avatarUrl }} style={styles.photo} />
                            ) : (
                                <Text style={[styles.initial, { color: primary }]}>
                                    {(person.isYou ? 'you' : person.username).slice(0, 1).toUpperCase()}
                                </Text>
                            )}
                            {person.done ? (
                                <View style={[styles.tick, { backgroundColor: colors.success, borderColor: colors.background }]}>
                                    <Ionicons name="checkmark" size={s(8)} color="#fff" />
                                </View>
                            ) : null}
                        </View>
                    ))}
                </View>

                <Text style={[styles.foot, { color: colors.textTertiary }]}>
                    {state.complete
                        ? `${nameList(state.people)} all did this today.`
                        : `It counts once ${nameList(state.people)} have all done it.`}
                </Text>
            </VoidCard>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: { padding: s(16), gap: vs(10), borderWidth: StyleSheet.hairlineWidth },
    head: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    title: { flex: 1, fontSize: ms(14), fontFamily: FontFamily.semibold },
    faces: { flexDirection: 'row', gap: s(8) },
    face: { width: s(34), height: s(34), borderRadius: s(17), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
    photo: { width: '100%', height: '100%', borderRadius: s(17) },
    initial: { fontSize: ms(13), fontFamily: FontFamily.bold },
    // Outside the circle, so a clipped avatar cannot cut it off.
    tick: { position: 'absolute', right: -2, bottom: -2, width: s(14), height: s(14), borderRadius: s(7), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    foot: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
});
