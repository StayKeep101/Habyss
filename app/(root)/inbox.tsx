import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { ChoiceSheet } from '@/components/ui/ChoiceSheet';
import { Colors } from '@/theme/colors';
import { FontFamily, surfaceFor } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, type InboxItem } from '@/lib/friendsService';
import { emit } from '@/lib/appEvents';
import { groupInbox, isAnswerable, type InboxGroup } from '@/lib/inboxGroups';
import { styles } from '@/styles/screens/inbox.styles';

/** What an empty inbox says, one more each time you pull down to check again. */
const EMPTY_LINES = [
    'Nothing here',
    'Still nothing here',
    'Yep. Still nothing.',
    'Refreshing won’t make friends appear',
    'The inbox is enjoying the quiet',
    'Have you tried having friends?',
    'Echo says hi. That’s it.',
    'Somewhere, a friend request is being typed. Probably.',
    'Okay, now you’re just bored',
    'Go do a habit instead',
];

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

const LOOK: Record<InboxItem['kind'], { icon: string; tint: (colors: typeof Colors.light, accent: string) => string }> = {
    friend_request: { icon: 'person-add', tint: (_colors, accent) => accent },
    friend_accepted: { icon: 'checkmark-circle', tint: colors => colors.success },
    nudge: { icon: 'hand-right', tint: colors => colors.warning },
    // A friend sent a streak freeze (Echo's "help your friend out").
    freeze_gift: { icon: 'snow', tint: () => '#64D2FF' },
    // Raised by the app itself — a reminder that fired, a streak, a milestone.
    local: { icon: 'notifications', tint: (_colors, accent) => accent },
    share_offer: { icon: 'share-social', tint: (_colors, accent) => accent },
    share_accepted: { icon: 'checkmark-circle', tint: colors => colors.success },
    share_declined: { icon: 'close-circle', tint: colors => colors.textTertiary },
    shared_done: { icon: 'checkmark-done', tint: colors => colors.success },
    challenge: { icon: 'trophy', tint: (_colors, accent) => accent },
};

/** "3 hours ago", without pulling in a date library for one line. */
function ago(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (!Number.isFinite(minutes)) return '';
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
}

/**
 * What people have sent you.
 *
 * A friend request used to be a row in a table with nowhere to appear: unless
 * the person happened to open the Community tab and scroll past the feed, they
 * never knew they had been asked. This is the place it waits, and the place it
 * is answered — accepting from here is the same call the tab makes, so the two
 * cannot disagree about what a pending request is.
 */
export default function InboxScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [items, setItems] = useState<InboxItem[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        let alive = true;
        FriendsService.getInbox()
            .then(found => { if (alive) setItems(found); })
            .catch(() => { if (alive) setItems([]); });
        // Opening the inbox is reading it. The badge clears behind you rather
        // than asking you to mark anything.
        FriendsService.markInboxRead()
            .then(() => emit('social_state_updated'))
            .catch(() => undefined);
        return () => { alive = false; };
    }, []);

    /** Pull to refresh: an event, so it may set state as it pleases. */
    // Pulling down on an empty inbox gets a new line each time, for fun.
    const [joke, setJoke] = useState(0);
    const refresh = useCallback(async () => {
        setRefreshing(true);
        setItems(await FriendsService.getInbox().catch(() => []));
        setRefreshing(false);
        // The next line arrives once the spinner has tucked itself away.
        setTimeout(() => setJoke(index => index + 1), 350);
    }, []);

    const answer = async (item: InboxItem, accept: boolean) => {
        if (!item.requestId || busy) return;
        setBusy(item.id);
        const done = accept
            ? await FriendsService.acceptFriendRequest(item.requestId)
            : await FriendsService.declineFriendRequest(item.requestId);
        setBusy(null);
        if (!done) return;

        if (accept) successFeedback(); else lightFeedback();
        // Answered, so the buttons go — the notification stays as the record
        // that it happened.
        setItems(current => (current ?? []).map(each =>
            each.requestId === item.requestId
                ? { ...each, requestId: undefined, body: accept ? 'You are friends now.' : 'Declined.' }
                : each));
        emit('social_state_updated');
    };

    /**
     * Taking on somebody's habit, or turning it down.
     *
     * Either way they hear about it — silence after a share is the same as not
     * knowing whether it arrived.
     */
    const answerShare = async (item: InboxItem, accept: boolean) => {
        if (!item.share || busy) return;
        setBusy(item.id);
        const done = accept
            ? await FriendsService.acceptShareRequest(item.share.type, item.share.itemId, item.share.ownerId)
            : await FriendsService.declineShareRequest(item.share.type, item.share.itemId, item.share.ownerId);
        setBusy(null);
        if (!done) return;

        if (accept) successFeedback(); else lightFeedback();
        setItems(current => (current ?? []).map(each => each.id === item.id
            ? { ...each, share: undefined, body: accept ? 'It is on your list now.' : 'Turned down.' }
            : each));
        // The roadmap has a new row in it, or does not.
        emit('social_state_updated');
        emit('habit_completion_updated', {});
    };

    /** Joining a friend's challenge, or declining it: the same call as Community's invite card. */
    const answerChallenge = async (item: InboxItem, accept: boolean) => {
        if (!item.challenge || busy) return;
        setBusy(item.id);
        const { respondChallenge } = require('@/lib/challenges') as typeof import('@/lib/challenges');
        const failed = await respondChallenge(item.challenge.runId, accept).then(() => null, (error: unknown) => error);
        setBusy(null);
        if (failed) {
            Alert.alert('That didn’t go through', failed instanceof Error ? failed.message : 'Try again in a moment.');
            return;
        }
        if (accept) successFeedback(); else lightFeedback();
        setItems(current => (current ?? []).map(each => each.id === item.id
            ? { ...each, challenge: undefined, body: accept ? 'You’re in. It’s in your plan.' : 'Declined.' }
            : each));
        emit('challenges_changed');
    };

    // Repeats stack into one card with a count (lib/inboxGroups.ts).
    const groups = useMemo(() => groupInbox(items ?? []), [items]);
    const clearable = useMemo(() => (items ?? []).filter(item => !isAnswerable(item)), [items]);
    const [confirming, setConfirming] = useState(false);

    /** Clears a card, and every repeat stacked under it, in one go. */
    const dismiss = async (ids: string[]) => {
        lightFeedback();
        const gone = new Set(ids);
        setItems(current => (current ?? []).filter(each => !gone.has(each.id)));
        await FriendsService.dismissNotifications(ids);
        emit('social_state_updated');
    };

    /** Everything that is only news. Requests and shares stay: they are answered. */
    const clearAll = () => void dismiss(clearable.map(item => item.id));

    return (
        <SheetScreen title="Inbox" onBack={() => router.back()}
            {...(clearable.length ? { onAction: () => setConfirming(true), actionIcon: 'trash-outline' as const, actionLabel: 'Clear all' } : {})}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing} tintColor={colors.textTertiary}
                        onRefresh={() => void refresh()}
                    />
                }
            >
                {items === null ? (
                    <ActivityIndicator color={accent} style={{ marginTop: vs(40) }} />
                ) : items.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="mail-outline" size={s(30)} color={colors.textTertiary} />
                        <Animated.Text key={joke} entering={FadeIn.duration(220)}
                            style={[styles.emptyText, { color: colors.textSecondary }]}>
                            {EMPTY_LINES[joke % EMPTY_LINES.length]}
                        </Animated.Text>
                    </View>
                ) : (
                    <Animated.View layout={MORPH} style={styles.list}>
                        {groups.map(({ item, ids, count }: InboxGroup) => {
                            const look = LOOK[item.kind];
                            const tint = look.tint(colors, accent);
                            return (
                                <Animated.View key={item.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} layout={MORPH}>
                                    <SwipeRow
                                        // An open request is answered, not swept away: the
                                        // buttons are the point of it being here.
                                        right={item.requestId || item.share || item.challenge ? [] : [{
                                            icon: 'trash', label: 'Clear', color: colors.error,
                                            destructive: true, onPress: () => void dismiss(ids),
                                        }]}
                                    >
                                    <VoidCard matte style={styles.row}>
                                        <View style={styles.head}>
                                            <View style={[styles.badge, { backgroundColor: tone.raised }]}>
                                                {item.fromAvatarUrl ? (
                                                    <Image source={{ uri: item.fromAvatarUrl }} style={styles.photo} />
                                                ) : (
                                                    <Ionicons name={look.icon} size={s(16)} color={tint} />
                                                )}
                                            </View>
                                            <View style={styles.text}>
                                                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                                                <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
                                            </View>
                                            <View style={styles.side}>
                                                {!item.read ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
                                                <Text style={[styles.when, { color: colors.textTertiary }]}>{ago(item.createdAt)}</Text>
                                                {count > 1 ? (
                                                    <View style={[styles.count, { backgroundColor: tone.raised }]} accessible accessibilityLabel={`${count} times`}>
                                                        <Text style={[styles.countText, { color: colors.textSecondary }]}>×{count}</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>

                                        {item.challenge ? (
                                            <View style={styles.actions}>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Decline the challenge"
                                                    disabled={busy === item.id}
                                                    onPress={() => void answerChallenge(item, false)}
                                                    style={[styles.action, { backgroundColor: tone.raised }]}
                                                >
                                                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>Decline</Text>
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Join the challenge"
                                                    disabled={busy === item.id}
                                                    onPress={() => void answerChallenge(item, true)}
                                                    style={[styles.action, { backgroundColor: tone.raised }]}
                                                >
                                                    {busy === item.id
                                                        ? <ActivityIndicator size="small" color={colors.textPrimary} />
                                                        : <Text style={[styles.actionText, { color: colors.textPrimary }]}>Join</Text>}
                                                </Pressable>
                                            </View>
                                        ) : item.share ? (
                                            <View style={styles.actions}>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Decline the ${item.share.type}`}
                                                    disabled={busy === item.id}
                                                    onPress={() => void answerShare(item, false)}
                                                    style={[styles.action, { backgroundColor: tone.raised }]}
                                                >
                                                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>No thanks</Text>
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Accept the ${item.share.type}`}
                                                    disabled={busy === item.id}
                                                    onPress={() => void answerShare(item, true)}
                                                    style={[styles.action, { backgroundColor: tone.raised }]}
                                                >
                                                    {busy === item.id
                                                        ? <ActivityIndicator size="small" color={colors.textPrimary} />
                                                        : <Text style={[styles.actionText, { color: colors.textPrimary }]}>Add to my list</Text>}
                                                </Pressable>
                                            </View>
                                        ) : item.requestId ? (
                                            <View style={styles.actions}>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Decline ${item.fromName ?? item.fromUsername ?? 'them'}`}
                                                    disabled={busy === item.id}
                                                    onPress={() => void answer(item, false)}
                                                    style={[styles.action, { backgroundColor: tone.raised }]}
                                                >
                                                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>Decline</Text>
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Accept ${item.fromName ?? item.fromUsername ?? 'them'}`}
                                                    disabled={busy === item.id}
                                                    onPress={() => void answer(item, true)}
                                                    style={[styles.action, { backgroundColor: tone.raised }]}
                                                >
                                                    {busy === item.id
                                                        ? <ActivityIndicator size="small" color={colors.textPrimary} />
                                                        : <Text style={[styles.actionText, { color: colors.textPrimary }]}>Accept</Text>}
                                                </Pressable>
                                            </View>
                                        ) : null}
                                    </VoidCard>
                                    </SwipeRow>
                                </Animated.View>
                            );
                        })}
                    </Animated.View>
                )}
            </ScrollView>
            <ChoiceSheet
                visible={confirming} onClose={() => setConfirming(false)}
                title={`Clear ${clearable.length === 1 ? 'this notification' : `all ${clearable.length}`}?`}
                caption={clearable.length < (items?.length ?? 0) ? 'Requests waiting for an answer stay.' : undefined}
                choices={[{ label: 'Clear all', icon: 'trash-outline', destructive: true, onPress: clearAll }]}
            />
        </SheetScreen>
    );
}
