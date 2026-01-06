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

const OverlayHeader = ({ title, onClose }: { title: string, onClose: () => void }) => {
    const dragGesture = Gesture.Pan().onUpdate((e) => {
        if (e.translationY > 50) runOnJS(onClose)();
    });

    return (
        <GestureDetector gesture={dragGesture}>
            <View style={{ width: '100%', alignItems: 'center', backgroundColor: 'transparent' }}>
                <TopDragHandle />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 24, fontFamily: 'Lexend' }}>{title}</Text>
            </View>
        </GestureDetector>
    );
};

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height; // Full screen
const DRAG_THRESHOLD = 120;

// --- CONSTANTS ---
const ICONS = [
    // Health & Fitness
    'fitness', 'barbell', 'body', 'walk', 'bicycle', 'footsteps', 'pulse', 'heart', 'medical', 'medkit', 'nutrition',
    // Mind & Wellness
    'bed', 'moon', 'sunny', 'partly-sunny', 'snow', 'rainy', 'thunderstorm', 'water', 'leaf', 'rose', 'flower',
    // Productivity
    'book', 'reader', 'newspaper', 'document-text', 'pencil', 'create', 'clipboard', 'calendar', 'time', 'timer', 'alarm', 'hourglass',
    // Tech & Work
    'code-slash', 'terminal', 'laptop', 'desktop', 'phone-portrait', 'tablet-portrait', 'globe', 'wifi', 'cloud', 'server', 'git-branch',
    // Creative
    'brush', 'color-palette', 'camera', 'videocam', 'mic', 'musical-notes', 'headset', 'film', 'image',
    // Food & Drink
    'cafe', 'beer', 'wine', 'pizza', 'fast-food', 'restaurant', 'ice-cream', 'nutrition',
    // Travel & Places
    'airplane', 'car', 'bus', 'train', 'boat', 'navigate', 'compass', 'map', 'location', 'flag', 'home', 'business',
    // Communication
    'mail', 'chatbubbles', 'call', 'notifications', 'megaphone', 'paper-plane',
    // Fun & Games
    'game-controller', 'dice', 'football', 'basketball', 'baseball', 'tennis-ball', 'golf', 'american-football',
    // General
    'rocket', 'flash', 'bulb', 'star', 'trophy', 'medal', 'ribbon', 'diamond', 'gift', 'sparkles', 'happy', 'sad', 'skull',
    'paw', 'bug', 'fish', 'construct', 'hammer', 'wrench', 'key', 'lock-closed', 'shield-checkmark', 'eye', 'glasses', 'accessibility'
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
    const [iconSearch, setIconSearch] = useState('');
    const [customColor, setCustomColor] = useState('');

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
                // Reminder settings
                reminders: reminderEnabled ? [fmtTime(reminderTime)] : [],
                ringtone: ringtone,
                // Measurement settings
                goalValue: measurementValue,
                unit: measurementUnit,
                // Graph/tracking settings
                chartType: graphStyle === 'bar' ? 'bar' : 'line',
                trackingMethod: measurementUnit === 'times' ? 'boolean' : 'numeric',
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
        <View style={[StyleSheet.absoluteFill, { zIndex: 99999 }]}>
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
                                            style={[styles.gridItem, { width: '100%' }]}
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
                        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

                            {/* ICON OVERLAY */}
                            {activeOverlay === 'icon' && (
                                <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { maxHeight: height * 0.7 }]}>
                                    <OverlayHeader title="Choose Icon" onClose={() => { setActiveOverlay('none'); setIconSearch(''); }} />
                                    {/* Search Bar */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 }}>
                                        <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
                                        <TextInput
                                            style={{ flex: 1, color: '#fff', paddingVertical: 12, paddingHorizontal: 8, fontSize: 14 }}
                                            placeholder="Search icons..."
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            value={iconSearch}
                                            onChangeText={setIconSearch}
                                            autoCapitalize="none"
                                        />
                                        {iconSearch.length > 0 && (
                                            <TouchableOpacity onPress={() => setIconSearch('')}>
                                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <ScrollView contentContainerStyle={styles.iconGrid} showsVerticalScrollIndicator={false}>
                                        {ICONS.filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase())).map(icon => (
                                            <TouchableOpacity
                                                key={icon}
                                                onPress={() => { selectionFeedback(); setSelectedIcon(icon); setActiveOverlay('none'); setIconSearch(''); }}
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
                                <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { maxHeight: height * 0.85 }]}>
                                    <OverlayHeader title="Choose Color" onClose={() => setActiveOverlay('none')} />

                                    {/* Color Wheel */}
                                    <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                        <View
                                            style={{
                                                width: 220,
                                                height: 220,
                                                borderRadius: 110,
                                                position: 'relative'
                                            }}
                                            onTouchMove={(e) => {
                                                const touch = e.nativeEvent;
                                                const centerX = 110;
                                                const centerY = 110;
                                                const x = touch.locationX - centerX;
                                                const y = touch.locationY - centerY;

                                                // Calculate angle for hue (0-360)
                                                let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
                                                if (angle < 0) angle += 360;
                                                const hue = Math.round(angle);

                                                // Calculate distance for saturation (0-100%)
                                                const distance = Math.min(Math.sqrt(x * x + y * y), 100);
                                                const saturation = Math.round((distance / 100) * 100);

                                                // Fixed lightness at 50%
                                                const lightness = 50;

                                                // Convert HSL to hex
                                                const h = hue / 360;
                                                const s = saturation / 100;
                                                const l = lightness / 100;

                                                const hue2rgb = (p: number, q: number, t: number) => {
                                                    if (t < 0) t += 1;
                                                    if (t > 1) t -= 1;
                                                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                                                    if (t < 1 / 2) return q;
                                                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                                                    return p;
                                                };

                                                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                                                const p = 2 * l - q;
                                                const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
                                                const g = Math.round(hue2rgb(p, q, h) * 255);
                                                const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

                                                const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
                                                setSelectedColor(hex);
                                            }}
                                            onTouchStart={(e) => {
                                                selectionFeedback();
                                                const touch = e.nativeEvent;
                                                const centerX = 110;
                                                const centerY = 110;
                                                const x = touch.locationX - centerX;
                                                const y = touch.locationY - centerY;

                                                let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
                                                if (angle < 0) angle += 360;
                                                const hue = Math.round(angle);
                                                const distance = Math.min(Math.sqrt(x * x + y * y), 100);
                                                const saturation = Math.round((distance / 100) * 100);

                                                const h = hue / 360;
                                                const s = saturation / 100;
                                                const l = 0.5;

                                                const hue2rgb = (p: number, q: number, t: number) => {
                                                    if (t < 0) t += 1;
                                                    if (t > 1) t -= 1;
                                                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                                                    if (t < 1 / 2) return q;
                                                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                                                    return p;
                                                };

                                                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                                                const p = 2 * l - q;
                                                const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
                                                const g = Math.round(hue2rgb(p, q, h) * 255);
                                                const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

                                                const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
                                                setSelectedColor(hex);
                                            }}
                                        >
                                            {/* Render color wheel segments */}
                                            {Array.from({ length: 360 }, (_, i) => {
                                                const angle = (i - 90) * (Math.PI / 180);
                                                const x1 = 110 + Math.cos(angle) * 20;
                                                const y1 = 110 + Math.sin(angle) * 20;
                                                const x2 = 110 + Math.cos(angle) * 100;
                                                const y2 = 110 + Math.sin(angle) * 100;
                                                return (
                                                    <View
                                                        key={i}
                                                        style={{
                                                            position: 'absolute',
                                                            left: x1,
                                                            top: y1,
                                                            width: 3,
                                                            height: 80,
                                                            backgroundColor: `hsl(${i}, 100%, 50%)`,
                                                            transform: [{ rotate: `${i}deg` }],
                                                            transformOrigin: 'center top',
                                                        }}
                                                    />
                                                );
                                            })}
                                            {/* White center gradient overlay */}
                                            <View style={{
                                                position: 'absolute',
                                                width: 220,
                                                height: 220,
                                                borderRadius: 110,
                                                backgroundColor: 'transparent'
                                            }}>
                                                <LinearGradient
                                                    colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
                                                    style={{
                                                        width: 220,
                                                        height: 220,
                                                        borderRadius: 110,
                                                        position: 'absolute'
                                                    }}
                                                    start={{ x: 0.5, y: 0.5 }}
                                                    end={{ x: 0, y: 0 }}
                                                />
                                            </View>
                                            {/* Selected color indicator in center */}
                                            <View style={{
                                                position: 'absolute',
                                                left: 85,
                                                top: 85,
                                                width: 50,
                                                height: 50,
                                                borderRadius: 25,
                                                backgroundColor: selectedColor,
                                                borderWidth: 3,
                                                borderColor: '#fff',
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 8,
                                            }} />
                                        </View>

                                        {/* Current color display */}
                                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 16 }}>{selectedColor.toUpperCase()}</Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Tap or drag to pick color</Text>
                                    </View>

                                    {/* Preset Colors */}
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 1 }}>PRESETS</Text>
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
                                <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={styles.overlayPanel}>
                                    <OverlayHeader title="Set Schedule" onClose={() => setActiveOverlay('none')} />

                                    {/* Time Pickers - Always Visible */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            <Text style={styles.pickerLabel}>START</Text>
                                            <DateTimePicker
                                                value={startTime}
                                                mode="time"
                                                display="spinner"
                                                onChange={(_, d) => d && setStartTime(d)}
                                                textColor="#fff"
                                                style={{ height: 120, width: '100%', opacity: useFreeTime ? 0.3 : 1 }}
                                                disabled={useFreeTime}
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
                                                style={{ height: 120, width: '100%', opacity: useFreeTime ? 0.3 : 1 }}
                                                disabled={useFreeTime}
                                            />
                                        </View>
                                    </View>

                                    {/* Anytime Toggle */}
                                    <TouchableOpacity
                                        onPress={() => { selectionFeedback(); setUseFreeTime(!useFreeTime); }}
                                        style={[styles.toggleRow, { marginBottom: 24 }]}
                                    >
                                        <Text style={{ color: 'white', fontWeight: '600' }}>Anytime / All Day</Text>
                                        <Ionicons name={useFreeTime ? "checkbox" : "square-outline"} size={24} color={selectedColor} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setActiveOverlay('none')} style={[styles.doneButton, { backgroundColor: selectedColor }]}>
                                        <Text style={styles.doneButtonText}>Done</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}

                            {/* REMINDER OVERLAY */}
                            {activeOverlay === 'reminder' && (
                                <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={styles.overlayPanel}>
                                    <OverlayHeader title="Notifications" onClose={() => setActiveOverlay('none')} />

                                    {/* Toggle */}
                                    <TouchableOpacity
                                        onPress={() => { selectionFeedback(); setReminderEnabled(!reminderEnabled); }}
                                        style={[styles.toggleRow, { marginBottom: 24 }]}
                                    >
                                        <Text style={{ color: 'white', fontWeight: '600' }}>Enable Reminders</Text>
                                        <Ionicons name={reminderEnabled ? "notifications" : "notifications-off"} size={24} color={reminderEnabled ? selectedColor : 'rgba(255,255,255,0.3)'} />
                                    </TouchableOpacity>

                                    {/* Time Picker - Always visible but faded when disabled */}
                                    <View style={{ alignItems: 'center', marginBottom: 24, opacity: reminderEnabled ? 1 : 0.3 }}>
                                        <Text style={styles.pickerLabel}>REMINDER TIME</Text>
                                        <DateTimePicker
                                            value={reminderTime}
                                            mode="time"
                                            display="spinner"
                                            onChange={(_, d) => d && setReminderTime(d)}
                                            textColor="#fff"
                                            style={{ height: 150 }}
                                            disabled={!reminderEnabled}
                                        />
                                    </View>

                                    <TouchableOpacity onPress={() => setActiveOverlay('none')} style={[styles.doneButton, { backgroundColor: selectedColor }]}>
                                        <Text style={styles.doneButtonText}>Done</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}

                            {/* GRAPH OVERLAY */}
                            {activeOverlay === 'graph' && (
                                <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={styles.overlayPanel}>
                                    <OverlayHeader title="Graph Style" onClose={() => setActiveOverlay('none')} />
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
                                <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={styles.overlayPanel}>
                                    <OverlayHeader title="Target & Units" onClose={() => setActiveOverlay('none')} />
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
        padding: 24, paddingBottom: 100,
        zIndex: 20,
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
