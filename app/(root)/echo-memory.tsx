import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppButton } from '@/components/ui/AppButton';
import { ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useEchoMemory } from '@/hooks/useEchoMemory';
import { addNote, forgetAll, helpRanking, removeNote, updateNote, type MemoryNote } from '@/lib/echoMemory';
import { CRISIS_MESSAGE, soundsLikeCrisis } from '@/lib/echoSafety';
import { styles } from '@/styles/screens/echo-memory.styles';

const KIND: Record<MemoryNote['kind'], string> = {
    preference: 'Preference', obstacle: 'In the way', strategy: 'What works', ambition: 'Ambition', pattern: 'Pattern',
};
const HELP_NAME = { two_minute: 'Two-minute starts', five_minute: 'Five-minute sessions', plan: 'Plans (“After…, I will…”)' };

/**
 * Everything Echo remembers, and nothing hidden: what you told it, what it
 * noticed in your record (with the numbers), and which help has worked for
 * you. Tap a note to change it, the bin to delete it, or forget everything.
 * It stays on this phone.
 */
export default function EchoMemoryScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback, lightFeedback } = useHaptics();
    const memory = useEchoMemory();
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
    const [crisis, setCrisis] = useState(false);

    const told = memory.notes.filter(note => note.source === 'you');
    const noticed = memory.notes.filter(note => note.source === 'echo');
    const ranking = helpRanking(memory.helps).filter(entry => entry.tries > 0);

    const add = () => {
        const text = draft.trim();
        if (!text) return;
        if (soundsLikeCrisis(text)) { setCrisis(true); return; }
        void addNote('preference', text, 'you');
        setDraft('');
        lightFeedback();
    };
    const finishEdit = () => {
        if (!editing) return;
        void updateNote(editing.id, editing.text);
        setEditing(null);
    };

    const row = (note: MemoryNote, index: number) => (
        <ListItem key={note.id} index={index}>
            <VoidCard style={styles.note}>
                <View style={styles.row}>
                    {editing?.id === note.id ? (
                        <MatteInput bare autoFocus value={editing.text} onChangeText={text => setEditing({ id: note.id, text })}
                            onBlur={finishEdit} onSubmitEditing={finishEdit} returnKeyType="done"
                            style={[styles.input, { color: colors.textPrimary }]} accessibilityLabel="Edit what Echo remembers" />
                    ) : (
                        <Pressable style={styles.flex} onPress={() => setEditing({ id: note.id, text: note.text })} accessibilityHint="Tap to change">
                            <Text style={[styles.text, { color: colors.textPrimary }]}>{note.text}</Text>
                        </Pressable>
                    )}
                    <IconButton icon="trash" label="Forget this" diameter={28} size={14} color={colors.textTertiary}
                        onPress={() => { selectionFeedback(); void removeNote(note.id); }} />
                </View>
                <Text style={[styles.meta, { color: colors.textTertiary }]}>
                    {KIND[note.kind]}{note.evidence ? ` · ${note.evidence}` : ''}
                </Text>
            </VoidCard>
        </ListItem>
    );

    return (
        <SheetScreen title="What Echo remembers" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[styles.lead, { color: colors.textSecondary }]}>
                    Kept on this phone only. Change or delete anything.
                </Text>

                {crisis ? (
                    <VoidCard style={styles.crisis}>
                        <Text style={[styles.crisisTitle, { color: colors.textPrimary }]}>{CRISIS_MESSAGE.title}</Text>
                        <Text style={[styles.lead, { color: colors.textSecondary }]}>{CRISIS_MESSAGE.body}</Text>
                    </VoidCard>
                ) : null}

                <MatteInput value={draft} onChangeText={setDraft} placeholder="Tell Echo something useful, like “I focus best before noon”"
                    placeholderTextColor={colors.textTertiary} returnKeyType="done" onSubmitEditing={add}
                    style={[styles.field, { color: colors.textPrimary }]} accessibilityLabel="Tell Echo something" />

                {told.length ? <SectionTitle>You told Echo</SectionTitle> : null}
                {told.map(row)}

                {noticed.length ? <SectionTitle>Echo noticed</SectionTitle> : null}
                {noticed.map(row)}

                {ranking.length ? (
                    <>
                        <SectionTitle>Help that worked</SectionTitle>
                        <VoidCard style={styles.help}>
                            {ranking.map(entry => (
                                <View key={entry.type} style={styles.helpRow}>
                                    <Text style={[styles.helpText, { color: colors.textPrimary }]}>{HELP_NAME[entry.type]}</Text>
                                    <Text style={[styles.helpText, { color: colors.textTertiary }]}>{entry.done} of {entry.tries} got done</Text>
                                </View>
                            ))}
                        </VoidCard>
                    </>
                ) : null}

                {memory.notes.length || memory.helps.length ? (
                    <AppButton label="Forget everything" variant="danger" onPress={() => Alert.alert('Forget everything?', 'Echo forgets every note and what help worked. This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Forget', style: 'destructive', onPress: () => void forgetAll() },
                    ])} />
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}
