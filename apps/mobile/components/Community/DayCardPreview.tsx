import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { StreamPostCard, type StreamContext } from '@/components/Community/StreamPostCard';
import { buildStream } from '@/lib/communityStream';
import { latestDayCard, subscribeDayCard } from '@/lib/dayCardLatest';
import { FeedService, type FeedPost } from '@/lib/feedService';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useTokens } from '@/hooks/useTokens';

/**
 * Your accountability card as it stands right now, drawn by the same card the
 * Community feed uses, before the server posts it at your sharing time. A
 * preview only: reactions and comments do nothing, and nothing is posted.
 */
export function DayCardPreview() {
    const t = useTokens();
    const profile = useMyProfile();
    const [latest, setLatest] = useState(latestDayCard());
    const [meId, setMeId] = useState<string | null>(null);
    useEffect(() => subscribeDayCard(() => setLatest(latestDayCard())), []);
    useEffect(() => { void FeedService.me().then(setMeId).catch(() => undefined); }, []);

    const item = useMemo(() => {
        if (!latest) return null;
        const post: FeedPost = {
            userId: meId ?? 'me', day: latest.day, postedAt: new Date().toISOString(), card: latest.card,
            name: profile.name || 'You', username: '', avatarUrl: profile.avatar ?? undefined,
            ackCount: 0, ackedByMe: false, ackUsers: [], myReaction: null, reactions: {}, mine: true,
        };
        return buildStream([post])[0];
    }, [latest, meId, profile.name, profile.avatar]);

    const ctx: StreamContext = useMemo(() => ({
        meId, myName: profile.name || 'You', myAvatar: profile.avatar ?? undefined,
        rankOf: () => null, statusOf: () => undefined, facesOf: () => [],
        onReact: () => undefined, onReport: () => undefined, openPerson: () => undefined,
        commentsOf: () => [], onOpenComments: () => undefined,
    }), [meId, profile.name, profile.avatar]);

    if (!item) {
        return (
            <View style={{ paddingVertical: t.space.md }}>
                <Text style={[t.type.bodySmall, { color: t.color.textMuted }]}>
                    Your card is built a few seconds after the tabs open. Open Home once, then come back.
                </Text>
            </View>
        );
    }
    return <StreamPostCard item={item} ctx={ctx} />;
}
