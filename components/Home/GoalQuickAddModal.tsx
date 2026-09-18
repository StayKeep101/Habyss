import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { VoidCard } from '@/components/Layout/VoidCard';
import { addHabit, getHabits } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { parseGoalText, type GoalSpec, type HabitRef } from '@/lib/goalParser';

interface Props {
    visible?: boolean;
    onClose?: () => void;
    onCreated?: () => void;
    listenToGlobalEvents?: boolean;
}

const EXAMPLES = [
    'Run 50km this month',
    'Gym 3x a week',
    'No more than 1 hour on TikTok a day',
    'Read 300 pages by December',
];

const TYPE_LABEL: Record<string, string> = {
    frequency: 'How often', volume: 'How much', limit: 'Stay under',
    target_value: 'Reach a number', consistency: 'How consistently',
};

/**
 * Goal quick add.
 *
 * A goal is only saved once it reduces to a number, a unit, a window and a
 * direction. Anything vaguer gets one specific question instead of being stored
 * as a wish nothing can measure.
 */
export const GoalQuickAddModal: React.FC<Props> = ({ visible, onClose, onCreated, listenToGlobalEvents }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const router = useRouter();

    const [text, setText] = useState('');
    const [baseline, setBaseline] = useState('');
    const [eventVisible, setEventVisible] = useState(false);
    const [habits, setHabits] = useState<HabitRef[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savingRef = useRef(false);

    const isOpen = listenToGlobalEvents ? eventVisible : !!visible;

    useEffect(() => {
        if (!listenToGlobalEvents) return;
        const subscription = DeviceEventEmitter.addListener('show_goal_quick_add', () => {
            DeviceEventEmitter.emit('close_creation_modal');
            setText(''); setBaseline(''); setError(null);
            setEventVisible(true);
        });
        return () => subscription.remove();
    }, [listenToGlobalEvents]);

    useEffect(() => {
        if (!isOpen) return;
        // Linking needs the user's habits and their units.
        getHabits()
            .then(all => setHabits(all.filter(h => !h.isGoal && !h.isArchived).map(h => ({ id: h.id, name: h.name, unit: h.unit }))))
            .catch(() => setHabits([]));
    }, [isOpen]);

    const close = () => { setEventVisible(false); onClose?.(); };

    const result = useMemo(
        () => (text.trim() ? parseGoalText(text, { today: new Date(), habits }) : null),
        [text, habits],
    );

    const needsBaseline = result?.missing_fields.includes('baseline') ?? false;
    const baselineValue = Number(baseline);
    const baselineReady = !needsBaseline || (baseline.trim() !== '' && Number.isFinite(baselineValue));
    const otherMissing = (result?.missing_fields ?? []).filter(field => field !== 'baseline');
    const canSave = !!result && otherMissing.length === 0 && baselineReady;

    const save = async () => {
        if (!result || !canSave || savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            const baseline = needsBaseline ? baselineValue : result.goal.baseline;
            // "Lose 5 kg" only becomes a number once we know the starting weight.
            const target = result.goal.delta_from_baseline !== null && baseline !== null
                ? baseline - result.goal.delta_from_baseline
                : result.goal.target;
            const spec: GoalSpec = { ...result.goal, baseline, target };
            const window = spec.window;
            const created = await addHabit({
                name: spec.title,
                isGoal: true,
                type: 'build',
                category: 'personal',
                icon: 'flag-outline',
                // percent targets are stored 0-1 in the spec; goal_value is an integer.
                goalValue: spec.metric_unit === 'percent'
                    ? Math.round((spec.target ?? 0) * 100)
                    : Math.round(spec.target ?? 1),
                unit: spec.metric_unit ?? 'sessions',
                goalPeriod: window?.kind === 'recurring'
                    ? (window.period === 'day' ? 'daily' : window.period === 'week' ? 'weekly' : 'monthly')
                    : 'daily',
                startDate: window?.kind === 'fixed' ? window.start : localDateKey(new Date()),
                targetDate: window?.kind === 'fixed' ? window.end : undefined,
                // The full contract, so the goal stays calculable.
                goalSpec: JSON.stringify(spec),
            });
            if (!created?.id) throw new Error('not saved');
            successFeedback();
            setText(''); setBaseline('');
            onCreated?.();
            close();
        } catch {
            setError('Could not save that goal. Nothing was lost — try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const Row = ({ label, value }: { label: string; value: string }) => (
        <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.textTertiary }]}>{label}</Text>
            <Text style={[styles.rowValue, { color: colors.textPrimary }]}>{value}</Text>
        </View>
    );

    const spec = result?.goal;
    const windowText = spec?.window?.kind === 'recurring'
        ? `Every ${spec.window.period}`
        : spec?.window?.kind === 'fixed'
            ? `${spec.window.start} → ${spec.window.end}`
            : '—';

    return (
        <VoidModal visible={isOpen} onClose={close}>
            <View style={{ flex: 1 }}>
                <ModalHeader title="New goal" onBack={close} backIcon="close" />

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                        Describe the goal with a number and a deadline. Habyss only saves goals it can actually measure.
                    </Text>

                    <TextInput
                        value={text}
                        onChangeText={setText}
                        autoFocus
                        multiline
                        placeholder="Run 50km this month"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Describe your goal"
                        style={[styles.input, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                        }]}
                    />

                    {!result ? (
                        <View style={{ gap: 8, marginTop: 4 }}>
                            <Text style={[styles.exampleLabel, { color: colors.textTertiary }]}>TRY</Text>
                            {EXAMPLES.map(example => (
                                <TouchableOpacity
                                    key={example}
                                    onPress={() => { lightFeedback(); setText(example); }}
                                    style={[styles.example, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }]}
                                >
                                    <Ionicons name="flag-outline" size={14} color={accent} />
                                    <Text style={[styles.exampleText, { color: colors.textSecondary }]}>{example}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <VoidCard style={styles.preview}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{spec!.title}</Text>
                            {spec!.type ? (
                                <View style={[styles.badge, { backgroundColor: accent + '1c', borderColor: accent + '55' }]}>
                                    <Text style={{ color: accent, fontSize: 10, letterSpacing: 1, fontFamily: 'Lexend_600SemiBold' }}>
                                        {(TYPE_LABEL[spec!.type] ?? spec!.type).toUpperCase()}
                                    </Text>
                                </View>
                            ) : null}

                            <View style={{ marginTop: 6 }}>
                                <Row
                                    label="Target"
                                    value={spec!.target === null ? '—'
                                        : spec!.metric_unit === 'percent'
                                            ? `${Math.round(spec!.target * 100)}% of days`
                                            : `${spec!.direction === 'at_most' ? 'At most ' : ''}${spec!.target} ${spec!.metric_unit ?? ''}`.trim()}
                                />
                                <Row label="Window" value={windowText} />
                                <Row
                                    label="Tracks"
                                    value={spec!.linked_habits.length
                                        ? `${spec!.linked_habits.length} existing habit${spec!.linked_habits.length === 1 ? '' : 's'}`
                                        : spec!.suggested_habit
                                            ? `New habit: ${spec!.suggested_habit.name} (${spec!.suggested_habit.unit})`
                                            : '—'}
                                />
                            </View>
                        </VoidCard>
                    )}

                    {result?.clarifying_question ? (
                        <View style={[styles.question, { borderColor: accent + '44', backgroundColor: accent + '10' }]}>
                            <Ionicons name="help-circle-outline" size={18} color={accent} />
                            <View style={{ flex: 1, gap: 10 }}>
                                <Text style={[styles.questionText, { color: colors.textPrimary }]}>{result.clarifying_question}</Text>
                                {needsBaseline ? (
                                    <TextInput
                                        value={baseline}
                                        onChangeText={setBaseline}
                                        keyboardType="decimal-pad"
                                        placeholder={`Current ${spec?.metric_unit ?? 'value'}`}
                                        placeholderTextColor={colors.textTertiary}
                                        accessibilityLabel="Current value"
                                        style={[styles.input, styles.baselineInput, {
                                            color: colors.textPrimary, borderColor: colors.border,
                                            backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                                        }]}
                                    />
                                ) : null}
                            </View>
                        </View>
                    ) : null}

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
                        onPress={() => { lightFeedback(); close(); router.push('/create'); }}
                        style={styles.moreBtn}
                    >
                        <Text style={[styles.moreText, { color: accent }]}>Build it step by step instead</Text>
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
                            <Text style={[styles.saveText, { color: canSave ? '#000' : colors.textTertiary }]}>Create goal</Text>
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
    input: { minHeight: 76, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, lineHeight: 22, fontFamily: 'Lexend_400Regular', textAlignVertical: 'top' },
    baselineInput: { minHeight: 0, paddingVertical: 11 },
    preview: { padding: 16, gap: 6 },
    title: { fontSize: 17, fontFamily: 'Lexend_600SemiBold' },
    badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 12 },
    rowLabel: { width: 70, fontSize: 11, letterSpacing: 1, fontFamily: 'Lexend_500Medium' },
    rowValue: { flex: 1, fontSize: 14, fontFamily: 'Lexend_500Medium' },
    question: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
    questionText: { fontSize: 13, lineHeight: 19, fontFamily: 'Lexend_400Regular' },
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
