import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon, Avatar, CountUp, Text, VoidSheet } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { FriendsService } from '@/lib/friendsService';
import { Control, Spacing } from '@/theme/designSystem';

interface Person { userId: string; name: string; username?: string; avatarUrl?: string; pending?: boolean }

/**
 * Following and Followers on your profile, as two figures side by side; each
 * opens the people behind it. Friends in Habyss go both ways, so a friend is
 * in both lists; a request you sent (not answered yet) is someone you follow,
 * and one sent to you is someone who follows you.
 */
export function FollowCounts() {
    const t = useTokens();
    const router = useRouter();
    const { selectionFeedback } = useHaptics();
    const [lists, setLists] = useState<{ following: Person[]; followers: Person[] } | null>(null);
    const [open, setOpen] = useState<'following' | 'followers' | null>(null);

    useEffect(() => {
        let live = true;
        void (async () => {
            const [friends, sent, received] = await Promise.all([
                FriendsService.getFriends().catch(() => []),
                FriendsService.getSentRequests().catch(() => []),
                FriendsService.getFriendRequests().catch(() => []),
            ]);
            const mutual: Person[] = friends.map(friend => ({ userId: friend.userId, name: friend.displayName || friend.username, username: friend.username, avatarUrl: friend.avatarUrl }));
            if (!live) return;
            setLists({
                following: [...mutual, ...sent.map(person => ({ ...person, pending: true }))],
                followers: [...mutual, ...received.map(request => ({ userId: request.fromUserId, name: request.fromName ?? request.fromUsername, username: request.fromUsername, avatarUrl: request.fromAvatarUrl, pending: true }))],
            });
        })();
        return () => { live = false; };
    }, []);

    const shown = open && lists ? lists[open] : [];
    const figure = (which: 'following' | 'followers', label: string) => (
        <Pressable onPress={() => { selectionFeedback(); setOpen(which); }} accessibilityRole="button" hitSlop={Spacing.sm}
            accessibilityLabel={`${lists?.[which].length ?? 0} ${label.toLowerCase()}`} style={styles.figure}>
            <CountUp value={lists?.[which].length ?? 0} style={[t.type.title, { color: t.color.textPrimary }]} />
            <Text variant="bodySmall" tone="muted">{label}</Text>
        </Pressable>
    );

    return (
        <>
            <View style={styles.row}>
                {figure('following', 'Following')}
                <View style={[styles.dot, { backgroundColor: t.color.textSubtle }]} />
                {figure('followers', 'Followers')}
            </View>
            <VoidSheet visible={!!open} onClose={() => setOpen(null)} title={open === 'followers' ? 'Followers' : 'Following'} scrollable maxShare={0.75}>
                <ScrollView style={styles.list} contentContainerStyle={{ gap: Spacing.xs }}>
                    {shown.length ? shown.map(person => (
                        <Pressable key={`${person.userId}-${person.pending ? 'p' : 'f'}`} accessibilityRole="button"
                            onPress={() => { selectionFeedback(); setOpen(null); router.push({ pathname: '/(root)/friend', params: { id: person.userId } } as never); }}
                            style={[styles.person, { borderBottomColor: t.color.border }]}>
                            <Avatar name={person.name} uri={person.avatarUrl} size={Control.hitTarget} />
                            <View style={styles.flex}>
                                <Text variant="body" numberOfLines={1}>{person.name}</Text>
                                <Text variant="caption" tone="muted" numberOfLines={1}>
                                    {[person.username ? `@${person.username}` : null, person.pending ? (open === 'following' ? 'Requested' : 'Wants to connect') : null].filter(Boolean).join(' · ')}
                                </Text>
                            </View>
                            <AppIcon name="chevron-forward" size={Spacing.lg} color={t.color.textSubtle} />
                        </Pressable>
                    )) : (
                        <Text variant="bodySmall" tone="muted" align="center">{open === 'followers' ? 'Nobody yet. Share your @ to get going.' : 'Find friends in Community.'}</Text>
                    )}
                </ScrollView>
            </VoidSheet>
        </>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, marginTop: Spacing.md },
    figure: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, minHeight: Control.hitTarget, justifyContent: 'center' },
    dot: { width: Spacing.xs, height: Spacing.xs, borderRadius: Spacing.xs / 2 },
    list: { paddingHorizontal: Spacing.xl },
    person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
