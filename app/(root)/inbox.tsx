import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { SwipeRow } from '@/components/Common/SwipeRow';
import { Colors } from '@/constants/Colors';
import { FontFamily, surfaceFor } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, type InboxItem } from '@/lib/friendsService';
import { emit } from '@/lib/appEvents';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

const LOOK: Record<InboxItem['kind'], { icon: string; tint: (colors: typeof Colors.light, accent: string) => string }> = {
    friend_request: { icon: 'person-add', tint: (_colors, accent) => accent },
    friend_accepted: { icon: 'checkmark-circle', tint: colors => colors.success },
    nudge: { icon: 'hand-right', tint: colors => colors.warning },
    // Raised by the app itself — a reminder that fired, a streak, a milestone.
    local: { icon: 'notifications', tint: (_colors, accent) => accent },
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
    const refresh = useCallback(async () => {
        setRefreshing(true);
        setItems(await FriendsService.getInbox().catch(() => []));
        setRefreshing(false);
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

    const dismiss = async (item: InboxItem) => {
        lightFeedback();
        setItems(current => (current ?? []).filter(each => each.id !== item.id));
        await FriendsService.dismissNotification(item.id);
        emit('social_state_updated');
    };

    return (
        <SheetScreen title="Inbox" onBack={() => router.back()}>
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
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            Nothing waiting. Friend requests, nudges and anything the app
                            wants to tell you all land here.
                        </Text>
                    </View>
                ) : (
                    <Animated.View layout={MORPH} style={styles.list}>
                        {items.map(item => {
                            const look = LOOK[item.kind];
                            const tint = look.tint(colors, accent);
                            return (
                                <Animated.View key={item.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} layout={MORPH}>
                                    <SwipeRow
                                        // An open request is answered, not swept away: the
                                        // buttons are the point of it being here.
                                        right={item.requestId ? [] : [{
                                            icon: 'trash', label: 'Clear', color: colors.error,
                                            destructive: true, onPress: () => void dismiss(item),
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
                                            </View>
                                        </View>

                                        {item.requestId ? (
                                            <View style={styles.actions}>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Decline @${item.fromUsername ?? 'them'}`}
                                                    disabled={busy === item.id}
                                                    onPress={() => void answer(item, false)}
                                                    style={[styles.action, { backgroundColor: tone.raised }]}
                                                >
                                                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>Decline</Text>
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Accept @${item.fromUsername ?? 'them'}`}
                                                    disabled={busy === item.id}
                                                    onPress={() => void answer(item, true)}
                                                    style={[styles.action, { backgroundColor: accent }]}
                                                >
                                                    {busy === item.id
                                                        ? <ActivityIndicator size="small" color="#fff" />
                                                        : <Text style={[styles.actionText, { color: '#fff' }]}>Accept</Text>}
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
        </SheetScreen>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40) },
    list: { gap: vs(10) },
    row: { padding: s(14), gap: vs(10) },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: s(11) },
    badge: { width: s(38), height: s(38), borderRadius: s(19), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    text: { flex: 1, gap: vs(2) },
    title: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.semibold },
    body: { fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular },
    side: { alignItems: 'flex-end', gap: vs(4) },
    dot: { width: s(7), height: s(7), borderRadius: s(4) },
    when: { fontSize: ms(10), fontFamily: FontFamily.regular },
    actions: { flexDirection: 'row', gap: s(8) },
    action: { flex: 1, minHeight: 40, borderRadius: s(12), alignItems: 'center', justifyContent: 'center' },
    actionText: { fontSize: ms(13), fontFamily: FontFamily.semibold },
    clear: { alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center' },
    clearText: { fontSize: ms(12), fontFamily: FontFamily.medium },
    empty: { alignItems: 'center', gap: vs(10), marginTop: vs(60), paddingHorizontal: s(30) },
    emptyText: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular, textAlign: 'center' },
});
