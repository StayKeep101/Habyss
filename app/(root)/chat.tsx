import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { MatteInput } from '@/components/ui/MatteInput';
import { IconButton } from '@/components/ui/IconButton';
import { ListItem } from '@/components/ui/Motion';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import { DayProgressCard } from '@/components/Chat/DayProgressCard';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSounds } from '@/hooks/useSounds';
import { ChatService } from '@/lib/chatService';
import { buildThread, type ChatMessage, type StoredDayCard, type ThreadItem } from '@/lib/chatThread';
import { localDateKey } from '@/lib/habitSchedule';
import { styles } from '@/styles/screens/chat.styles';

const dayOf = (at: string) => localDateKey(new Date(at));
const breakLabel = (day: string, today: string) => day === today ? 'Today'
    : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

/**
 * One chat with one friend. What you type, and each of your days as a card the
 * app keeps up to date, so you hold each other to it without asking.
 */
export default function ChatScreen() {
    const router = useRouter();
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const { playTap, playNotification } = useSounds();
    const [fetchedName, setFetchedName] = useState('');
    const friendName = name || fetchedName || 'Friend';

    const [me, setMe] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [cards, setCards] = useState<StoredDayCard[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const list = useRef<FlatList<ThreadItem>>(null);
    const today = localDateKey(new Date());

    const load = useCallback(async () => {
        if (!id) return;
        const thread = await ChatService.thread(id);
        if (thread) {
            setMe(thread.me);
            setFetchedName(thread.name);
            setMessages(thread.messages);
            setCards(thread.cards);
        }
        setLoaded(true);
        void ChatService.markRead(id);
    }, [id]);

    useEffect(() => { void load(); }, [load]);

    // New messages from this friend appear as they arrive.
    useEffect(() => {
        let stop: (() => void) | undefined;
        void ChatService.listen(message => {
            if (message.fromUser !== id) return;
            playNotification();
            setMessages(prev => prev.some(item => item.id === message.id) ? prev : [...prev, message]);
            void ChatService.markRead(id);
        }).then(unsubscribe => { stop = unsubscribe; });
        return () => stop?.();
    }, [id, playNotification]);

    // Newest first, because the list is inverted: it opens at the bottom.
    const items = useMemo(() => (me ? buildThread(me, messages, cards) : []).reverse(), [me, messages, cards]);

    const send = async () => {
        const text = draft.trim();
        if (!text || !id || sending) return;
        lightFeedback();
        setSending(true);
        setDraft('');
        const sent = await ChatService.send(id, text);
        setSending(false);
        if (sent) {
            playTap();
            setMessages(prev => [...prev, sent]);
            list.current?.scrollToOffset({ offset: 0, animated: true });
        } else {
            setDraft(text);
            Alert.alert('Not sent', 'Check your connection and try again.');
        }
    };

    const unsend = (message: ChatMessage) => {
        const remove = async () => {
            if (await ChatService.remove(message.id)) setMessages(prev => prev.filter(item => item.id !== message.id));
        };
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                { options: ['Unsend', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
                index => { if (index === 0) void remove(); },
            );
        } else {
            Alert.alert('Unsend this message?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Unsend', style: 'destructive', onPress: () => void remove() }]);
        }
    };

    const renderItem = ({ item, index }: { item: ThreadItem; index: number }) => {
        // A date line above the first item of each day (the list is inverted,
        // so "above" is the next item in the array).
        const older = items[index + 1];
        const showBreak = !older || dayOf(older.at) !== dayOf(item.at);
        return (
            <ListItem>
                {showBreak ? <Text style={[styles.dayBreak, { color: colors.textTertiary }]}>{breakLabel(dayOf(item.at), today)}</Text> : null}
                {item.kind === 'message' ? (
                    <MessageBubble body={item.message.body} at={item.at} mine={item.mine}
                        onLongPress={item.mine ? () => unsend(item.message) : undefined} />
                ) : (
                    <DayProgressCard card={item.card} day={item.day} today={today} mine={item.mine} name={friendName} />
                )}
            </ListItem>
        );
    };

    return (
        <SheetScreen title={friendName} onBack={() => router.back()}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
                {loaded && items.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Say hi to {friendName}</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={list}
                        inverted
                        data={items}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.list}
                        keyboardDismissMode="interactive"
                        showsVerticalScrollIndicator={false}
                    />
                )}
                <View style={styles.composer}>
                    <MatteInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Message"
                        multiline
                        maxLength={2000}
                        accessibilityLabel={`Message ${friendName}`}
                        style={styles.input}
                    />
                    <IconButton icon="arrow-up" label="Send" onPress={() => void send()} loading={sending}
                        disabled={!draft.trim()} diameter={44} size={18} color={draft.trim() ? primary : colors.textTertiary} />
                </View>
            </KeyboardAvoidingView>
        </SheetScreen>
    );
}
