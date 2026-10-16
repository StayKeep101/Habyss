import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import type { ChatMessage } from '@/lib/chatThread';

export interface ChatPerson { id: string; name: string; avatarUrl?: string }

const when = (at: string) => {
    const date = new Date(at);
    const sameDay = date.toDateString() === new Date().toDateString();
    return sameDay
        ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * Every friend, newest chat first. A row opens the chat; a dot means they wrote
 * and you have not read it yet.
 */
export function ChatList({ people, conversations, me, onOpen }: {
    people: ChatPerson[];
    conversations: Record<string, { last: ChatMessage; unread: number }>;
    me?: string;
    onOpen: (person: ChatPerson) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    if (people.length === 0) return null;

    const sorted = [...people].sort((a, b) => {
        const at = conversations[a.id]?.last.createdAt ?? '';
        const bt = conversations[b.id]?.last.createdAt ?? '';
        return at < bt ? 1 : at > bt ? -1 : a.name.localeCompare(b.name);
    });

    return (
        <View style={styles.wrap}>
            <SectionTitle first>Chats</SectionTitle>
            <VoidCard style={styles.card}>
                {sorted.map((person, index) => {
                    const chat = conversations[person.id];
                    const unread = chat?.unread ?? 0;
                    const line = chat ? `${chat.last.fromUser === me ? 'You: ' : ''}${chat.last.body}` : 'Their day shows up here';
                    return (
                        <ListItem key={person.id} index={index}>
                            <Pressable onPress={() => onOpen(person)} style={styles.row}
                                accessibilityRole="button" accessibilityLabel={`Chat with ${person.name}${unread ? `, ${unread} unread` : ''}`}>
                                <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                                    {person.avatarUrl
                                        ? <Image source={{ uri: person.avatarUrl }} style={styles.photo} />
                                        : <Text style={[styles.initial, { color: primary }]}>{person.name.slice(0, 1).toUpperCase()}</Text>}
                                </View>
                                <View style={styles.copy}>
                                    <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{person.name}</Text>
                                    <Text numberOfLines={1} style={[styles.preview, {
                                        color: unread ? colors.textPrimary : colors.textTertiary,
                                        fontFamily: unread ? FontFamily.semibold : FontFamily.regular,
                                    }]}>{line}</Text>
                                </View>
                                <View style={styles.side}>
                                    {chat ? <Text style={[styles.time, { color: colors.textTertiary }]}>{when(chat.last.createdAt)}</Text> : null}
                                    {unread ? <View style={[styles.dot, { backgroundColor: primary }]} /> : null}
                                </View>
                            </Pressable>
                        </ListItem>
                    );
                })}
            </VoidCard>
        </View>
    );
}

const AVATAR = 44;

const styles = StyleSheet.create({
    wrap: { marginBottom: Spacing.xxl },
    card: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm + 2 },
    avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: AVATAR, height: AVATAR },
    initial: { fontFamily: FontFamily.bold, fontSize: 17 },
    copy: { flex: 1, gap: 2 },
    name: { fontFamily: FontFamily.semibold, fontSize: 15 },
    preview: { fontSize: 13 },
    side: { alignItems: 'flex-end', gap: Spacing.xs },
    time: { fontFamily: FontFamily.regular, fontSize: 11 },
    dot: { width: 9, height: 9, borderRadius: 5 },
});
