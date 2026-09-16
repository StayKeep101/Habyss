import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { VoidCard } from '@/components/Layout/VoidCard';
import { addHabit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { describeParsed, parseHabitText, parsedToHabit } from '@/lib/habitParser';

interface Props {
    visible?: boolean;
    onClose?: () => void;
    onCreated?: () => void;
    /** Links the new habit to a goal when opened from a goal. */
    goalId?: string;
    /** Mounted once globally to answer the create-habit event. */
    listenToGlobalEvents?: boolean;
}

const EXAMPLES = [
    'Gym Monday, Wednesday, Friday at 6, 45 minutes',
    'Read 10 pages every day at 9pm',
    'Stretch 10 minutes weekdays',
];

/**
 * Quick add. One line of text becomes a habit.
 *
 * Parsing is local and deterministic, so it works offline and is not presented
 * as AI output. Whatever the parser had to assume is shown before saving, and
 * every field stays editable on the habit afterwards.
 */
export const QuickAddModal: React.FC<Props> = ({
    visible, onClose, onCreated, goalId: propGoalId, listenToGlobalEvents,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [text, setText] = useState('');
    const [eventVisible, setEventVisible] = useState(false);
    const [eventGoalId, setEventGoalId] = useState<string | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savingRef = useRef(false);

    useEffect(() => {
        if (!listenToGlobalEvents) return;
        const subscription = DeviceEventEmitter.addListener('show_quick_add', (data) => {
            DeviceEventEmitter.emit('close_creation_modal');
            setEventGoalId(typeof data?.goalId === 'string' ? data.goalId : undefined);
            setText('');
            setError(null);
            setEventVisible(true);
        });
        return () => subscription.remove();
    }, [listenToGlobalEvents]);

    const isOpen = listenToGlobalEvents ? eventVisible : !!visible;
    const goalId = propGoalId ?? eventGoalId;

    const close = () => {
        setEventVisible(false);
        onClose?.();
    };

    const parsed = useMemo(() => (text.trim() ? parseHabitText(text) : null), [text]);
    const canSave = !!parsed?.name.trim();

    const save = async () => {
        if (!parsed || !canSave || savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            const created = await addHabit({ ...parsedToHabit(parsed, localDateKey(new Date())), goalId });
            if (!created?.id) throw new Error('not saved');
            successFeedback();
            setText('');
            onCreated?.();
            DeviceEventEmitter.emit('habit_updated', { habitId: created.id });
            close();
        } catch {
            setError('Could not save that habit. Nothing was lost — try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const Chip = ({ label, on }: { label: string; on: boolean }) => (
        <View style={[styles.chip, {
            backgroundColor: on ? accent + '1c' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
            borderColor: on ? accent + '55' : 'transparent',
        }]}>
            <Text style={{ color: on ? accent : colors.textTertiary, fontSize: 11, fontFamily: 'Lexend_500Medium' }}>{label}</Text>
        </View>
    );

    return (
        <VoidModal visible={isOpen} onClose={close}>
            <View style={{ flex: 1 }}>
                <ModalHeader title="Quick add" onBack={close} backIcon="close" />

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                        Describe the habit in one line. Days, times and targets are picked up automatically.
                    </Text>

                    <TextInput
                        value={text}
                        onChangeText={setText}
                        autoFocus
                        multiline
                        placeholder="Gym Monday, Wednesday, Friday at 6, 45 minutes"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Describe your habit"
                        style={[styles.input, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                        }]}
                    />

                    {parsed ? (
                        <VoidCard style={styles.preview}>
                            <Text style={[styles.previewName, { color: colors.textPrimary }]}>
                                {parsed.name || 'Name your habit'}
                            </Text>
                            <Text style={[styles.previewLine, { color: colors.textSecondary }]}>{describeParsed(parsed)}</Text>

                            <View style={styles.chipRow}>
                                <Chip label="Days" on={parsed.matched.days} />
                                <Chip label="Time" on={parsed.matched.time} />
                                <Chip label="Target" on={parsed.matched.target || parsed.matched.duration} />
                            </View>

                            {parsed.assumptions.length ? (
                                <View style={{ gap: 4, marginTop: 4 }}>
                                    {parsed.assumptions.map(note => (
                                        <Text key={note} style={[styles.assumption, { color: colors.textTertiary }]}>· {note}</Text>
                                    ))}
                                </View>
                            ) : null}
                        </VoidCard>
                    ) : (
                        <View style={{ gap: 8, marginTop: 4 }}>
                            <Text style={[styles.exampleLabel, { color: colors.textTertiary }]}>TRY</Text>
                            {EXAMPLES.map(example => (
                                <TouchableOpacity
                                    key={example}
                                    onPress={() => { lightFeedback(); setText(example); }}
                                    style={[styles.example, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }]}
                                >
                                    <Ionicons name="flash-outline" size={14} color={accent} />
                                    <Text style={[styles.exampleText, { color: colors.textSecondary }]}>{example}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {error ? (
                        <View style={[styles.error, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                            lightFeedback();
                            const name = parsed?.name?.trim() || text.trim();
                            close();
                            // prefillName seeds the form without turning it into an edit.
                            DeviceEventEmitter.emit('show_habit_modal', { goalId, prefillName: name || undefined });
                        }}
                        style={styles.moreBtn}
                    >
                        <Text style={[styles.moreText, { color: accent }]}>More options</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canSave }}
                        disabled={!canSave || saving}
                        onPress={save}
                        style={[styles.saveBtn, {
                            backgroundColor: canSave ? accent : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'),
                        }]}
                    >
                        {saving ? <ActivityIndicator color="#000" size="small" /> : (
                            <Text style={[styles.saveText, { color: canSave ? '#000' : colors.textTertiary }]}>Add habit</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
    hint: { fontSize: 13, lineHeight: 19, fontFamily: 'Lexend_400Regular' },
    input: { minHeight: 84, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, lineHeight: 22, fontFamily: 'Lexend_400Regular', textAlignVertical: 'top' },
    preview: { padding: 16, gap: 8 },
    previewName: { fontSize: 17, fontFamily: 'Lexend_600SemiBold' },
    previewLine: { fontSize: 13, fontFamily: 'Lexend_400Regular' },
    chipRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
    assumption: { fontSize: 11, lineHeight: 16, fontFamily: 'Lexend_400Regular' },
    exampleLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Lexend_500Medium' },
    example: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
    exampleText: { flex: 1, fontSize: 13, fontFamily: 'Lexend_400Regular' },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular' },
    footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4, gap: 4 },
    moreBtn: { paddingVertical: 10, alignItems: 'center' },
    moreText: { fontSize: 13, fontFamily: 'Lexend_500Medium' },
    saveBtn: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
});
