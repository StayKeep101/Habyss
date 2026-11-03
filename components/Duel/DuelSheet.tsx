import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton, Avatar, EmptyState, HoldButton, Receipt, StepSlider, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, type Friend } from '@/lib/friendsService';
import { DUEL_LENGTHS, DUEL_STAKES, createDuel } from '@/lib/duels';
import { Control, Spacing } from '@/theme/designSystem';

/**
 * Challenge a friend: tap their face, slide how long and what's at stake,
 * send. Who keeps their own plan better wins; with a stake, takes both.
 */
export function DuelSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [friends, setFriends] = useState<Friend[] | null>(null);
    const [friend, setFriend] = useState<string | null>(null);
    const [days, setDays] = useState<(typeof DUEL_LENGTHS)[number]>(7);
    const [stake, setStake] = useState<(typeof DUEL_STAKES)[number]>(25);
    const [sending, setSending] = useState(false);
    // Sent: the sheet becomes the receipt, then closes.
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setFriend(null);
        setSent(false);
        FriendsService.getFriends().then(setFriends).catch(() => setFriends([]));
    }, [visible]);

    const send = () => {
        if (!friend || sending) return;
        setSending(true);
        createDuel(friend, stake, days)
            .then(() => setSent(true))
            .catch((failed: unknown) => Alert.alert('Couldn’t send it', failed instanceof Error ? failed.message : 'Try again in a moment.'))
            .finally(() => setSending(false));
    };

    return (
        <VoidSheet visible={visible} onClose={onClose} title="Duel a friend" caption="Who keeps their own plan better"
            footer={friends?.length && !sent ? (
                <View style={styles.footer}>
                    {/* With Shards on it, held like paying; for pride, one tap. */}
                    {stake && friend ? <HoldButton label={`Hold to stake ${stake} Shards`} icon="flash" loading={sending} onComplete={send} />
                        : <AppButton label="Send challenge" icon="flash" disabled={!friend} loading={sending} onPress={send} />}
                </View>
            ) : undefined}>
            {sent ? (
                <Receipt title="Challenge sent" amount={stake ? -stake : undefined}
                    line={`${days} days against ${(friends?.find(item => item.userId === friend)?.displayName ?? 'your friend').split(' ')[0]}. Starts the day after they accept.`}
                    onDone={onClose} />
            ) : null}
            {sent ? null : <View style={styles.body}>
                {friends === null ? null : friends.length === 0 ? (
                    <EmptyState icon="people" title="No friends yet" message="Add a friend on Community to duel them." />
                ) : (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces}>
                            {friends.map(item => {
                                const on = friend === item.userId;
                                return (
                                    <Pressable key={item.userId} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={item.displayName ?? item.username}
                                        onPress={() => { selectionFeedback(); setFriend(item.userId); }} style={styles.face}>
                                        <Avatar name={item.displayName ?? item.username} uri={item.avatarUrl} size={Control.height} ring={on ? t.color.accent : undefined} dim={!!friend && !on} />
                                        <Text variant="caption" tone={on ? 'accent' : 'muted'} align="center">{(item.displayName ?? item.username).split(' ')[0]}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <StepSlider label="How long" values={DUEL_LENGTHS} value={days} onChange={setDays} say={value => `${value} days`} />
                        <StepSlider label="At stake, each" values={DUEL_STAKES} value={stake} onChange={setStake}
                            say={value => (value === 0 ? 'Just pride' : `${value} Shards`)} />
                        <Text variant="caption" tone="muted" align="center">
                            {stake ? `Winner takes ${stake * 2}. A draw gives both back.` : 'Starts tomorrow, so nobody gets a head start.'}
                        </Text>
                    </>
                )}
            </View>}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.xl, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    faces: { gap: Spacing.md, paddingVertical: Spacing.xs },
    face: { alignItems: 'center', gap: Spacing.xs, minWidth: Control.height },
    footer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
