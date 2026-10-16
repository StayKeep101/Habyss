import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ListItem } from '@/components/ui/Motion';
import { DayPostCard } from '@/components/Community/DayPostCard';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FeedService, type FeedPost } from '@/lib/feedService';
import { useMyProfile } from '@/hooks/useMyProfile';
import { announceChange, listenToFriends } from '@/lib/livePulse';

/**
 * The days someone has posted, newest first — the same list on your profile
 * and on a friend's. Friends can acknowledge from here too.
 */
export function ProfileDays({ userId }: { userId: string | null }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const [posts, setPosts] = useState<FeedPost[] | null>(null);
    const myProfile = useMyProfile();

    const load = useCallback(async () => {
        if (!userId) return;
        setPosts(await FeedService.feed(undefined, 10, userId));
    }, [userId]);

    useEffect(() => {
        void load();
        let stop: (() => void) | undefined;
        void listenToFriends(changed => { if (changed === userId) void load(); }).then(unsubscribe => { stop = unsubscribe; });
        return () => stop?.();
    }, [load, userId]);

    const acknowledge = async (post: FeedPost) => {
        selectionFeedback();
        const next = !post.ackedByMe;
        const flip = (acked: boolean) => setPosts(prev => prev?.map(item => item.day === post.day
            ? { ...item, ackedByMe: acked, ackCount: item.ackCount + (acked ? 1 : -1) } : item) ?? prev);
        flip(next);
        const ok = next ? await FeedService.acknowledge(post) : await FeedService.unacknowledge(post);
        if (!ok) flip(!next); else announceChange();
    };

    if (!userId) return null;
    return (
        <View style={styles.wrap}>
            <SectionTitle first>Days</SectionTitle>
            {posts !== null && posts.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textTertiary }]}>Nothing posted yet</Text>
            ) : (posts ?? []).map((post, index) => (
                <ListItem key={post.day} index={index}>
                    <DayPostCard name={post.mine ? (myProfile.name || post.name) : post.name} avatarUrl={post.mine ? myProfile.avatar ?? undefined : post.avatarUrl} postedAt={post.postedAt} card={post.card}
                        mine={post.mine} ackCount={post.ackCount} acked={post.ackedByMe} ackFaces={[]}
                        onAcknowledge={() => void acknowledge(post)} onOpenAuthor={() => undefined} />
                </ListItem>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginHorizontal: Spacing.xl, marginTop: Spacing.xl },
    empty: { fontFamily: FontFamily.regular, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.xl },
});
