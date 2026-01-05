import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    StyleSheet,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
    DeviceEventEmitter,
    Alert,
    Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { addHabit, HabitCategory, HabitFrequency, subscribeToHabits, Habit } from '@/lib/habits';

const { width, height } = Dimensions.get('window');

const ICONS = [
    'fitness', 'book', 'water', 'bed', 'cafe', 'walk', 'bicycle', 'barbell',
    'heart', 'musical-notes', 'brush', 'code-slash', 'language', 'leaf',
    'moon', 'sunny', 'flash', 'rocket', 'bulb', 'star', 'trophy', 'medkit',
    'pizza', 'wine', 'game-controller', 'headset', 'camera', 'airplane'
];

const COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const CATEGORIES: { id: HabitCategory; label: string; icon: string }[] = [
    { id: 'health', label: 'Health', icon: 'heart' },
    { id: 'fitness', label: 'Fitness', icon: 'barbell' },
    { id: 'productivity', label: 'Productivity', icon: 'rocket' },
    { id: 'mindfulness', label: 'Mindfulness', icon: 'leaf' },
    { id: 'learning', label: 'Learning', icon: 'book' },
    { id: 'creativity', label: 'Creativity', icon: 'brush' },
    { id: 'social', label: 'Social', icon: 'people' },
    { id: 'personal', label: 'Personal', icon: 'person' },
];

const WEEKDAYS = [
    { id: 'mon', label: 'Mon' },
    { id: 'tue', label: 'Tue' },
    { id: 'wed', label: 'Wed' },
    { id: 'thu', label: 'Thu' },
    { id: 'fri', label: 'Fri' },
    { id: 'sat', label: 'Sat' },
    { id: 'sun', label: 'Sun' },
];

interface HabitCreationModalProps {
    visible?: boolean;
    onClose?: () => void;
    onSuccess?: () => void;
    goalId?: string;
}

export const HabitCreationModal: React.FC<HabitCreationModalProps> = ({
    visible: propVisible,
    onClose: propOnClose,
    onSuccess: propOnSuccess,
    goalId: propGoalId,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, selectionFeedback, successFeedback } = useHaptics();

    // Modal visibility
    const [isVisible, setIsVisible] = useState(false);
    const [availableGoals, setAvailableGoals] = useState<Habit[]>([]);

    // Form state
    const [title, setTitle] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('fitness');
    const [selectedColor, setSelectedColor] = useState('#10B981');
    const [category, setCategory] = useState<HabitCategory>('personal');
    const [goalId, setGoalId] = useState<string | undefined>(propGoalId);
    const [frequency, setFrequency] = useState<HabitFrequency>('daily');
    const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 30 * 60 * 1000));
    const [useFreeTime, setUseFreeTime] = useState(false);
    const [habitStartDate, setHabitStartDate] = useState(new Date());
    const [saving, setSaving] = useState(false);

    // Sub-modals
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);

    // Linked goal data
    const linkedGoal = useMemo(() => availableGoals.find(g => g.id === goalId), [availableGoals, goalId]);

    // Fetch goals
    useEffect(() => {
        const unsub = subscribeToHabits((habits) => {
            setAvailableGoals(habits.filter(h => h.isGoal));
        });
        return () => { unsub.then(fn => fn()) };
    }, []);

    // Sync with props
    useEffect(() => {
        if (propVisible !== undefined) setIsVisible(propVisible);
    }, [propVisible]);

    useEffect(() => {
        if (propGoalId !== undefined) setGoalId(propGoalId);
    }, [propGoalId]);

    // Global event listener
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('show_habit_modal', (data) => {
            selectionFeedback();
            setIsVisible(true);
            setGoalId(data?.goalId || undefined);
        });
        return () => subscription.remove();
    }, []);

    const resetForm = () => {
        setTitle('');
        setSelectedIcon('fitness');
        setSelectedColor('#10B981');
        setCategory('personal');
        setFrequency('daily');
        setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
        setStartTime(new Date());
        setEndTime(new Date(Date.now() + 30 * 60 * 1000));
        setUseFreeTime(false);
        setHabitStartDate(new Date());
    };

    const handleClose = () => {
        setIsVisible(false);
        if (propOnClose) propOnClose();
        resetForm();
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Missing Title', 'Please enter a title for your habit.');
            return;
        }
        if (!goalId) {
            Alert.alert('Goal Required', 'Every habit must be linked to a goal.');
            return;
        }

        setSaving(true);
        mediumFeedback();

        try {
            const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const fmtDate = (d: Date) => d.toISOString().split('T')[0];

            await addHabit({
                name: title.trim(),
                icon: selectedIcon,
                color: selectedColor,
                category,
                goalId,
                startTime: useFreeTime ? undefined : fmtTime(startTime),
                endTime: useFreeTime ? undefined : fmtTime(endTime),
                taskDays: frequency === 'weekly' ? selectedDays : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                startDate: fmtDate(habitStartDate),
                isArchived: false,
            });

            successFeedback();
            setIsVisible(false);
            if (propOnSuccess) propOnSuccess();
            resetForm();
        } catch (e: any) {
            console.error('Error adding habit:', e);
            Alert.alert('Error', e.message || 'Failed to create habit');
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (dayId: string) => {
        selectionFeedback();
        setSelectedDays(prev =>
            prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
        );
    };

    const repeatText = useMemo(() => {
        if (frequency !== 'weekly') return '';
        const days = WEEKDAYS.filter(d => selectedDays.includes(d.id)).map(d => d.label);
        if (days.length === 7) return 'Every day';
        if (days.length === 0) return 'Select days';
        return `Every ${days.join(', ')}`;
    }, [frequency, selectedDays]);

    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!isVisible) return null;

    return (
        <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <SafeAreaView style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                            <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>New Habit</Text>
                        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: selectedColor }]}>
                            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create'}</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
                        {/* Title Row with Icon */}
                        <View style={styles.titleRow}>
                            <TouchableOpacity onPress={() => { selectionFeedback(); setShowIconPicker(true); }} style={[styles.iconBtn, { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}>
                                <Ionicons name={selectedIcon as any} size={28} color={selectedColor} />
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.titleInput, { color: colors.textPrimary, borderColor: colors.border }]}
                                placeholder="Habit name..."
                                placeholderTextColor={colors.textTertiary}
                                value={title}
                                onChangeText={setTitle}
                            />
                        </View>

                        {/* Category */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {CATEGORIES.map(cat => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            onPress={() => { selectionFeedback(); setCategory(cat.id); }}
                                            style={[styles.catChip, category === cat.id && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                        >
                                            <Ionicons name={cat.icon as any} size={14} color={category === cat.id ? selectedColor : colors.textSecondary} />
                                            <Text style={{ color: category === cat.id ? selectedColor : colors.textSecondary, fontSize: 12, marginLeft: 6 }}>{cat.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        {/* Color Picker */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>COLOR</Text>
                            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                                {COLORS.map(c => (
                                    <TouchableOpacity key={c} onPress={() => { selectionFeedback(); setSelectedColor(c); }} style={[styles.colorDot, { backgroundColor: c, borderWidth: selectedColor === c ? 3 : 0, borderColor: 'white' }]} />
                                ))}
                            </View>
                        </View>

                        {/* Goal Link */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>LINKED GOAL <Text style={{ color: '#EF4444' }}>*</Text></Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {availableGoals.length === 0 ? (
                                        <View style={[styles.goalChip, { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                            <Ionicons name="warning" size={14} color="#EF4444" />
                                            <Text style={{ color: '#EF4444', marginLeft: 6, fontSize: 12 }}>Create a goal first</Text>
                                        </View>
                                    ) : availableGoals.map(goal => (
                                        <TouchableOpacity
                                            key={goal.id}
                                            onPress={() => { selectionFeedback(); setGoalId(goal.id); }}
                                            style={[styles.goalChip, goalId === goal.id && { backgroundColor: goal.color + '20', borderColor: goal.color }]}
                                        >
                                            <Ionicons name={goal.icon as any} size={14} color={goalId === goal.id ? goal.color : colors.textSecondary} />
                                            <Text style={{ color: goalId === goal.id ? goal.color : colors.textSecondary, marginLeft: 6, fontSize: 12 }}>{goal.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        {/* Frequency */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>FREQUENCY</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {(['daily', 'weekly'] as HabitFrequency[]).map(f => (
                                    <TouchableOpacity
                                        key={f}
                                        onPress={() => { selectionFeedback(); setFrequency(f); }}
                                        style={[styles.freqBtn, frequency === f && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                    >
                                        <Text style={{ color: frequency === f ? selectedColor : colors.textSecondary, fontWeight: '600' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Weekly Day Selector */}
                            {frequency === 'weekly' && (
                                <View style={{ marginTop: 16 }}>
                                    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'space-between' }}>
                                        {WEEKDAYS.map(day => (
                                            <TouchableOpacity
                                                key={day.id}
                                                onPress={() => toggleDay(day.id)}
                                                style={[styles.dayBtn, selectedDays.includes(day.id) && { backgroundColor: selectedColor, borderColor: selectedColor }]}
                                            >
                                                <Text style={{ color: selectedDays.includes(day.id) ? 'white' : colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{day.label[0]}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>{repeatText}</Text>
                                </View>
                            )}
                        </View>

                        {/* Time */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>TIME</Text>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                <TouchableOpacity
                                    onPress={() => { selectionFeedback(); setUseFreeTime(!useFreeTime); }}
                                    style={[styles.freeTimeBtn, useFreeTime && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                >
                                    <Ionicons name="calendar-outline" size={16} color={useFreeTime ? selectedColor : colors.textSecondary} />
                                    <Text style={{ color: useFreeTime ? selectedColor : colors.textSecondary, marginLeft: 6, fontSize: 12 }}>Free Time</Text>
                                </TouchableOpacity>

                                {!useFreeTime && (
                                    <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.timeBtn}>
                                        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{formatTime(startTime)} - {formatTime(endTime)}</Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Date Range */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>DATE RANGE</Text>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={[styles.dateBox, { flex: 1 }]}>
                                    <Text style={{ color: colors.textTertiary, fontSize: 10, marginBottom: 4 }}>START DATE</Text>
                                    <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{habitStartDate.toLocaleDateString()}</Text>
                                </TouchableOpacity>
                                <View style={[styles.dateBox, { flex: 1, opacity: 0.6 }]}>
                                    <Text style={{ color: colors.textTertiary, fontSize: 10, marginBottom: 4 }}>END DATE (FROM GOAL)</Text>
                                    <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                                        {linkedGoal?.targetDate ? new Date(linkedGoal.targetDate).toLocaleDateString() : 'No goal'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>

                {/* Icon Picker Modal */}
                <Modal visible={showIconPicker} transparent animationType="fade">
                    <Pressable style={styles.overlay} onPress={() => setShowIconPicker(false)}>
                        <Pressable style={[styles.pickerModal, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>
                            <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Choose Icon</Text>
                            <View style={styles.iconGrid}>
                                {ICONS.map(icon => (
                                    <TouchableOpacity
                                        key={icon}
                                        onPress={() => { selectionFeedback(); setSelectedIcon(icon); setShowIconPicker(false); }}
                                        style={[styles.iconOption, selectedIcon === icon && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                    >
                                        <Ionicons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : colors.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Time Picker Modal */}
                <Modal visible={showTimePicker} transparent animationType="fade">
                    <Pressable style={styles.overlay} onPress={() => setShowTimePicker(false)}>
                        <Pressable style={[styles.timePickerModal, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>
                            <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>Set Time</Text>
                            <View style={styles.timePickerRow}>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Start</Text>
                                    <DateTimePicker value={startTime} mode="time" display="spinner" onChange={(_, d) => d && setStartTime(d)} textColor={colors.textPrimary} />
                                </View>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>End</Text>
                                    <DateTimePicker value={endTime} mode="time" display="spinner" onChange={(_, d) => d && setEndTime(d)} textColor={colors.textPrimary} />
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setShowTimePicker(false)} style={[styles.doneBtn, { backgroundColor: selectedColor }]}>
                                <Text style={{ color: 'white', fontWeight: '600' }}>Done</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Start Date Picker */}
                {showStartDatePicker && (
                    <DateTimePicker
                        value={habitStartDate}
                        mode="date"
                        display="default"
                        onChange={(_, d) => { setShowStartDatePicker(false); if (d) setHabitStartDate(d); }}
                    />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    headerBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    saveBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
    content: { flex: 1, padding: 20 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
    iconBtn: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    titleInput: { flex: 1, fontSize: 18, fontWeight: '600', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
    section: { marginBottom: 24 },
    label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
    catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    goalChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    freqBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    dayBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    freeTimeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    timeBtn: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    dateBox: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    pickerModal: { width: '100%', maxWidth: 350, borderRadius: 20, padding: 20 },
    pickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
    iconOption: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    timePickerModal: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 20 },
    timePickerRow: { flexDirection: 'row', marginBottom: 20 },
    doneBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});
