import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    TextInput, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useRoutines } from '@/constants/RoutineContext';
import { FocusMode } from '@/constants/FocusTimeContext';
import { supabase } from '@/lib/supabase';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

// ============================================
// Routine Builder — Create & Edit Routines
// ============================================

interface HabitOption {
    id: string;
    name: string;
    emoji: string;
    color: string;
}

interface RoutineHabitEntry {
    habitId: string;
    habitName: string;
    habitEmoji: string;
    timerMode: FocusMode;
    focusDuration: number; // seconds
}

const TIME_OPTIONS = [
    { value: 'morning', label: 'Morning', emoji: '☀️' },
    { value: 'afternoon', label: 'Afternoon', emoji: '🌤️' },
    { value: 'evening', label: 'Evening', emoji: '🌙' },
    { value: 'anytime', label: 'Anytime', emoji: '⏰' },
];

const MODE_OPTIONS: { value: FocusMode; label: string; duration: number }[] = [
    { value: 'pomodoro', label: 'Pomodoro', duration: 1500 },
    { value: 'deep_focus', label: 'Deep Work', duration: 5400 },
    { value: 'flow', label: 'Flow', duration: 2700 },
    { value: 'sprint', label: 'Sprint', duration: 600 },
    { value: 'check_in', label: 'Check-in', duration: 300 },
];

const EMOJI_PRESETS = ['☀️', '🌙', '🏋️', '📚', '🧘', '💻', '🎯', '🎨', '✍️', '🧠', '🌿', '🔥'];

interface RoutineBuilderProps {
    routineId?: string; // If editing
    onSave: () => void;
    onCancel: () => void;
}

export const RoutineBuilder: React.FC<RoutineBuilderProps> = ({
    routineId,
    onSave,
    onCancel,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { createRoutine, routines } = useRoutines();

    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('☀️');
    const [timeOfDay, setTimeOfDay] = useState('morning');
    const [habits, setHabits] = useState<RoutineHabitEntry[]>([]);
    const [availableHabits, setAvailableHabits] = useState<HabitOption[]>([]);
    const [showHabitPicker, setShowHabitPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    // Load user's habits
    useEffect(() => {
        loadHabits();
    }, []);

    // If editing, load existing routine
    useEffect(() => {
        if (routineId) {
            const existing = routines.find(r => r.id === routineId);
            if (existing) {
                setName(existing.name);
                setEmoji(existing.emoji);
                setTimeOfDay(existing.timeOfDay);
                setHabits(existing.habits.map(h => ({
                    habitId: h.habitId,
                    habitName: h.habitName,
                    habitEmoji: h.habitEmoji,
                    timerMode: h.timerMode,
                    focusDuration: h.focusDuration,
                })));
            }
        }
    }, [routineId]);

    const loadHabits = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('habits')
                .select('id, name, emoji, color')
                .eq('user_id', user.id)
                .order('name');

            setAvailableHabits((data || []).map(h => ({
                id: h.id,
                name: h.name,
                emoji: h.emoji || '📋',
                color: h.color || '#6366F1',
            })));
        } catch (err) {
            console.error('[RoutineBuilder] Load habits error:', err);
        }
    };

    const addHabit = (habit: HabitOption) => {
        if (habits.some(h => h.habitId === habit.id)) return; // Already added
        setHabits(prev => [...prev, {
            habitId: habit.id,
            habitName: habit.name,
            habitEmoji: habit.emoji,
            timerMode: 'pomodoro',
            focusDuration: 1500,
        }]);
        setShowHabitPicker(false);
    };

    const removeHabit = (index: number) => {
        setHabits(prev => prev.filter((_, i) => i !== index));
    };

    const updateHabitMode = (index: number, mode: FocusMode) => {
        setHabits(prev => {
            const updated = [...prev];
            const modeOption = MODE_OPTIONS.find(m => m.value === mode);
            updated[index] = {
                ...updated[index],
                timerMode: mode,
                focusDuration: modeOption?.duration || 1500,
            };
            return updated;
        });
    };

    const moveHabit = (index: number, direction: -1 | 1) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= habits.length) return;
        setHabits(prev => {
            const updated = [...prev];
            [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
            return updated;
        });
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Name required', 'Give your routine a name');
            return;
        }
        if (habits.length === 0) {
            Alert.alert('Add habits', 'Add at least one habit to your routine');
            return;
        }

        setSaving(true);
        try {
            await createRoutine({
                name: name.trim(),
                emoji,
                timeOfDay,
                habits: habits.map(h => ({
                    habitId: h.habitId,
                    timerMode: h.timerMode,
                    focusDuration: h.focusDuration,
                })),
            });
            onSave();
        } catch (err) {
            Alert.alert('Error', 'Failed to create routine');
        } finally {
            setSaving(false);
        }
    };

    const totalMinutes = Math.round(
        habits.reduce((sum, h) => sum + h.focusDuration, 0) / 60
    );

    // Filter out already-added habits
    const pickableHabits = availableHabits.filter(
        ah => !habits.some(h => h.habitId === ah.id)
    );

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Emoji Picker */}
            <View style={styles.emojiSection}>
                <TouchableOpacity style={styles.selectedEmoji}>
                    <Text style={{ fontSize: 48 }}>{emoji}</Text>
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
                    {EMOJI_PRESETS.map(e => (
                        <TouchableOpacity
                            key={e}
                            onPress={() => setEmoji(e)}
                            style={[
                                styles.emojiOption,
                                emoji === e && {
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    borderColor: colors.primary,
                                },
                            ]}
                        >
                            <Text style={{ fontSize: 22 }}>{e}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Name Input */}
            <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>NAME</Text>
                <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Morning Ritual"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    style={[styles.input, {
                        color: colors.textPrimary,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(255,255,255,0.08)',
                    }]}
                />
            </View>

            {/* Time of Day */}
            <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>TIME OF DAY</Text>
                <View style={styles.timeRow}>
                    {TIME_OPTIONS.map(t => (
                        <TouchableOpacity
                            key={t.value}
                            onPress={() => setTimeOfDay(t.value)}
                            style={[
                                styles.timeOption,
                                {
                                    backgroundColor: timeOfDay === t.value
                                        ? colors.primary + '20'
                                        : 'rgba(255,255,255,0.04)',
                                    borderColor: timeOfDay === t.value
                                        ? colors.primary
                                        : 'rgba(255,255,255,0.08)',
                                },
                            ]}
                        >
                            <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
                            <Text style={[styles.timeLabel, {
                                color: timeOfDay === t.value ? colors.primary : colors.textTertiary,
                            }]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Habits List */}
            <View style={styles.field}>
                <View style={styles.habitsHeader}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>
                        HABITS ({habits.length})
                    </Text>
                    {habits.length > 0 && (
                        <Text style={[styles.totalTime, { color: colors.textTertiary }]}>
                            {totalMinutes} min total
                        </Text>
                    )}
                </View>

                {habits.map((h, i) => (
                    <Animated.View
                        key={h.habitId}
                        entering={FadeInDown.delay(i * 50)}
                        layout={Layout.springify()}
                    >
                        <VoidCard glass style={styles.habitRow}>
                            {/* Reorder buttons */}
                            <View style={styles.reorderBtns}>
                                <TouchableOpacity
                                    onPress={() => moveHabit(i, -1)}
                                    disabled={i === 0}
                                    style={{ opacity: i === 0 ? 0.3 : 1 }}
                                >
                                    <Ionicons name="chevron-up" size={14} color={colors.textTertiary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => moveHabit(i, 1)}
                                    disabled={i === habits.length - 1}
                                    style={{ opacity: i === habits.length - 1 ? 0.3 : 1 }}
                                >
                                    <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>

                            {/* Habit info */}
                            <Text style={{ fontSize: 22, marginRight: 8 }}>{h.habitEmoji}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.habitName, { color: colors.textPrimary }]}>
                                    {h.habitName}
                                </Text>
                                {/* Mode selector */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                                    {MODE_OPTIONS.map(m => (
                                        <TouchableOpacity
                                            key={m.value}
                                            onPress={() => updateHabitMode(i, m.value)}
                                            style={[styles.modePill, {
                                                backgroundColor: h.timerMode === m.value
                                                    ? colors.primary + '25'
                                                    : 'rgba(255,255,255,0.04)',
                                                borderColor: h.timerMode === m.value
                                                    ? colors.primary
                                                    : 'transparent',
                                            }]}
                                        >
                                            <Text style={[styles.modePillText, {
                                                color: h.timerMode === m.value ? colors.primary : colors.textTertiary,
                                            }]}>
                                                {m.label} · {Math.round(m.duration / 60)}m
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Remove */}
                            <TouchableOpacity onPress={() => removeHabit(i)} style={{ padding: 4 }}>
                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
                            </TouchableOpacity>
                        </VoidCard>
                    </Animated.View>
                ))}

                {/* Add habit button */}
                <TouchableOpacity
                    onPress={() => setShowHabitPicker(true)}
                    style={[styles.addHabitBtn, { borderColor: 'rgba(255,255,255,0.1)' }]}
                >
                    <Ionicons name="add" size={20} color={colors.primary} />
                    <Text style={[styles.addHabitText, { color: colors.primary }]}>Add Habit</Text>
                </TouchableOpacity>
            </View>

            {/* Habit Picker */}
            {showHabitPicker && (
                <Animated.View entering={FadeInDown.springify()} style={styles.pickerContainer}>
                    <View style={styles.pickerHeader}>
                        <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Select Habit</Text>
                        <TouchableOpacity onPress={() => setShowHabitPicker(false)}>
                            <Ionicons name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    {pickableHabits.length === 0 ? (
                        <Text style={[styles.emptyPicker, { color: colors.textTertiary }]}>
                            {availableHabits.length === 0
                                ? 'Create habits first to add them to routines'
                                : 'All habits are already in this routine'}
                        </Text>
                    ) : (
                        pickableHabits.map(h => (
                            <TouchableOpacity
                                key={h.id}
                                onPress={() => addHabit(h)}
                                style={styles.pickerRow}
                            >
                                <Text style={{ fontSize: 20, marginRight: 10 }}>{h.emoji}</Text>
                                <Text style={[styles.pickerHabitName, { color: colors.textPrimary }]}>
                                    {h.name}
                                </Text>
                            </TouchableOpacity>
                        ))
                    )}
                </Animated.View>
            )}

            {/* Save / Cancel Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={[styles.saveBtn, {
                        backgroundColor: colors.primary,
                        opacity: saving ? 0.6 : 1,
                    }]}
                >
                    <Text style={styles.saveBtnText}>
                        {saving ? 'Saving...' : routineId ? 'Update Routine' : 'Create Routine'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                    <Text style={[styles.cancelBtnText, { color: colors.textTertiary }]}>Cancel</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    emojiSection: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    selectedEmoji: {
        marginBottom: 12,
    },
    emojiRow: {
        flexDirection: 'row',
    },
    emojiOption: {
        padding: 8,
        borderRadius: 10,
        marginHorizontal: 3,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    field: {
        marginBottom: 24,
    },
    label: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 2,
        marginBottom: 8,
    },
    input: {
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    timeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    timeOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
    },
    timeLabel: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
    },
    habitsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    totalTime: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
    },
    habitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 6,
    },
    reorderBtns: {
        marginRight: 8,
        alignItems: 'center',
        gap: 2,
    },
    habitName: {
        fontSize: 13,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    modePill: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginRight: 6,
    },
    modePillText: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
    },
    addHabitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        gap: 6,
    },
    addHabitText: {
        fontSize: 13,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    pickerContainer: {
        backgroundColor: 'rgba(20,20,30,0.95)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    pickerTitle: {
        fontSize: 14,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    emptyPicker: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
        paddingVertical: 16,
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    pickerHabitName: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
    actions: {
        marginTop: 8,
        gap: 10,
    },
    saveBtn: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#000',
        fontSize: 15,
        fontFamily: 'Lexend',
        fontWeight: '700',
    },
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    cancelBtnText: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
    },
});
