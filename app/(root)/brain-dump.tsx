import React, { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { MatteInput } from '@/components/ui/MatteInput';
import { IconButton } from '@/components/ui/IconButton';
import { VoidCard } from '@/components/ui/VoidCard';
import { ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { emit } from '@/lib/appEvents';
import { addThought, byDay, getThoughts, removeThought, type Thought } from '@/lib/brainDump';
import { localDateKey } from '@/lib/habitSchedule';
import { styles } from '@/styles/screens/brain-dump.styles';

const dayLabel = (day: string, today: string) => day === today ? 'Today'
    : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Somewhere to put what is on your mind. Write it, send it, and it is out of
 * your head. Hold a thought to turn it into a task, habit or goal. Private:
 * it stays on this phone.
 */
export default function BrainDumpScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();
    const [thoughts, setThoughts] = useState<Thought[]>([]);
    const [draft, setDraft] = useState('');
    const today = localDateKey(new Date());

    useEffect(() => { void getThoughts().then(setThoughts); }, []);
    const days = useMemo(() => byDay(thoughts, iso => localDateKey(new Date(iso))), [thoughts]);

    const send = async () => {
        const thought = await addThought(draft);
        if (!thought) return;
        lightFeedback();
        setDraft('');
        setThoughts(prev => [thought, ...prev]);
    };

    /** Leaves this page first: the sheets open over the app, not over a modal. */
    const turnInto = (kind: 'task' | 'habit' | 'goal', text: string) => {
        router.back();
        setTimeout(() => {
            if (kind === 'habit') emit('show_quick_add', { prefillName: text });
            else if (kind === 'goal') emit('show_goal_quick_add', { prefill: text });
            else emit('show_task_form', { prefill: text });
        }, 400);
    };

    const remove = async (id: string) => {
        await removeThought(id);
        setThoughts(prev => prev.filter(item => item.id !== id));
    };

    const act = (thought: Thought) => {
        selectionFeedback();
        const choices = ['Make it a task', 'Make it a habit', 'Make it a goal', 'Delete', 'Cancel'];
        const pick = (index: number) => {
            if (index === 0) turnInto('task', thought.text);
            if (index === 1) turnInto('habit', thought.text);
            if (index === 2) turnInto('goal', thought.text);
            if (index === 3) void remove(thought.id);
        };
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions({ options: choices, destructiveButtonIndex: 3, cancelButtonIndex: 4 }, pick);
        } else {
            Alert.alert('', undefined, choices.slice(0, 4).map((text, index) => ({ text, onPress: () => pick(index) })));
        }
    };

    return (
        <SheetScreen title="Brain dump" onBack={() => router.back()}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
                <View style={styles.composer}>
                    <MatteInput
                        autoFocus
                        multiline
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="What's on your mind?"
                        accessibilityLabel="New thought"
                        style={styles.input}
                    />
                    <IconButton icon="arrow-up" label="Save thought" onPress={() => void send()} disabled={!draft.trim()}
                        diameter={52} size={18} color={draft.trim() ? primary : colors.textTertiary} />
                </View>
                <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
                    {thoughts.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textTertiary }]}>Empty head. Nice.</Text>
                    ) : days.map(group => (
                        <View key={group.day}>
                            <Text style={[styles.day, { color: colors.textTertiary }]}>{dayLabel(group.day, today)}</Text>
                            {group.thoughts.map((thought, index) => (
                                <ListItem key={thought.id} index={index} style={styles.item}>
                                    <Pressable onLongPress={() => act(thought)} delayLongPress={300}
                                        accessibilityRole="button" accessibilityHint="Hold for options" accessibilityLabel={thought.text}>
                                        <VoidCard style={styles.thought}>
                                            <Text style={[styles.text, { color: colors.textPrimary }]}>{thought.text}</Text>
                                            <Text style={[styles.time, { color: colors.textTertiary }]}>{timeOf(thought.createdAt)}</Text>
                                        </VoidCard>
                                    </Pressable>
                                </ListItem>
                            ))}
                        </View>
                    ))}
                </ScrollView>
            </KeyboardAvoidingView>
        </SheetScreen>
    );
}
