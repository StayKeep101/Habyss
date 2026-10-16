import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { STATUS_LABEL, type FriendStatus } from '@/lib/presence';
import { StatusBadge } from './StatusBadge';

export interface RailFriend { userId: string; name: string; avatarUrl?: string; status: FriendStatus }

const FACE = 60;
/** Who is doing something comes first: locked in, then live, then the rest. */
const ORDER: Record<FriendStatus, number> = { focus: 0, live: 1, away: 2, asleep: 3 };

/**
 * Every friend along the top: their face and what they are doing right now.
 * Locked in wears an accent ring and a lock; live a green dot; asleep a moon.
 * Tap a face for their profile.
 */
export function FriendsRail({ friends, onOpen }: { friends: RailFriend[]; onOpen: (friend: RailFriend) => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    if (friends.length === 0) return null;
    const sorted = [...friends].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));

    // Away needs no mark on the rail: the name under the face says enough.
    const badgeFor = (status: FriendStatus) => (status === 'away' ? null : <StatusBadge status={status} />);

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {sorted.map((friend, index) => (
                <ListItem key={friend.userId} index={index}>
                    <Pressable onPress={() => onOpen(friend)} style={styles.cell}
                        accessibilityRole="button" accessibilityLabel={`${friend.name}, ${STATUS_LABEL[friend.status]}`}>
                        <Avatar name={friend.name} uri={friend.avatarUrl} size={FACE}
                            ring={friend.status === 'focus' ? primary : undefined}
                            dim={friend.status === 'asleep'}
                            badge={badgeFor(friend.status)} />
                        <Text numberOfLines={1} style={[styles.label, {
                            color: friend.status === 'focus' ? primary : friend.status === 'live' ? colors.success : colors.textTertiary,
                        }]}>
                            {friend.status === 'away' ? friend.name.split(' ')[0] : STATUS_LABEL[friend.status]}
                        </Text>
                    </Pressable>
                </ListItem>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: { gap: Spacing.lg, paddingVertical: Spacing.xs, paddingRight: Spacing.xl },
    cell: { width: FACE + Spacing.sm, alignItems: 'center', gap: Spacing.xs + 2 },
    label: { fontSize: 11, fontFamily: FontFamily.medium, maxWidth: FACE + Spacing.md },
    badge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 14, height: 14, borderRadius: 7 },
});
