import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { addHabit, HabitCategory, HabitFrequency, subscribeToHabits, Habit } from '@/lib/habits';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height; // Full screen
const DRAG_THRESHOLD = 120;
const BOTTOM_PADDING = 100;

const ICONS = [
    'fitness', 'book', 'water', 'bed', 'cafe', 'walk', 'bicycle', 'barbell',
    'heart', 'musical-notes', 'brush', 'code-slash', 'language', 'leaf',
    'moon', 'sunny', 'flash', 'rocket', 'bulb', 'star', 'trophy', 'medkit',
    'pizza', 'wine', 'game-controller', 'headset', 'camera', 'airplane'
];

const COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
    '#14B8A6', '#A855F7', '#F43F5E', '#22C55E', '#0EA5E9'
];

const RINGTONES = [
    { id: 'default', label: 'Default', icon: 'notifications' },
    { id: 'chime', label: 'Chime', icon: 'musical-note' },
    { id: 'bell', label: 'Bell', icon: 'notifications-outline' },
    { id: 'alarm', label: 'Alarm', icon: 'alarm' },
    { id: 'vibrate', label: 'Vibrate Only', icon: 'phone-portrait' },
    { id: 'silent', label: 'Silent', icon: 'volume-mute' },
];

const UNITS = [
    { id: 'times', label: 'times' },
    { id: 'minutes', label: 'minutes' },
    { id: 'hours', label: 'hours' },
    { id: 'ml', label: 'ml' },
    { id: 'liters', label: 'liters' },
    { id: 'glasses', label: 'glasses' },
    { id: 'pages', label: 'pages' },
    { id: 'steps', label: 'steps' },
    { id: 'km', label: 'km' },
    { id: 'miles', label: 'miles' },
    { id: 'calories', label: 'calories' },
    { id: 'reps', label: 'reps' },
    { id: 'sets', label: 'sets' },
];

const GRAPH_STYLES = [
    { id: 'progress', label: 'Progress Ring', icon: 'pie-chart' },
    { id: 'bar', label: 'Bar Chart', icon: 'bar-chart' },
    { id: 'line', label: 'Line Chart', icon: 'trending-up' },
    { id: 'heatmap', label: 'Heatmap', icon: 'grid' },
    { id: 'streak', label: 'Streak Counter', icon: 'flame' },
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

    const [isVisible, setIsVisible] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [availableGoals, setAvailableGoals] = useState<Habit[]>([]);

    // Form state
    const [title, setTitle] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('fitness');
    const [selectedColor, setSelectedColor] = useState('#10B981');
    const [goalId, setGoalId] = useState<string | undefined>(propGoalId);
    const [frequency, setFrequency] = useState<HabitFrequency>('daily');
    const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 30 * 60 * 1000));
    const [useFreeTime, setUseFreeTime] = useState(false);
    const [habitStartDate, setHabitStartDate] = useState(new Date());
    const [saving, setSaving] = useState(false);

    // New fields
    const [reminderEnabled, setReminderEnabled] = useState(true);
    const [reminderTime, setReminderTime] = useState(new Date());
    const [ringtone, setRingtone] = useState('default');
    const [measurementValue, setMeasurementValue] = useState(1);
    const [measurementUnit, setMeasurementUnit] = useState('times');
    const [graphStyle, setGraphStyle] = useState('progress');

    // Sub-modals
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showReminderPicker, setShowReminderPicker] = useState(false);
    const [showRingtonePicker, setShowRingtonePicker] = useState(false);
    const [showMeasurementPicker, setShowMeasurementPicker] = useState(false);
    const [showGraphPicker, setShowGraphPicker] = useState(false);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);

    // Bottom sheet animation
    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const linkedGoal = useMemo(() => availableGoals.find(g => g.id === goalId), [availableGoals, goalId]);

    useEffect(() => {
        const unsub = subscribeToHabits((habits) => {
            setAvailableGoals(habits.filter(h => h.isGoal));
        });
        return () => { unsub.then(fn => fn()) };
    }, []);

    useEffect(() => {
        if (propVisible !== undefined) setIsVisible(propVisible);
    }, [propVisible]);

    useEffect(() => {
        if (propGoalId !== undefined) setGoalId(propGoalId);
    }, [propGoalId]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('show_habit_modal', (data) => {
            selectionFeedback();
            setGoalId(data?.goalId || undefined);
            setIsVisible(true);
        });
        return () => subscription.remove();
    }, []);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 300 });
    }, []);

    const closeModal = useCallback(() => {
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 350, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(() => {
            setIsOpen(false);
            setIsVisible(false);
            if (propOnClose) propOnClose();
            resetForm();
        }, 350);
    }, [propOnClose]);

    useEffect(() => {
        if (isVisible && !isOpen) {
            openModal();
        }
    }, [isVisible]);

    const resetForm = () => {
        setTitle('');
        setSelectedIcon('fitness');
        setSelectedColor('#10B981');
        setFrequency('daily');
        setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
        setStartTime(new Date());
        setEndTime(new Date(Date.now() + 30 * 60 * 1000));
        setUseFreeTime(false);
        setHabitStartDate(new Date());
        setReminderEnabled(true);
        setReminderTime(new Date());
        setRingtone('default');
        setMeasurementValue(1);
        setMeasurementUnit('times');
        setGraphStyle('progress');
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
                category: 'personal',
                goalId,
                startTime: useFreeTime ? undefined : fmtTime(startTime),
                endTime: useFreeTime ? undefined : fmtTime(endTime),
                taskDays: frequency === 'weekly' ? selectedDays : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                startDate: fmtDate(habitStartDate),
                isArchived: false,
            });

            successFeedback();
            if (propOnSuccess) propOnSuccess();
            closeModal();
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

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) {
                runOnJS(closeModal)();
            } else {
                translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
            }
        });

    const sheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP),
    }));

    const handleIndicatorStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, 50], [1, 0.5], Extrapolation.CLAMP),
    }));

    if (!isOpen && !isVisible) return null;

    return (
        <Modal visible={isOpen || isVisible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
                    <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
                        <LinearGradient colors={['#0f1218', '#080a0e']} style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder]} />

                        <View style={styles.handleContainer}>
                            <View style={styles.handle} />
                        </View>

                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                                <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.headerTitle}>NEW HABIT</Text>
                                <Text style={[styles.headerSubtitle, { color: linkedGoal?.color || '#10B981' }]}>{linkedGoal ? linkedGoal.name.toUpperCase() : 'DAILY ROUTINE'}</Text>
                            </View>
                            <View style={{ width: 40 }} />
                        </View>

                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                {/* Title Row with Icon and Color */}
                                <View style={styles.titleRow}>
                                    <TouchableOpacity onPress={() => { selectionFeedback(); setShowIconPicker(true); }} style={[styles.iconBtn, { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}>
                                        <Ionicons name={selectedIcon as any} size={28} color={selectedColor} />
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.titleInput}
                                        placeholder="Habit name..."
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        value={title}
                                        onChangeText={setTitle}
                                    />
                                    <TouchableOpacity onPress={() => { selectionFeedback(); setShowColorPicker(true); }} style={[styles.milicolorBtn, { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}>
                                        <View style={[styles.milicolorDot, { backgroundColor: selectedColor }]} />
                                        <Text style={[styles.milicolorText, { color: selectedColor }]}>milicolor</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Goal Link */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>LINKED GOAL <Text style={{ color: '#EF4444' }}>*</Text></Text>
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
                                                    <Ionicons name={goal.icon as any} size={14} color={goalId === goal.id ? goal.color : 'rgba(255,255,255,0.5)'} />
                                                    <Text style={{ color: goalId === goal.id ? goal.color : 'rgba(255,255,255,0.5)', marginLeft: 6, fontSize: 12 }}>{goal.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>

                                {/* Frequency */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>FREQUENCY</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {(['daily', 'weekly'] as HabitFrequency[]).map(f => (
                                            <TouchableOpacity
                                                key={f}
                                                onPress={() => { selectionFeedback(); setFrequency(f); }}
                                                style={[styles.optionBtn, frequency === f && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                            >
                                                <Text style={{ color: frequency === f ? selectedColor : 'rgba(255,255,255,0.5)', fontWeight: '600' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {frequency === 'weekly' && (
                                        <View style={{ marginTop: 16 }}>
                                            <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'space-between' }}>
                                                {WEEKDAYS.map(day => (
                                                    <TouchableOpacity
                                                        key={day.id}
                                                        onPress={() => toggleDay(day.id)}
                                                        style={[styles.dayBtn, selectedDays.includes(day.id) && { backgroundColor: selectedColor, borderColor: selectedColor }]}
                                                    >
                                                        <Text style={{ color: selectedDays.includes(day.id) ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' }}>{day.label[0]}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{repeatText}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Time */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>TIME FRAME</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setUseFreeTime(!useFreeTime); }}
                                            style={[styles.optionBtn, useFreeTime && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                        >
                                            <Ionicons name="infinite" size={16} color={useFreeTime ? selectedColor : 'rgba(255,255,255,0.5)'} />
                                            <Text style={{ color: useFreeTime ? selectedColor : 'rgba(255,255,255,0.5)', marginLeft: 6, fontSize: 12 }}>Anytime</Text>
                                        </TouchableOpacity>

                                        {!useFreeTime && (
                                            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.timeBtn}>
                                                <Ionicons name="time-outline" size={16} color={selectedColor} />
                                                <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>{formatTime(startTime)} - {formatTime(endTime)}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Measurement */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>GOAL MEASUREMENT</Text>
                                    <TouchableOpacity onPress={() => setShowMeasurementPicker(true)} style={styles.measurementBtn}>
                                        <Text style={styles.measurementValue}>{measurementValue}</Text>
                                        <Text style={styles.measurementUnit}>{UNITS.find(u => u.id === measurementUnit)?.label}</Text>
                                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                                    </TouchableOpacity>
                                </View>

                                {/* Reminder */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>REMINDER</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setReminderEnabled(!reminderEnabled); }}
                                            style={[styles.optionBtn, reminderEnabled && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                        >
                                            <Ionicons name={reminderEnabled ? 'notifications' : 'notifications-off'} size={16} color={reminderEnabled ? selectedColor : 'rgba(255,255,255,0.5)'} />
                                            <Text style={{ color: reminderEnabled ? selectedColor : 'rgba(255,255,255,0.5)', marginLeft: 6, fontSize: 12 }}>{reminderEnabled ? 'On' : 'Off'}</Text>
                                        </TouchableOpacity>

                                        {reminderEnabled && (
                                            <TouchableOpacity onPress={() => setShowReminderPicker(true)} style={styles.timeBtn}>
                                                <Ionicons name="alarm-outline" size={16} color={selectedColor} />
                                                <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>{formatTime(reminderTime)}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Ringtone */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>RINGTONE</Text>
                                    <TouchableOpacity onPress={() => setShowRingtonePicker(true)} style={styles.selectBtn}>
                                        <Ionicons name={RINGTONES.find(r => r.id === ringtone)?.icon as any} size={18} color={selectedColor} />
                                        <Text style={styles.selectText}>{RINGTONES.find(r => r.id === ringtone)?.label}</Text>
                                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                                    </TouchableOpacity>
                                </View>

                                {/* Graph Style */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>GRAPH STYLE</Text>
                                    <TouchableOpacity onPress={() => setShowGraphPicker(true)} style={styles.selectBtn}>
                                        <Ionicons name={GRAPH_STYLES.find(g => g.id === graphStyle)?.icon as any} size={18} color={selectedColor} />
                                        <Text style={styles.selectText}>{GRAPH_STYLES.find(g => g.id === graphStyle)?.label}</Text>
                                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                                    </TouchableOpacity>
                                </View>

                                {/* Date Range */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>DATE RANGE</Text>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={[styles.dateBox, { flex: 1 }]}>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 4 }}>START DATE</Text>
                                            <Text style={{ color: '#fff', fontWeight: '600' }}>{habitStartDate.toLocaleDateString()}</Text>
                                        </TouchableOpacity>
                                        <View style={[styles.dateBox, { flex: 1, opacity: 0.6 }]}>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 4 }}>END DATE</Text>
                                            <Text style={{ color: '#fff', fontWeight: '600' }}>
                                                {linkedGoal?.targetDate ? new Date(linkedGoal.targetDate).toLocaleDateString() : 'From goal'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>

                        {/* FAB Create Button */}
                        <View style={styles.fabContainer}>
                            <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.fabBtn, { backgroundColor: selectedColor }]}>
                                <Ionicons name={saving ? 'hourglass' : 'checkmark'} size={28} color="white" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </GestureDetector>

                {/* Icon Picker Modal */}
                <Modal visible={showIconPicker} transparent animationType="fade">
                    <Pressable style={styles.overlay} onPress={() => setShowIconPicker(false)}>
                        <Pressable style={styles.pickerModal} onPress={e => e.stopPropagation()}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Choose Icon</Text>
                            <View style={styles.iconGrid}>
                                {ICONS.map(icon => (
                                    <TouchableOpacity
                                        key={icon}
                                        onPress={() => { selectionFeedback(); setSelectedIcon(icon); setShowIconPicker(false); }}
                                        style={[styles.iconOption, selectedIcon === icon && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                    >
                                        <Ionicons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : 'rgba(255,255,255,0.5)'} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Color Picker Modal */}
                <Modal visible={showColorPicker} transparent animationType="slide">
                    <View style={styles.bottomModalContainer}>
                        <Pressable style={styles.bottomModalBackdrop} onPress={() => setShowColorPicker(false)} />
                        <View style={styles.bottomModal}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Choose Color</Text>
                            <View style={styles.colorGrid}>
                                {COLORS.map(c => (
                                    <TouchableOpacity key={c} onPress={() => { selectionFeedback(); setSelectedColor(c); setShowColorPicker(false); }} style={[styles.colorOption, { backgroundColor: c }, selectedColor === c && styles.colorSelected]} />
                                ))}
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Time Picker Modal */}
                <Modal visible={showTimePicker} transparent animationType="slide">
                    <View style={styles.bottomModalContainer}>
                        <Pressable style={styles.bottomModalBackdrop} onPress={() => setShowTimePicker(false)} />
                        <View style={styles.bottomModal}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Set Time Frame</Text>
                            <View style={styles.timePickerRow}>
                                <View style={styles.timePickerColumn}>
                                    <View style={styles.timePickerLabelContainer}>
                                        <Ionicons name="time-outline" size={16} color="#10B981" />
                                        <Text style={styles.timePickerLabel}>Start</Text>
                                    </View>
                                    <View style={styles.timePickerWrapper}>
                                        <DateTimePicker value={startTime} mode="time" display="spinner" onChange={(_, d) => d && setStartTime(d)} textColor="#fff" style={{ height: 180, width: 140 }} />
                                    </View>
                                </View>
                                <View style={styles.timePickerDivider}>
                                    <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.3)" />
                                </View>
                                <View style={styles.timePickerColumn}>
                                    <View style={styles.timePickerLabelContainer}>
                                        <Ionicons name="time-outline" size={16} color="#EF4444" />
                                        <Text style={styles.timePickerLabel}>End</Text>
                                    </View>
                                    <View style={styles.timePickerWrapper}>
                                        <DateTimePicker value={endTime} mode="time" display="spinner" onChange={(_, d) => d && setEndTime(d)} textColor="#fff" style={{ height: 180, width: 140 }} />
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setShowTimePicker(false)} style={[styles.doneBtn, { backgroundColor: selectedColor }]}>
                                <Text style={{ color: 'white', fontWeight: '700' }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Reminder Time Picker */}
                <Modal visible={showReminderPicker} transparent animationType="slide">
                    <View style={styles.bottomModalContainer}>
                        <Pressable style={styles.bottomModalBackdrop} onPress={() => setShowReminderPicker(false)} />
                        <View style={styles.bottomModal}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Set Reminder</Text>
                            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                <DateTimePicker value={reminderTime} mode="time" display="spinner" onChange={(_, d) => d && setReminderTime(d)} textColor="#fff" style={{ height: 150, width: 200 }} />
                            </View>
                            <TouchableOpacity onPress={() => setShowReminderPicker(false)} style={[styles.doneBtn, { backgroundColor: selectedColor }]}>
                                <Text style={{ color: 'white', fontWeight: '700' }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Ringtone Picker Modal */}
                <Modal visible={showRingtonePicker} transparent animationType="slide">
                    <View style={styles.bottomModalContainer}>
                        <Pressable style={styles.bottomModalBackdrop} onPress={() => setShowRingtonePicker(false)} />
                        <View style={styles.bottomModal}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Choose Ringtone</Text>
                            {RINGTONES.map(r => (
                                <TouchableOpacity key={r.id} onPress={() => { selectionFeedback(); setRingtone(r.id); setShowRingtonePicker(false); }} style={[styles.listItem, ringtone === r.id && { backgroundColor: selectedColor + '20' }]}>
                                    <Ionicons name={r.icon as any} size={20} color={ringtone === r.id ? selectedColor : 'rgba(255,255,255,0.5)'} />
                                    <Text style={[styles.listItemText, { color: ringtone === r.id ? selectedColor : '#fff' }]}>{r.label}</Text>
                                    {ringtone === r.id && <Ionicons name="checkmark" size={20} color={selectedColor} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Modal>

                {/* Measurement Picker Modal */}
                <Modal visible={showMeasurementPicker} transparent animationType="slide">
                    <View style={styles.bottomModalContainer}>
                        <Pressable style={styles.bottomModalBackdrop} onPress={() => setShowMeasurementPicker(false)} />
                        <View style={styles.bottomModal}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Set Measurement</Text>

                            {/* Number controls */}
                            <View style={styles.measurementControls}>
                                <TouchableOpacity onPress={() => { selectionFeedback(); setMeasurementValue(Math.max(1, measurementValue - 1)); }} style={styles.measurementControlBtn}>
                                    <Ionicons name="remove" size={28} color="#fff" />
                                </TouchableOpacity>
                                <Text style={styles.measurementDisplay}>{measurementValue}</Text>
                                <TouchableOpacity onPress={() => { selectionFeedback(); setMeasurementValue(measurementValue + 1); }} style={styles.measurementControlBtn}>
                                    <Ionicons name="add" size={28} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Unit selection */}
                            <Text style={[styles.label, { marginTop: 20, marginBottom: 10 }]}>UNIT</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                                    {UNITS.map(u => (
                                        <TouchableOpacity key={u.id} onPress={() => { selectionFeedback(); setMeasurementUnit(u.id); }} style={[styles.unitChip, measurementUnit === u.id && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}>
                                            <Text style={{ color: measurementUnit === u.id ? selectedColor : 'rgba(255,255,255,0.5)', fontSize: 13 }}>{u.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>

                            <TouchableOpacity onPress={() => setShowMeasurementPicker(false)} style={[styles.doneBtn, { backgroundColor: selectedColor }]}>
                                <Text style={{ color: 'white', fontWeight: '700' }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Graph Style Picker Modal */}
                <Modal visible={showGraphPicker} transparent animationType="slide">
                    <View style={styles.bottomModalContainer}>
                        <Pressable style={styles.bottomModalBackdrop} onPress={() => setShowGraphPicker(false)} />
                        <View style={styles.bottomModal}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Choose Graph Style</Text>
                            {GRAPH_STYLES.map(g => (
                                <TouchableOpacity key={g.id} onPress={() => { selectionFeedback(); setGraphStyle(g.id); setShowGraphPicker(false); }} style={[styles.listItem, graphStyle === g.id && { backgroundColor: selectedColor + '20' }]}>
                                    <Ionicons name={g.icon as any} size={20} color={graphStyle === g.id ? selectedColor : 'rgba(255,255,255,0.5)'} />
                                    <Text style={[styles.listItemText, { color: graphStyle === g.id ? selectedColor : '#fff' }]}>{g.label}</Text>
                                    {graphStyle === g.id && <Ionicons name="checkmark" size={20} color={selectedColor} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
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
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(16, 185, 129, 0.15)', pointerEvents: 'none' },
    handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1, fontFamily: 'Lexend' },
    headerSubtitle: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, fontFamily: 'Lexend_400Regular', marginTop: 1 },
    content: { flex: 1, padding: 20 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
    iconBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    colorBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    titleInput: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' },
    section: { marginBottom: 20 },
    label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 10, color: 'rgba(255,255,255,0.5)' },
    goalChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    optionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    dayBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    timeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    measurementBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    measurementValue: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginRight: 8 },
    measurementUnit: { fontSize: 14, color: 'rgba(255,255,255,0.6)', flex: 1 },
    selectBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 12 },
    selectText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#fff' },
    dateBox: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    fabContainer: { position: 'absolute', bottom: 30, right: 20, zIndex: 100 },
    fabBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
    overlay: { flex: 1, backgroundColor: '#0a0d14', justifyContent: 'flex-end' },
    pickerModal: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, backgroundColor: '#1a1f2e' },
    pickerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 16 },
    pickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center', color: '#fff' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
    iconOption: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
    bottomModalContainer: { flex: 1, justifyContent: 'flex-end' },
    bottomModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
    bottomModal: { backgroundColor: '#0f1218', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.05)' },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
    colorOption: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'transparent' },
    colorSelected: { borderColor: '#fff' },
    timePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 10 },
    timePickerColumn: { flex: 1, alignItems: 'center', maxWidth: 160 },
    timePickerDivider: { width: 40, alignItems: 'center', justifyContent: 'center' },
    timePickerLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginLeft: 6 },
    timePickerLabelContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    timePickerWrapper: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    milicolorBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
    milicolorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    milicolorText: { fontSize: 12, fontWeight: '600' },
    doneBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
    listItemText: { flex: 1, fontSize: 15, fontWeight: '500' },
    measurementControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
    measurementControlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    measurementDisplay: { fontSize: 48, fontWeight: 'bold', color: '#fff', minWidth: 80, textAlign: 'center' },
    unitChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
});
