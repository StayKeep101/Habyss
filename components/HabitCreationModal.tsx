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
    Keyboard
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
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { addHabit, HabitCategory, HabitFrequency, subscribeToHabits, Habit } from '@/lib/habits';
import { VoidCard } from '@/components/Layout/VoidCard';
import { TopDragHandle } from './TopDragHandle';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height; // Full screen
const DRAG_THRESHOLD = 120;

// --- CONSTANTS ---
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

    // Visibility management
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

    // Advanced fields
    const [reminderEnabled, setReminderEnabled] = useState(true);
    const [reminderTime, setReminderTime] = useState(new Date());
    const [ringtone, setRingtone] = useState('default');
    const [measurementValue, setMeasurementValue] = useState(1);
    const [measurementUnit, setMeasurementUnit] = useState('times');
    const [graphStyle, setGraphStyle] = useState('progress');

    // Active Overlay (Replacing nested modals)
    type OverlayType = 'none' | 'icon' | 'color' | 'time' | 'reminder' | 'ringtone' | 'measurement' | 'graph' | 'startDate';
    const [activeOverlay, setActiveOverlay] = useState<OverlayType>('none');

    // Animations
    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const linkedGoal = useMemo(() => availableGoals.find(g => g.id === goalId), [availableGoals, goalId]);

    // --- EFFECTS ---
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

    useEffect(() => {
        if (isVisible && !isOpen) {
            openModal();
        }
    }, [isVisible]);

    // --- ANIMATIONS ---
    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 300 });
    }, []);

    const closeModal = useCallback(() => {
        setActiveOverlay('none'); // Close any overlays first
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 350, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(() => {
            setIsOpen(false);
            setIsVisible(false);
            if (propOnClose) propOnClose();
            resetForm();
        }, 350);
    }, [propOnClose]);

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
        setActiveOverlay('none');
    };

    // --- ACTIONS ---
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

    // --- GESTURES ---
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

    if (!isOpen && !isVisible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
            {/* MAIN CONTAINER */}
            <View style={styles.container}>
                {/* BACKDROP */}
                <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
                    <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 5, 16, 0.8)' }]} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                {/* BOTTOM SHEET */}
                <GestureDetector gesture={activeOverlay === 'none' ? panGesture : Gesture.Native()}>
                    <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
                        <LinearGradient
                            colors={['#050510', '#0a0a1a']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        {/* Glass Border */}
                        <View style={styles.sheetLayout}>
                            <View style={styles.handleContainer}>
                                <View style={styles.handle} />
                            </View>

                            {/* Header */}
                            <View style={styles.header}>
                                <TouchableOpacity onPress={closeModal} style={styles.iconButton}>
                                    <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                                </TouchableOpacity>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={styles.headerTitle}>NEW HABIT</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, opacity: 0.7 }}>
                                        <Text style={{ color: linkedGoal?.color || '#fff', fontSize: 10, fontFamily: 'Lexend', marginRight: 4 }}>
                                            {linkedGoal ? linkedGoal.name.toUpperCase() : 'NO GOAL'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.iconButton, { backgroundColor: selectedColor }]}>
                                    <Ionicons name={saving ? "hourglass" : "checkmark"} size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Content */}
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Main Input Card */}
                                    <VoidCard glass intensity={20} style={styles.mainCard}>
                                        <View style={styles.inputRow}>
                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveOverlay('icon'); }}
                                                style={[styles.bigIconBtn, { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                            >
                                                <Ionicons name={selectedIcon as any} size={24} color={selectedColor} />
                                            </TouchableOpacity>

                                            <TextInput
                                                style={styles.mainInput}
                                                placeholder="What's the habit?"
                                                placeholderTextColor="rgba(255,255,255,0.3)"
                                                value={title}
                                                onChangeText={setTitle}
                                                autoFocus={false}
                                            />

                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveOverlay('color'); }}
                                                style={[styles.colorDotBtn, { backgroundColor: selectedColor }]}
                                            />
                                        </View>
                                    </VoidCard>

                                    {/* Settings Grid */}
                                    <Text style={styles.sectionTitle}>CONFIGURATION</Text>
                                    <View style={styles.grid}>

                                        {/* Goal Link */}
                                        <TouchableOpacity
                                            onPress={() => {
                                                // Just cycle through available goals if specific overlay not needed yet, or minimal picker
                                                // For now, let's keep inline horizontal scroll in main view
                                            }}
                                            activeOpacity={1} // Just a label wrapper
                                            style={[styles.gridItem, { gridColumn: 'span 2', width: '100%' }]}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text style={styles.gridLabel}>LINKED GOAL</Text>
                                                <Text style={{ fontSize: 10, color: '#EF4444' }}>* Required</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12, paddingHorizontal: 12 }}>
                                                {availableGoals.map(g => (
                                                    <TouchableOpacity
                                                        key={g.id}
                                                        onPress={() => { selectionFeedback(); setGoalId(g.id); }}
                                                        style={[styles.goalChip, goalId === g.id && { backgroundColor: g.color + '20', borderColor: g.color }]}
                                                    >
                                                        <Ionicons name={g.icon as any} size={12} color={goalId === g.id ? g.color : 'rgba(255,255,255,0.4)'} />
                                                        <Text style={[styles.goalChipText, goalId === g.id && { color: g.color }]}>{g.name}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                {availableGoals.length === 0 && (
                                                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontStyle: 'italic' }}>No goals found. Create one first.</Text>
                                                )}
                                            </ScrollView>
                                        </TouchableOpacity>

                                        {/* Frequency */}
                                        <View style={[styles.gridItem, { width: '100%' }]}>
                                            <Text style={styles.gridLabel}>FREQUENCY</Text>
                                            <View style={styles.segmentContainer}>
                                                {(['daily', 'weekly'] as HabitFrequency[]).map(f => (
                                                    <TouchableOpacity
                                                        key={f}
                                                        onPress={() => { selectionFeedback(); setFrequency(f); }}
                                                        style={[styles.segmentBtn, frequency === f && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                                                    >
                                                        <Text style={{ color: frequency === f ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>
                                                            {f.toUpperCase()}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                            {frequency === 'weekly' && (
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                                                    {WEEKDAYS.map(day => (
                                                        <TouchableOpacity
                                                            key={day.id}
                                                            onPress={() => toggleDay(day.id)}
                                                            style={[styles.dayCircle, selectedDays.includes(day.id) && { backgroundColor: selectedColor, borderColor: selectedColor }]}
                                                        >
                                                            <Text style={{ fontSize: 9, color: selectedDays.includes(day.id) ? '#000' : 'rgba(255,255,255,0.5)', fontWeight: '700' }}>
                                                                {day.label[0]}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            )}
                                        </View>

                                        {/* Time Picker Trigger */}
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setActiveOverlay('time'); }}
                                            style={styles.gridItem}
                                        >
                                            <Ionicons name="time-outline" size={20} color={useFreeTime ? '#8B5CF6' : selectedColor} />
                                            <Text style={styles.gridValue}>{useFreeTime ? 'Anytime' : `${formatTime(startTime)}`}</Text>
                                            <Text style={styles.gridLabel}>SCHEDULE</Text>
                                        </TouchableOpacity>

                                        {/* Reminder Trigger */}
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setActiveOverlay('reminder'); }}
                                            style={styles.gridItem}
                                        >
                                            <Ionicons name={reminderEnabled ? "notifications" : "notifications-off"} size={20} color={reminderEnabled ? selectedColor : 'rgba(255,255,255,0.3)'} />
                                            <Text style={styles.gridValue}>{reminderEnabled ? formatTime(reminderTime) : 'Off'}</Text>
                                            <Text style={styles.gridLabel}>REMINDERS</Text>
                                        </TouchableOpacity>

                                        {/* Graph Style */}
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setActiveOverlay('graph'); }}
                                            style={styles.gridItem}
                                        >
                                            <Ionicons name={GRAPH_STYLES.find(g => g.id === graphStyle)?.icon as any} size={20} color={selectedColor} />
                                            <Text style={styles.gridValue} numberOfLines={1}>{GRAPH_STYLES.find(g => g.id === graphStyle)?.label}</Text>
                                            <Text style={styles.gridLabel}>VISUALIZATION</Text>
                                        </TouchableOpacity>

                                        {/* Measurement */}
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setActiveOverlay('measurement'); }}
                                            style={styles.gridItem}
                                        >
                                            <Ionicons name="scale-outline" size={20} color={selectedColor} />
                                            <Text style={styles.gridValue}>{measurementValue} {UNITS.find(u => u.id === measurementUnit)?.label}</Text>
                                            <Text style={styles.gridLabel}>TARGET</Text>
                                        </TouchableOpacity>

                                    </View>
                                </ScrollView>
                            </KeyboardAvoidingView>
                        </View>

                        {/* --- OVERLAYS (Simulated Modals) --- */}
                        {/* Dimmer for overlays */}
                        {activeOverlay !== 'none' && (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                exiting={FadeOut.duration(200)}
                                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 }]}
                            >
                                <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveOverlay('none')} />
                            </Animated.View>
                        )}

                        {/* Overlay Container with Separate Gesture */}
                        <GestureDetector gesture={Gesture.Pan().onUpdate((e) => {
                            if (e.translationY > 50) runOnJS(setActiveOverlay)('none');
                        })}>
                            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

                                {/* ICON OVERLAY */}
                                {activeOverlay === 'icon' && (
                                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.overlayPanel}>
                                        <TopDragHandle />
                                        <Text style={styles.overlayTitle}>Choose Icon</Text>
                                        <ScrollView contentContainerStyle={styles.iconGrid}>
                                            {ICONS.map(icon => (
                                                <TouchableOpacity
                                                    key={icon}
                                                    onPress={() => { selectionFeedback(); setSelectedIcon(icon); setActiveOverlay('none'); }}
                                                    style={[styles.iconOption, selectedIcon === icon && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                                >
                                                    <Ionicons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : 'rgba(255,255,255,0.5)'} />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </Animated.View>
                                )}

                                {/* COLOR OVERLAY */}
                                {activeOverlay === 'color' && (
                                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.overlayPanel}>
                                        <TopDragHandle />
                                        <Text style={styles.overlayTitle}>Choose Color</Text>
                                        <View style={styles.colorGrid}>
                                            {COLORS.map(c => (
                                                <TouchableOpacity
                                                    key={c}
                                                    onPress={() => { selectionFeedback(); setSelectedColor(c); setActiveOverlay('none'); }}
                                                    style={[styles.colorOption, { backgroundColor: c }, selectedColor === c && styles.colorSelected]}
                                                />
                                            ))}
                                        </View>
                                    </Animated.View>
                                )}

                                {/* TIME OVERLAY */}
                                {activeOverlay === 'time' && (
                                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.overlayPanel}>
                                        <TopDragHandle />
                                        <Text style={styles.overlayTitle}>Set Schedule</Text>
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setUseFreeTime(!useFreeTime); }}
                                            style={[styles.toggleRow, { marginBottom: 20 }]}
                                        >
                                            <Text style={{ color: 'white', fontWeight: '600' }}>Anytime / All Day</Text>
                                            <Ionicons name={useFreeTime ? "checkbox" : "square-outline"} size={24} color={selectedColor} />
                                        </TouchableOpacity>

                                        {!useFreeTime && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
                                                <View style={{ flex: 1, alignItems: 'center' }}>
                                                    <Text style={styles.pickerLabel}>START</Text>
                                                    <DateTimePicker
                                                        value={startTime}
                                                        mode="time"
                                                        display="spinner"
                                                        onChange={(_, d) => d && setStartTime(d)}
                                                        textColor="#fff"
                                                        style={{ height: 120, width: '100%' }}
                                                    />
                                                </View>
                                                <View style={{ flex: 1, alignItems: 'center' }}>
                                                    <Text style={styles.pickerLabel}>END</Text>
                                                    <DateTimePicker
                                                        value={endTime}
                                                        mode="time"
                                                        display="spinner"
                                                        onChange={(_, d) => d && setEndTime(d)}
                                                        textColor="#fff"
                                                        style={{ height: 120, width: '100%' }}
                                                    />
                                                </View>
                                            </View>
                                        )}
                                        <TouchableOpacity onPress={() => setActiveOverlay('none')} style={[styles.doneButton, { backgroundColor: selectedColor }]}>
                                            <Text style={styles.doneButtonText}>Done</Text>
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}

                                {/* REMINDER OVERLAY */}
                                {activeOverlay === 'reminder' && (
                                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.overlayPanel}>
                                        <TopDragHandle />
                                        <Text style={styles.overlayTitle}>Notifications</Text>
                                        <TouchableOpacity
                                            onPress={() => { selectionFeedback(); setReminderEnabled(!reminderEnabled); }}
                                            style={[styles.toggleRow, { marginBottom: 20 }]}
                                        >
                                            <Text style={{ color: 'white', fontWeight: '600' }}>Enable Reminders</Text>
                                            <Ionicons name={reminderEnabled ? "notifications" : "notifications-off"} size={24} color={reminderEnabled ? selectedColor : 'rgba(255,255,255,0.3)'} />
                                        </TouchableOpacity>

                                        {reminderEnabled && (
                                            <View style={{ alignItems: 'center', height: 150 }}>
                                                <DateTimePicker
                                                    value={reminderTime}
                                                    mode="time"
                                                    display="spinner"
                                                    onChange={(_, d) => d && setReminderTime(d)}
                                                    textColor="#fff"
                                                    style={{ height: 150 }}
                                                />
                                            </View>
                                        )}
                                        <TouchableOpacity onPress={() => setActiveOverlay('none')} style={[styles.doneButton, { backgroundColor: selectedColor, marginTop: 20 }]}>
                                            <Text style={styles.doneButtonText}>Done</Text>
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}

                                {/* GRAPH OVERLAY */}
                                {activeOverlay === 'graph' && (
                                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.overlayPanel}>
                                        <TopDragHandle />
                                        <Text style={styles.overlayTitle}>Graph Style</Text>
                                        {GRAPH_STYLES.map(g => (
                                            <TouchableOpacity
                                                key={g.id}
                                                onPress={() => { selectionFeedback(); setGraphStyle(g.id); setActiveOverlay('none'); }}
                                                style={[styles.listItem, graphStyle === g.id && { backgroundColor: selectedColor + '20' }]}
                                            >
                                                <Ionicons name={g.icon as any} size={20} color={graphStyle === g.id ? selectedColor : 'rgba(255,255,255,0.5)'} />
                                                <Text style={[styles.listItemText, { color: graphStyle === g.id ? selectedColor : '#fff' }]}>{g.label}</Text>
                                                {graphStyle === g.id && <Ionicons name="checkmark" size={20} color={selectedColor} />}
                                            </TouchableOpacity>
                                        ))}
                                    </Animated.View>
                                )}

                                {/* MEASUREMENT OVERLAY */}
                                {activeOverlay === 'measurement' && (
                                    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.overlayPanel}>
                                        <TopDragHandle />
                                        <Text style={styles.overlayTitle}>Target & Units</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 30 }}>
                                            <TouchableOpacity onPress={() => setMeasurementValue(Math.max(1, measurementValue - 1))} style={styles.counterBtn}>
                                                <Ionicons name="remove" size={24} color="#fff" />
                                            </TouchableOpacity>
                                            <Text style={{ fontSize: 40, fontWeight: '900', color: '#fff' }}>{measurementValue}</Text>
                                            <TouchableOpacity onPress={() => setMeasurementValue(measurementValue + 1)} style={styles.counterBtn}>
                                                <Ionicons name="add" size={24} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {UNITS.map(u => (
                                                    <TouchableOpacity
                                                        key={u.id}
                                                        onPress={() => { selectionFeedback(); setMeasurementUnit(u.id); }}
                                                        style={[styles.unitChip, measurementUnit === u.id && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                                    >
                                                        <Text style={{ color: measurementUnit === u.id ? selectedColor : 'rgba(255,255,255,0.5)' }}>{u.label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </ScrollView>
                                        <TouchableOpacity onPress={() => setActiveOverlay('none')} style={[styles.doneButton, { backgroundColor: selectedColor }]}>
                                            <Text style={styles.doneButtonText}>Done</Text>
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}
                            </View>
                        </GestureDetector>

                    </Animated.View>
                </GestureDetector>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, overflow: 'hidden', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    sheetLayout: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderBottomWidth: 0 },
    handleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 5 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, marginBottom: 10 },
    headerTitle: { fontSize: 16, textAlign: 'center', fontWeight: '900', color: '#fff', letterSpacing: 2, fontFamily: 'Lexend' },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
    mainCard: { padding: 16, borderRadius: 20, marginBottom: 30 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bigIconBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    mainInput: { flex: 1, fontSize: 18, fontWeight: '600', color: '#fff', fontFamily: 'Lexend' },
    colorDotBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 16, fontFamily: 'Lexend' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: { width: '48%', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', minHeight: 100, justifyContent: 'space-between' },
    gridLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginTop: 8 },
    gridValue: { fontSize: 15, fontWeight: '600', color: '#fff', fontFamily: 'Lexend' },
    goalChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent', marginRight: 8 },
    goalChipText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 6 },
    segmentContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 2, marginBottom: 12 },
    segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
    dayCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },

    // OVERLAY PANEL
    overlayPanel: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#0f1218',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 50,
        zIndex: 20,
        borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20
    },
    overlayTitle: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 24, fontFamily: 'Lexend' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
    iconOption: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
    colorOption: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'transparent' },
    colorSelected: { borderColor: '#fff' },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12 },
    pickerLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
    doneButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', width: '100%' },
    doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    listItemText: { flex: 1, fontSize: 15, fontWeight: '500' },
    counterBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    unitChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
});
