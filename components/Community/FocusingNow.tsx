import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Avatar } from '@/components/ui/Avatar';
import { FocusPill } from '@/components/ui/FocusPill';
import { AppIcon } from '@/components/ui/AppIcon';
import { ListItem } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { focusRooms, leftLabel, namesLine, secondsLeft, type FocusFacts } from '@/lib/focusTogether';

type Friend = FocusFacts & { name: string; avatarUrl?: string; focusLabel: string | null };

/**
 * Friends who are locked in right now, each with a Join: one tap and you are
 * focusing beside them until they finish, on your own thing. One row per
 * session — whoever started it, "with Sam" when others already joined. Your
 * own session shows Joined. Nothing at all when nobody is focusing.
 */
export function FocusingNow({ friends, now, joinedHost, onJoin, onOpen, style }: {
    style?: StyleProp<ViewStyle>;
    friends: Friend[];
    now: number;
    /** Whose session you are in right now, if you joined one. */
    joinedHost: string | null;
    onJoin: (hostId: string) => void;
    onOpen: (userId: string) => void;
}) {
    const t = useTokens();
    const rooms = focusRooms(friends, now);
    if (rooms.length === 0) return null;
    return (
        <View style={style}>
            <SectionTitle first>Focusing now</SectionTitle>
            <VoidCard style={styles.card}>
                {rooms.map(({ host, with: others }, index) => {
                    const first = host.name.split(' ')[0] || host.name;
                    const what = host.focusLabel?.trim();
                    const left = leftLabel(secondsLeft(host.focusUntil, now), host.focusOpen);
                    const joined = joinedHost === host.userId;
                    const company = others.length > 0 ? ` · with ${namesLine(others.map(friend => friend.name))}` : '';
                    return (
                        <ListItem key={host.userId} index={index}>
                            <View style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                <Pressable onPress={() => onOpen(host.userId)} style={styles.who} accessibilityRole="button"
                                    accessibilityLabel={`${host.name}, focusing${what ? ` on ${what}` : ''}, ${left}${company}`}>
                                    <Avatar name={host.name} uri={host.avatarUrl} size={44} ring={t.color.accent} />
                                    <View style={styles.text}>
                                        <Text numberOfLines={1} style={[styles.name, { color: t.color.textPrimary }]}>{what ? `${first} · ${what}` : first}</Text>
                                        <Text numberOfLines={1} style={[styles.meta, { color: t.color.textMuted }]}>{left}{company}</Text>
                                    </View>
                                </Pressable>
                                {joined ? (
                                    <View style={styles.joined} accessible accessibilityLabel={`You joined ${first}`}>
                                        <AppIcon name="checkmark" size={14} color={t.color.accent} />
                                        <Text style={[styles.joinedText, { color: t.color.accent }]}>Joined</Text>
                                    </View>
                                ) : (
                                    <FocusPill color={t.color.accent} onPress={() => onJoin(host.userId)} label={first}
                                        word="Join" icon="people" accessibilityLabel={`Join ${first}'s focus session`} />
                                )}
                            </View>
                        </ListItem>
                    );
                })}
            </VoidCard>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44 },
    text: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontFamily: FontFamily.semibold },
    meta: { fontSize: 13, fontFamily: FontFamily.medium },
    joined: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: Spacing.xs },
    joinedText: { fontSize: 13, fontFamily: FontFamily.semibold },
});
