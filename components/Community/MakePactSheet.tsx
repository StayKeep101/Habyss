import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Choices } from '@/components/Create/DetailBar';
import { Colors } from '@/constants/Colors';
import { FontFamily, surfaceFor } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { formatEmbers } from '@/lib/ember';
import { MIN_STAKE, checkStake } from '@/lib/pact';
import { Embers } from '@/lib/embers';
import { FriendsService, type Friend } from '@/lib/friendsService';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));
const STAKES = [10, 25, 50, 100, 250];
const LENGTHS = [
    { id: 0, label: 'Today' },
    { id: 6, label: 'A week' },
    { id: 29, label: 'A month' },
];

const dayAfter = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateKey(date);
};

/**
 * Making a promise to somebody, with something on it.
 *
 * Three questions and no more: who, what, how much. The deadline defaults to
 * today because the useful pact is nearly always the one about today — a month
 * is a resolution, and resolutions are what this app exists to replace.
 *
 * Both sides stake the same. An uneven pact is a loan with extra steps; it is
 * the equality that makes it a promise rather than a favour.
 */
export const MakePactSheet: React.FC<{
    visible: boolean;
    friends: Friend[];
    onClose: () => void;
    onMade: () => void;
}> = ({ visible, friends, onClose, onMade }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary: accent } = useAccentGradient();
    const { selectionFeedback, successFeedback } = useHaptics();

    const [habits, setHabits] = useState<Habit[]>([]);
    const [balance, setBalance] = useState(0);
    const [friendId, setFriendId] = useState<string | null>(null);
    const [habitId, setHabitId] = useState<string | null>(null);
    const [stake, setStake] = useState(25);
    const [days, setDays] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        let alive = true;
        getHabits()
            .then(all => { if (alive) setHabits(all.filter(habit => !habit.isGoal && !habit.isArchived)); })
            .catch(() => undefined);
        Embers.balance().then(found => { if (alive) setBalance(found); }).catch(() => undefined);
        return () => { alive = false; };
    }, [visible]);

    const chosen = useMemo(() => habits.find(habit => habit.id === habitId) ?? null, [habits, habitId]);
    const check = checkStake(stake, balance);
    const ready = !!friendId && !!chosen && check.ok;

    const make = async () => {
        if (!ready || !chosen || !friendId || saving) return;
        setSaving(true);
        setError(null);

        // Sharing it is the pact: it is not a promise if only one of you can
        // see whether it was kept.
        const shared = await FriendsService.shareHabitWithFriend(chosen.id, friendId);
        if (!shared) { setError('Could not share that habit. Try again.'); setSaving(false); return; }

        const made = await Embers.offer({
            toUserId: friendId,
            itemId: chosen.id,
            itemType: 'habit',
            itemName: chosen.name,
            stake: check.ok ? check.stake : MIN_STAKE,
            deadline: dayAfter(days),
        });
        setSaving(false);
        if (!made) { setError('Could not offer the pact. Try again.'); return; }

        successFeedback();
        onMade();
        onClose();
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader title="MAKE A PACT" onBack={onClose} backIcon="close" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.intro, { color: colors.textSecondary }]}>
                    You both put up the same. Keep it and you both get it back; if only one of you
                    does, they take the lot. If neither does, it is gone.
                </Text>

                <Section label="WITH" colors={colors}>
                    {friends.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textTertiary }]}>Add a friend first.</Text>
                    ) : (
                        <Choices
                            options={friends.map(friend => ({ id: friend.userId, label: `@${friend.username}` }))}
                            value={friendId ?? ''}
                            accent={accent}
                            onChange={id => { selectionFeedback(); setFriendId(id); }}
                        />
                    )}
                </Section>

                <Section label="ON" colors={colors}>
                    {habits.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textTertiary }]}>Make a habit first.</Text>
                    ) : (
                        <Choices
                            options={habits.slice(0, 12).map(habit => ({ id: habit.id, label: habit.name }))}
                            value={habitId ?? ''}
                            accent={accent}
                            onChange={id => { selectionFeedback(); setHabitId(id); }}
                        />
                    )}
                </Section>

                <Section label="UNTIL" colors={colors}>
                    <Choices
                        options={LENGTHS.map(length => ({ id: length.id, label: length.label }))}
                        value={days}
                        accent={accent}
                        onChange={id => { selectionFeedback(); setDays(id); }}
                    />
                </Section>

                <Section label="EACH" colors={colors}>
                    <Choices
                        options={STAKES.map(amount => ({ id: amount, label: String(amount) }))}
                        value={stake}
                        accent={accent}
                        onChange={amount => { selectionFeedback(); setStake(amount); }}
                    />
                    <Text style={[styles.balance, { color: check.ok ? colors.textTertiary : colors.error }]}>
                        {check.ok ? `You have ${formatEmbers(balance)}` : check.error}
                    </Text>
                </Section>

                <Animated.View layout={MORPH}>
                    <VoidCard matte style={styles.summary}>
                        <Ionicons name="flame" size={s(15)} color={accent} />
                        <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                            {chosen && friendId
                                ? `${formatEmbers(stake * 2)} on "${chosen.name}", ${days === 0 ? 'today' : `for ${days + 1} days`}.`
                                : 'Pick a friend and a habit.'}
                        </Text>
                    </VoidCard>
                </Animated.View>

                {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Offer the pact"
                    accessibilityState={{ disabled: !ready || saving }}
                    disabled={!ready || saving}
                    onPress={() => void make()}
                    style={[styles.offer, { backgroundColor: ready ? accent : tone.raised }]}
                >
                    {saving
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={[styles.offerText, { color: ready ? '#fff' : colors.textTertiary }]}>Offer the pact</Text>}
                </Pressable>
            </ScrollView>
        </VoidModal>
    );
};

const Section: React.FC<{ label: string; colors: typeof Colors.light; children: React.ReactNode }> = ({ label, colors, children }) => (
    <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
        {children}
    </View>
);

const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(16) },
    intro: { fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    section: { gap: vs(8) },
    label: { fontSize: ms(10), letterSpacing: 1.4, fontFamily: FontFamily.bold },
    empty: { fontSize: ms(13), fontFamily: FontFamily.regular },
    balance: { fontSize: ms(11), fontFamily: FontFamily.medium },
    summary: { flexDirection: 'row', alignItems: 'center', gap: s(9), padding: s(14) },
    summaryText: { flex: 1, fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    error: { fontSize: ms(12), fontFamily: FontFamily.medium },
    offer: { minHeight: 52, borderRadius: s(16), alignItems: 'center', justifyContent: 'center' },
    offerText: { fontSize: ms(15), fontFamily: FontFamily.semibold },
});
