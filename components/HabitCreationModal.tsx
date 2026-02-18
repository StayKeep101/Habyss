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
    Keyboard,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    SlideOutDown,
    Layout
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { addHabit, updateHabit, HabitCategory, HabitFrequency, subscribeToHabits, Habit, getGoals, getHabits } from '@/lib/habitsSQLite'; // Static import including getGoals
import { VoidCard } from '@/components/Layout/VoidCard';
import { TopDragHandle } from './TopDragHandle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarService } from '@/lib/calendarService';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useRouter } from 'expo-router';

const OverlayHeader = ({ title, onClose }: { title: string, onClose: () => void }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const dragGesture = Gesture.Pan().onUpdate((e) => {
        if (e.translationY > 50) runOnJS(onClose)();
    });

    return (
        <GestureDetector gesture={dragGesture}>
            <View style={{ width: '100%', alignItems: 'center', backgroundColor: 'transparent' }}>
                <TopDragHandle />
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 24, fontFamily: 'Lexend' }}>{title}</Text>
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
    'cafe', 'beer', 'wine', 'pizza', 'fast-food', 'restaurant', 'ice-cream',
    // Travel & Places
    'airplane', 'car', 'bus', 'train', 'boat', 'navigate', 'compass', 'map', 'location', 'flag', 'home', 'business',
    // Communication
    'mail', 'chatbubbles', 'call', 'notifications', 'megaphone', 'paper-plane',
    // Fun & Games
    'game-controller', 'dice', 'football', 'basketball', 'baseball', 'tennisball', 'golf', 'american-football',
    // General
    'rocket', 'flash', 'bulb', 'star', 'trophy', 'medal', 'ribbon', 'diamond', 'gift', 'sparkles', 'happy', 'sad', 'skull',
    'paw', 'bug', 'fish', 'construct', 'hammer', 'build', 'key', 'lock-closed', 'shield-checkmark', 'eye', 'glasses', 'accessibility'
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

// Units organized by category
const UNIT_CATEGORIES = [
    {
        category: 'Count',
        icon: 'add-circle',
        units: [
            { id: 'times', label: 'times' },
            { id: 'reps', label: 'reps' },
            { id: 'sets', label: 'sets' },
            { id: 'pages', label: 'pages' },
        ]
    },
    {
        category: 'Time',
        icon: 'time',
        units: [
            { id: 'minutes', label: 'minutes' },
            { id: 'hours', label: 'hours' },
            { id: 'seconds', label: 'seconds' },
        ]
    },
    {
        category: 'Volume',
        icon: 'water',
        units: [
            { id: 'ml', label: 'ml' },
            { id: 'liters', label: 'liters' },
            { id: 'glasses', label: 'glasses' },
            { id: 'cups', label: 'cups' },
        ]
    },
    {
        category: 'Distance',
        icon: 'walk',
        units: [
            { id: 'steps', label: 'steps' },
            { id: 'km', label: 'km' },
            { id: 'miles', label: 'miles' },
            { id: 'meters', label: 'meters' },
        ]
    },
    {
        category: 'Fitness',
        icon: 'fitness',
        units: [
            { id: 'calories', label: 'calories' },
            { id: 'lb', label: 'lb' },
            { id: 'kg', label: 'kg' },
        ]
    },
    {
        category: 'Other',
        icon: 'ellipsis-horizontal',
        units: [
            { id: 'items', label: 'items' },
            { id: 'percent', label: '%' },
            { id: 'dollars', label: '$' },
        ]
    },
];

// Flat list for backward compatibility
const UNITS = UNIT_CATEGORIES.flatMap(cat => cat.units);

const GRAPH_STYLES = [
    { id: 'progress', label: 'Progress Ring', icon: 'pie-chart' },
    { id: 'bar', label: 'Bar Chart', icon: 'bar-chart' },
    { id: 'line', label: 'Line Chart', icon: 'trending-up' },
    { id: 'heatmap', label: 'Heatmap', icon: 'grid' },
    { id: 'streak', label: 'Streak Counter', icon: 'flame' },
];

const HEALTH_KIT_METRICS = [
    { id: 'steps', label: 'Steps', icon: 'walk', unit: 'steps' },
    { id: 'sleep', label: 'Sleep', icon: 'bed', unit: 'hours' },
    { id: 'mindfulness', label: 'Mindfulness', icon: 'leaf', unit: 'minutes' },
    { id: 'workout', label: 'Workout', icon: 'fitness', unit: 'minutes' },
];

// 6 Pillars of Life Balance
const LIFE_PILLARS = [
    { id: 'body', label: 'Body', fullName: 'Physical Health', icon: 'fitness', color: '#EF4444', description: 'Energy, nutrition, movement, sleep' },
    { id: 'wealth', label: 'Wealth', fullName: 'Career & Finances', icon: 'briefcase', color: '#F59E0B', description: 'Career advancement, budgeting, productivity' },
    { id: 'heart', label: 'Heart', fullName: 'Relationships & Social', icon: 'heart', color: '#EC4899', description: 'Connection, intimacy, family, networking' },
    { id: 'mind', label: 'Mind', fullName: 'Intellectual & Growth', icon: 'bulb', color: '#3B82F6', description: 'Education, skill-building, reading' },
    { id: 'soul', label: 'Soul', fullName: 'Emotional & Spiritual', icon: 'sparkles', color: '#8B5CF6', description: 'Mindfulness, gratitude, mental resilience' },
    { id: 'play', label: 'Play', fullName: 'Recreation & Creativity', icon: 'game-controller', color: '#10B981', description: 'Hobbies, relaxation, fun, creativity' },
];

// Premade habits organized by pillar
const PREMADE_HABITS = [
    // BODY - Physical Health
    { name: 'Drink 8 glasses of water', icon: 'water', pillar: 'body', goalValue: 8, unit: 'glasses' },
    { name: 'Sleep 8 hours', icon: 'moon', pillar: 'body', goalValue: 8, unit: 'hours' },
    { name: 'Workout 30 min', icon: 'fitness', pillar: 'body', goalValue: 30, unit: 'minutes' },
    { name: 'Take daily vitamins', icon: 'medical', pillar: 'body', goalValue: 1, unit: 'times' },
    { name: 'Walk 10000 steps', icon: 'walk', pillar: 'body', goalValue: 10000, unit: 'steps' },
    // WEALTH - Career & Finances
    { name: 'Deep work session', icon: 'briefcase', pillar: 'wealth', goalValue: 90, unit: 'minutes' },
    { name: 'Review budget', icon: 'card', pillar: 'wealth', goalValue: 1, unit: 'times' },
    { name: 'Save money', icon: 'cash', pillar: 'wealth', goalValue: 10, unit: 'dollars' },
    { name: 'Clear inbox', icon: 'mail', pillar: 'wealth', goalValue: 1, unit: 'times' },
    { name: 'Learn new skill', icon: 'school', pillar: 'wealth', goalValue: 30, unit: 'minutes' },
    // HEART - Relationships
    { name: 'Call family', icon: 'call', pillar: 'heart', goalValue: 1, unit: 'times' },
    { name: 'Date night', icon: 'heart', pillar: 'heart', goalValue: 1, unit: 'times' },
    { name: 'Coffee with friend', icon: 'cafe', pillar: 'heart', goalValue: 1, unit: 'times' },
    { name: 'Send appreciation text', icon: 'chatbubble', pillar: 'heart', goalValue: 1, unit: 'times' },
    { name: 'Play with kids', icon: 'happy', pillar: 'heart', goalValue: 30, unit: 'minutes' },
    // MIND - Intellectual Growth
    { name: 'Read 20 pages', icon: 'book', pillar: 'mind', goalValue: 20, unit: 'pages' },
    { name: 'Learn language (Duolingo)', icon: 'language', pillar: 'mind', goalValue: 15, unit: 'minutes' },
    { name: 'Listen to podcast', icon: 'headset', pillar: 'mind', goalValue: 1, unit: 'times' },
    { name: 'Write in journal', icon: 'create', pillar: 'mind', goalValue: 1, unit: 'times' },
    { name: 'Watch documentary', icon: 'film', pillar: 'mind', goalValue: 1, unit: 'times' },
    // SOUL - Emotional & Spiritual
    { name: 'Meditate 10 min', icon: 'leaf', pillar: 'soul', goalValue: 10, unit: 'minutes' },
    { name: 'Gratitude journaling', icon: 'happy', pillar: 'soul', goalValue: 3, unit: 'items' },
    { name: 'Digital detox', icon: 'phone-portrait', pillar: 'soul', goalValue: 1, unit: 'hours' },
    { name: 'Prayer / Reflection', icon: 'sparkles', pillar: 'soul', goalValue: 1, unit: 'times' },
    { name: 'Practice breathing', icon: 'cloud', pillar: 'soul', goalValue: 5, unit: 'minutes' },
    // PLAY - Recreation & Creativity
    { name: 'Gaming session', icon: 'game-controller', pillar: 'play', goalValue: 30, unit: 'minutes' },
    { name: 'Draw or paint', icon: 'brush', pillar: 'play', goalValue: 30, unit: 'minutes' },
    { name: 'Play music', icon: 'musical-notes', pillar: 'play', goalValue: 20, unit: 'minutes' },
    { name: 'Watch a movie', icon: 'tv', pillar: 'play', goalValue: 1, unit: 'times' },
    { name: 'Go for a hike', icon: 'trail-sign', pillar: 'play', goalValue: 1, unit: 'times' },
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
    initialHabit?: Habit;
    listenToGlobalEvents?: boolean;
}

export const HabitCreationModal: React.FC<HabitCreationModalProps> = ({
    visible: propVisible,
    onClose: propOnClose,
    onSuccess: propOnSuccess,
    goalId: propGoalId,
    initialHabit,
    listenToGlobalEvents = true,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, selectionFeedback, successFeedback } = useHaptics();
    const { isPremium } = usePremiumStatus();
    const router = useRouter();
    const isLight = theme === 'light';
    // Use darker border for light mode visibility
    const effectiveBorderColor = isLight ? '#94A3B8' : colors.border;

    // Visibility management
    const [isVisible, setIsVisible] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [availableGoals, setAvailableGoals] = useState<Habit[]>([]);
    const [eventHabit, setEventHabit] = useState<Habit | undefined>(undefined); // Habit passed via DeviceEvent

    // Form state
    const [title, setTitle] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('fitness');
    const [selectedColor, setSelectedColor] = useState('#10B981');
    const [lifePillar, setLifePillar] = useState('body'); // 6 Pillars: body, wealth, heart, mind, soul, play
    const [goalId, setGoalId] = useState<string | undefined>(propGoalId);
    const [frequency, setFrequency] = useState<HabitFrequency>('daily');
    const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const [weekInterval, setWeekInterval] = useState(1); // New: every N weeks
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 30 * 60 * 1000));
    const [useFreeTime, setUseFreeTime] = useState(false);
    const [habitStartDate, setHabitStartDate] = useState(new Date());
    const [saving, setSaving] = useState(false);

    // Advanced fields
    const [reminderEnabled, setReminderEnabled] = useState(true);
    const [reminderTime, setReminderTime] = useState(new Date());
    const [reminderOffset, setReminderOffset] = useState<number | undefined>(undefined);
    const [locationReminders, setLocationReminders] = useState<{ name: string; latitude: number; longitude: number; radius?: number }[]>([]);
    const [ringtone, setRingtone] = useState('default');
    const [measurementValue, setMeasurementValue] = useState(1);
    const [measurementUnit, setMeasurementUnit] = useState('times');
    const [graphStyle, setGraphStyle] = useState('progress');
    const [healthKitMetric, setHealthKitMetric] = useState<'steps' | 'sleep' | 'mindfulness' | 'workout' | undefined>(undefined);
    const [healthKitTarget, setHealthKitTarget] = useState<number | undefined>(undefined);

    // Automatic scheduling state
    const [suggestedSlots, setSuggestedSlots] = useState<{ start: Date; end: Date }[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    // Wizard step state
    const [currentStep, setCurrentStep] = useState(1);
    const stepDirection = useSharedValue(0); // -1 = back, 1 = forward
    const stepProgress = useSharedValue(0);
    const STEP_LABELS = ['Name', 'Style', 'Schedule', 'Target', 'Finish'];
    const TOTAL_STEPS = 5;

    // Active Overlay (Replacing nested modals)
    type OverlayType = 'none' | 'icon' | 'color' | 'time' | 'reminder' | 'ringtone' | 'measurement' | 'graph' | 'startDate' | 'templates' | 'healthKit';
    const [activeOverlay, setActiveOverlay] = useState<OverlayType>('none');
    const [iconSearch, setIconSearch] = useState('');
    const [customColor, setCustomColor] = useState('');
    const [showPillarInfo, setShowPillarInfo] = useState(false);
    const [targetInputValue, setTargetInputValue] = useState('1'); // String state for input display
    const [monthDay, setMonthDay] = useState(1); // For monthly frequency - which day of month
    const [customColors, setCustomColors] = useState<string[]>([]); // User's saved custom colors (max 10)

    // Animations
    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const linkedGoal = useMemo(() => availableGoals.find(g => g.id === goalId), [availableGoals, goalId]);

    // --- EFFECTS ---

    // Load custom colors from AsyncStorage
    useEffect(() => {
        const loadCustomColors = async () => {
            try {
                const saved = await AsyncStorage.getItem('habit_custom_colors');
                if (saved) setCustomColors(JSON.parse(saved));
            } catch (e) { }
        };
        loadCustomColors();
    }, []);

    // Load initial habit data (from prop or event)
    const habitToEdit = initialHabit || eventHabit;

    useEffect(() => {
        if (habitToEdit) {
            setTitle(habitToEdit.name);
            setSelectedIcon(habitToEdit.icon || 'fitness');
            setSelectedColor(habitToEdit.color || '#10B981');
            setLifePillar(habitToEdit.category);
            if (habitToEdit.goalId) setGoalId(habitToEdit.goalId!);
            setFrequency(habitToEdit.frequency || 'daily');
            if (habitToEdit.taskDays) setSelectedDays(habitToEdit.taskDays);

            if (habitToEdit.startTime) {
                const [h, m] = habitToEdit.startTime.split(':').map(Number);
                const d = new Date(); d.setHours(h); d.setMinutes(m);
                setStartTime(d);
                setUseFreeTime(false);
            } else {
                setUseFreeTime(true);
            }

            if (habitToEdit.endTime) {
                const [h, m] = habitToEdit.endTime.split(':').map(Number);
                const d = new Date(); d.setHours(h); d.setMinutes(m);
                setEndTime(d);
            }

            setReminderEnabled(!!(habitToEdit.reminders && habitToEdit.reminders.length > 0));
            if (habitToEdit.reminders && habitToEdit.reminders.length > 0) {
                const [h, m] = habitToEdit.reminders[0].split(':').map(Number);
                const d = new Date(); d.setHours(h); d.setMinutes(m);
                setReminderTime(d);
            }

            setMeasurementValue(habitToEdit.goalValue || 1);
            setMeasurementUnit(habitToEdit.unit || 'times');
            setMeasurementUnit(habitToEdit.unit || 'times');
            setGraphStyle((habitToEdit.graphStyle as any) || 'progress');
            setHealthKitMetric(habitToEdit.healthKitMetric);
            setHealthKitTarget(habitToEdit.healthKitTarget);
            if (habitToEdit.healthKitMetric) {
                // If using HealthKit, ensure unit matches
                const metric = HEALTH_KIT_METRICS.find(m => m.id === habitToEdit.healthKitMetric);
                if (metric) setMeasurementUnit(metric.unit);
            }
        }
    }, [habitToEdit]);

    // Save custom colors helper
    const saveCustomColor = async (color: string) => {
        // Avoid duplicates and limit to 10
        if (customColors.includes(color)) return;
        const updated = [color, ...customColors].slice(0, 10);
        setCustomColors(updated);
        await AsyncStorage.setItem('habit_custom_colors', JSON.stringify(updated));
        selectionFeedback();
    };

    useEffect(() => {
        const unsub = subscribeToHabits((habits) => {
            setAvailableGoals(habits.filter(h => h.isGoal));
        });
        // Also fetch initial state immediately
        getGoals().then(setAvailableGoals);
        return () => { unsub.then(fn => fn()) };
    }, []);

    useEffect(() => {
        if (propVisible !== undefined) setIsVisible(propVisible);
    }, [propVisible]);

    useEffect(() => {
        if (propGoalId !== undefined) setGoalId(propGoalId);
    }, [propGoalId]);

    useEffect(() => {
        if (!listenToGlobalEvents) return;

        const subscription = DeviceEventEmitter.addListener('show_habit_modal', (data) => {
            selectionFeedback();
            setGoalId(data?.goalId || undefined);
            // If habit data is passed, set it for editing
            if (data?.initialHabit) {
                setEventHabit(data.initialHabit);
            } else {
                setEventHabit(undefined);
            }
            setIsVisible(true);
        });
        return () => subscription.remove();
    }, [listenToGlobalEvents]);

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
            setEventHabit(undefined); // Clear event habit on close
            resetForm();
        }, 350);
    }, [propOnClose]);

    const resetForm = () => {
        setTitle('');
        setSelectedIcon('fitness');
        setSelectedColor('#10B981');
        setLifePillar('body');
        setFrequency('daily');
        setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
        setWeekInterval(1);
        setStartTime(new Date());
        setEndTime(new Date(Date.now() + 30 * 60 * 1000));
        setUseFreeTime(false);
        setHabitStartDate(new Date());
        setReminderEnabled(true);
        setReminderTime(new Date());
        setReminderOffset(undefined);
        setLocationReminders([]);
        setRingtone('default');
        setMeasurementValue(1);
        setMeasurementUnit('times');
        setMeasurementUnit('times');
        setGraphStyle('progress');
        setHealthKitMetric(undefined);
        setHealthKitTarget(undefined);
        setSuggestedSlots([]);
        setMonthDay(1);
        setShowPillarInfo(false);
        setTargetInputValue('1');
        setActiveOverlay('none');
        setCurrentStep(1);
    };

    // --- WIZARD NAVIGATION ---
    const goToStep = (step: number) => {
        if (step < 1 || step > TOTAL_STEPS) return;
        selectionFeedback();
        stepDirection.value = step > currentStep ? 1 : -1;
        setCurrentStep(step);
    };

    const handleNext = () => {
        if (currentStep === 1 && !title.trim()) {
            Alert.alert('Missing Title', 'Please enter a name for your habit.');
            return;
        }
        if (currentStep === 3 && frequency === 'weekly' && selectedDays.length === 0) {
            Alert.alert('Select Days', 'Please select at least one day.');
            return;
        }
        if (currentStep < TOTAL_STEPS) {
            goToStep(currentStep + 1);
        } else {
            handleSave();
        }
    };

    const handleBack = () => {
        if (currentStep > 1) goToStep(currentStep - 1);
    };

    // --- ACTIONS ---
    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Missing Title', 'Please enter a title for your habit.');
            return;
        }

        // --- PRO LIMIT CHECK ---
        if (!habitToEdit && !isPremium) {
            const currentHabits = await getHabits();
            const activeHabits = currentHabits.filter(h => !h.isGoal && !h.isArchived);

            if (activeHabits.length >= 3) {
                Alert.alert(
                    'Limit Reached',
                    'Free users can only track up to 3 habits. Upgrade to Pro for unlimited habits!',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Upgrade', onPress: () => router.push('/(root)/paywall') }
                    ]
                );
                return;
            }
        }

        // Goal is now optional

        // Validate weekly frequency has at least one day selected
        if (frequency === 'weekly' && selectedDays.length === 0) {
            Alert.alert('Select Days', 'Please select at least one day for your weekly habit.');
            return;
        }

        setSaving(true);
        mediumFeedback();

        try {
            const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const fmtDate = (d: Date) => d.toISOString().split('T')[0];

            const habitData = {
                name: title.trim(),
                icon: selectedIcon,
                color: selectedColor,
                category: lifePillar as any,
                goalId,
                startTime: useFreeTime ? undefined : fmtTime(startTime),
                endTime: useFreeTime ? undefined : fmtTime(endTime),
                taskDays: frequency === 'weekly' ? selectedDays : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
                frequency: frequency,
                weekInterval: frequency === 'weekly' ? weekInterval : undefined,
                startDate: frequency === 'monthly'
                    ? (() => {
                        const d = new Date(habitStartDate);
                        d.setDate(monthDay);
                        return fmtDate(d);
                    })()
                    : fmtDate(habitStartDate),
                isArchived: false,
                reminders: reminderEnabled ? [fmtTime(reminderTime)] : [],
                ringtone: ringtone,
                goalValue: measurementValue,
                unit: measurementUnit,
                chartType: (graphStyle === 'bar' ? 'bar' : 'line') as any,
                graphStyle: graphStyle,
                trackingMethod: (measurementUnit === 'times' ? 'boolean' : 'numeric') as any,
                healthKitMetric: healthKitMetric,
                healthKitTarget: healthKitMetric ? measurementValue : undefined, // Use main goal value as target
            };

            if (habitToEdit) {
                await updateHabit({ id: habitToEdit.id, ...habitData });
            } else {
                await addHabit(habitData);
            }

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
                            colors={theme === 'light' ? [colors.background, colors.surface] : ['#050510', '#0a0a1a']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        {/* Glass Border */}
                        <SafeAreaView style={styles.sheetLayout} edges={['top']}>
                            {/* Header — create.tsx style with progress bar */}
                            <View style={styles.header}>
                                <TouchableOpacity onPress={currentStep > 1 ? handleBack : closeModal} style={styles.headerBtn}>
                                    <Ionicons name={currentStep > 1 ? "arrow-back" : "close"} size={24} color={colors.text} />
                                </TouchableOpacity>
                                <View style={styles.progressContainer}>
                                    <Text style={[styles.stepIndicator, { color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.45)' }]}>
                                        {currentStep} / {TOTAL_STEPS}
                                    </Text>
                                    <View style={[styles.progressBar, { backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }]}>
                                        <Animated.View
                                            layout={Layout}
                                            style={[styles.progressFill, { width: `${(currentStep / TOTAL_STEPS) * 100}%`, backgroundColor: selectedColor }]}
                                        />
                                    </View>
                                </View>
                                <View style={styles.headerBtn} />
                            </View>

                            {/* Content */}
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ padding: 20, paddingBottom: 180 }}
                                    showsVerticalScrollIndicator={false}
                                    key={`step-${currentStep}`}
                                >

                                    {/* ═══════════════ STEP 1: NAME ═══════════════ */}
                                    {currentStep === 1 && (
                                        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 8, fontFamily: 'Lexend' }}>
                                                {habitToEdit ? 'Edit your habit' : 'Name your habit'}
                                            </Text>
                                            <Text style={{ fontSize: 15, color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 32, fontFamily: 'Lexend_400Regular' }}>
                                                {habitToEdit ? 'Update your habit details' : 'What do you want to build?'}
                                            </Text>

                                            <TextInput
                                                style={{ fontSize: 18, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: effectiveBorderColor, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, color: colors.text, fontFamily: 'Lexend', marginBottom: 16 }}
                                                placeholder="e.g., Morning meditation"
                                                placeholderTextColor={isLight ? colors.textTertiary : 'rgba(255,255,255,0.25)'}
                                                value={title}
                                                onChangeText={setTitle}
                                                autoFocus={!habitToEdit}
                                            />

                                            {/* Goal link chip */}
                                            {linkedGoal && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: 16, backgroundColor: (linkedGoal.color || selectedColor) + '15', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 }}>
                                                    <Ionicons name={(linkedGoal.icon as any) || 'flag'} size={14} color={linkedGoal.color || selectedColor} style={{ marginRight: 6 }} />
                                                    <Text style={{ color: linkedGoal.color || selectedColor, fontSize: 12, fontFamily: 'Lexend_500Medium' }}>
                                                        Linked to {linkedGoal.name}
                                                    </Text>
                                                </View>
                                            )}

                                            {/* Templates Button */}
                                            <TouchableOpacity
                                                onPress={() => { selectionFeedback(); setActiveOverlay('templates'); }}
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: selectedColor + '30', borderStyle: 'dashed', marginTop: 8 }}
                                            >
                                                <Ionicons name="flash" size={18} color={selectedColor} />
                                                <Text style={{ color: selectedColor, fontSize: 14, fontWeight: '600', fontFamily: 'Lexend_500Medium' }}>Browse Templates</Text>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    )}

                                    {/* ═══════════════ STEP 2: STYLE ═══════════════ */}
                                    {currentStep === 2 && (
                                        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 8, fontFamily: 'Lexend' }}>
                                                Choose your style
                                            </Text>
                                            <Text style={{ fontSize: 15, color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 32, fontFamily: 'Lexend_400Regular' }}>
                                                Pick an icon, color, and category
                                            </Text>

                                            {/* Icon Button */}
                                            <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                                <TouchableOpacity
                                                    onPress={() => { selectionFeedback(); setActiveOverlay('icon'); }}
                                                    style={{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: selectedColor + '18', borderWidth: 2, borderColor: selectedColor + '40' }}
                                                >
                                                    <Ionicons name={selectedIcon as any} size={40} color={selectedColor} />
                                                </TouchableOpacity>
                                                <Text style={{ color: isLight ? colors.textTertiary : 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8, fontFamily: 'Lexend_400Regular' }}>Tap to change icon</Text>
                                            </View>

                                            {/* Color Picker */}
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12, fontFamily: 'Lexend_600SemiBold' }}>COLOR</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 24, justifyContent: 'center' }}>
                                                {COLORS.map(c => (
                                                    <TouchableOpacity
                                                        key={c}
                                                        onPress={() => { selectionFeedback(); setSelectedColor(c); }}
                                                        style={[styles.colorOption, { backgroundColor: c }, selectedColor === c && styles.colorSelected]}
                                                    />
                                                ))}
                                            </View>

                                            {/* Life Pillar */}
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12, fontFamily: 'Lexend_600SemiBold' }}>LIFE PILLAR</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                                {LIFE_PILLARS.map(pillar => (
                                                    <TouchableOpacity
                                                        key={pillar.id}
                                                        onPress={() => { selectionFeedback(); setLifePillar(pillar.id); }}
                                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: lifePillar === pillar.id ? pillar.color + '18' : (isLight ? colors.surfaceSecondary : colors.surfaceTertiary), borderWidth: 1.5, borderColor: lifePillar === pillar.id ? pillar.color + '50' : effectiveBorderColor }}
                                                    >
                                                        <Ionicons name={pillar.icon as any} size={14} color={lifePillar === pillar.id ? pillar.color : (isLight ? colors.textTertiary : 'rgba(255,255,255,0.35)')} />
                                                        <Text style={{ color: lifePillar === pillar.id ? pillar.color : (isLight ? colors.textSecondary : 'rgba(255,255,255,0.5)'), fontSize: 11, fontWeight: '600', fontFamily: 'Lexend_500Medium' }}>
                                                            {pillar.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </Animated.View>
                                    )}

                                    {/* ═══════════════ STEP 3: SCHEDULE ═══════════════ */}
                                    {currentStep === 3 && (
                                        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 8, fontFamily: 'Lexend' }}>
                                                Set your schedule
                                            </Text>
                                            <Text style={{ fontSize: 15, color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 32, fontFamily: 'Lexend_400Regular' }}>
                                                How often will you do this?
                                            </Text>

                                            {/* Frequency */}
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12, fontFamily: 'Lexend_600SemiBold' }}>FREQUENCY</Text>
                                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                                                {(['daily', 'weekly', 'monthly'] as HabitFrequency[]).map(f => (
                                                    <TouchableOpacity key={f} onPress={() => { selectionFeedback(); setFrequency(f); }}
                                                        style={{ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: frequency === f ? selectedColor + '18' : (isLight ? colors.surfaceSecondary : colors.surfaceTertiary), borderWidth: 1.5, borderColor: frequency === f ? selectedColor + '50' : effectiveBorderColor }}>
                                                        <Ionicons name={f === 'daily' ? 'sunny' : f === 'weekly' ? 'calendar' : 'calendar-outline'} size={18} color={frequency === f ? selectedColor : (isLight ? colors.textTertiary : 'rgba(255,255,255,0.35)')} />
                                                        <Text style={{ color: frequency === f ? selectedColor : (isLight ? colors.textSecondary : 'rgba(255,255,255,0.5)'), fontSize: 11, fontWeight: '600', marginTop: 4, fontFamily: 'Lexend_500Medium', textTransform: 'capitalize' }}>{f}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            {/* Weekly days */}
                                            {frequency === 'weekly' && (
                                                <View style={{ marginBottom: 20 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12, fontFamily: 'Lexend_600SemiBold' }}>REPEAT ON</Text>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        {WEEKDAYS.map(day => (
                                                            <TouchableOpacity key={day.id} onPress={() => toggleDay(day.id)}
                                                                style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: selectedDays.includes(day.id) ? selectedColor + '20' : (isLight ? colors.surfaceSecondary : colors.surfaceTertiary), borderWidth: 1.5, borderColor: selectedDays.includes(day.id) ? selectedColor : effectiveBorderColor }}>
                                                                <Text style={{ color: selectedDays.includes(day.id) ? selectedColor : (isLight ? colors.textSecondary : 'rgba(255,255,255,0.5)'), fontSize: 11, fontWeight: '700' }}>{day.label.charAt(0)}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                    <Text style={{ color: isLight ? colors.textTertiary : 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8, fontFamily: 'Lexend_400Regular' }}>{repeatText}</Text>
                                                </View>
                                            )}

                                            {/* Monthly day */}
                                            {frequency === 'monthly' && (
                                                <View style={{ marginBottom: 20 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12, fontFamily: 'Lexend_600SemiBold' }}>DAY OF MONTH</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                        <TouchableOpacity onPress={() => setMonthDay(Math.max(1, monthDay - 1))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' }}>
                                                            <Ionicons name="remove" size={20} color={colors.text} />
                                                        </TouchableOpacity>
                                                        <Text style={{ fontSize: 28, fontWeight: '900', color: selectedColor, fontFamily: 'Lexend', minWidth: 40, textAlign: 'center' }}>{monthDay}</Text>
                                                        <TouchableOpacity onPress={() => setMonthDay(Math.min(31, monthDay + 1))} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' }}>
                                                            <Ionicons name="add" size={20} color={colors.text} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Time Window */}
                                            <TouchableOpacity onPress={() => { selectionFeedback(); setActiveOverlay('time'); }}
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderWidth: 1, borderColor: effectiveBorderColor, marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <Ionicons name="time-outline" size={20} color={useFreeTime ? '#8B5CF6' : selectedColor} />
                                                    <View>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>TIME WINDOW</Text>
                                                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, fontFamily: 'Lexend' }}>{useFreeTime ? 'Anytime' : `${formatTime(startTime)} – ${formatTime(endTime)}`}</Text>
                                                    </View>
                                                </View>
                                                <Ionicons name="chevron-forward" size={18} color={isLight ? colors.textTertiary : 'rgba(255,255,255,0.25)'} />
                                            </TouchableOpacity>

                                            {/* Start Date */}
                                            <View style={{ padding: 16, borderRadius: 16, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderWidth: 1, borderColor: effectiveBorderColor }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 }}>START DATE</Text>
                                                <DateTimePicker value={habitStartDate} mode="date" display="compact" onChange={(_, d) => d && setHabitStartDate(d)} minimumDate={new Date()} themeVariant={isLight ? 'light' : 'dark'} />
                                            </View>
                                        </Animated.View>
                                    )}

                                    {/* ═══════════════ STEP 4: TARGET ═══════════════ */}
                                    {currentStep === 4 && (
                                        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 8, fontFamily: 'Lexend' }}>
                                                Define your target
                                            </Text>
                                            <Text style={{ fontSize: 15, color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 32, fontFamily: 'Lexend_400Regular' }}>
                                                How much do you want to achieve daily?
                                            </Text>

                                            {/* Measurement */}
                                            <TouchableOpacity onPress={() => { selectionFeedback(); setActiveOverlay('measurement'); }}
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderWidth: 1, borderColor: effectiveBorderColor, marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <Ionicons name="scale-outline" size={20} color={selectedColor} />
                                                    <View>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>DAILY TARGET</Text>
                                                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, fontFamily: 'Lexend' }}>{measurementValue} {UNITS.find(u => u.id === measurementUnit)?.label}</Text>
                                                    </View>
                                                </View>
                                                <Ionicons name="chevron-forward" size={18} color={isLight ? colors.textTertiary : 'rgba(255,255,255,0.25)'} />
                                            </TouchableOpacity>

                                            {/* HealthKit */}
                                            {lifePillar === 'body' && (
                                                <TouchableOpacity onPress={() => { selectionFeedback(); setActiveOverlay('healthKit'); }}
                                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderWidth: 1, borderColor: effectiveBorderColor, marginBottom: 12 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                        <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: '#FA2D48', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Ionicons name="heart" size={12} color="#fff" />
                                                        </View>
                                                        <View>
                                                            <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>APPLE HEALTH</Text>
                                                            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, fontFamily: 'Lexend' }}>
                                                                {healthKitMetric ? HEALTH_KIT_METRICS.find(m => m.id === healthKitMetric)?.label : 'Not Connected'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Ionicons name="chevron-forward" size={18} color={isLight ? colors.textTertiary : 'rgba(255,255,255,0.25)'} />
                                                </TouchableOpacity>
                                            )}
                                        </Animated.View>
                                    )}

                                    {/* ═══════════════ STEP 5: FINISH ═══════════════ */}
                                    {currentStep === 5 && (
                                        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 8, fontFamily: 'Lexend' }}>
                                                Stay on track
                                            </Text>
                                            <Text style={{ fontSize: 15, color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 32, fontFamily: 'Lexend_400Regular' }}>
                                                Set up reminders and choose how to visualize progress
                                            </Text>

                                            {/* Reminders */}
                                            <TouchableOpacity onPress={() => { selectionFeedback(); setActiveOverlay('reminder'); }}
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderWidth: 1, borderColor: effectiveBorderColor, marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <Ionicons name={reminderEnabled ? "notifications" : "notifications-off"} size={20} color={reminderEnabled ? selectedColor : colors.textTertiary} />
                                                    <View>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>REMINDERS</Text>
                                                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, fontFamily: 'Lexend' }}>{reminderEnabled ? formatTime(reminderTime) : 'Off'}</Text>
                                                    </View>
                                                </View>
                                                <Ionicons name="chevron-forward" size={18} color={isLight ? colors.textTertiary : 'rgba(255,255,255,0.25)'} />
                                            </TouchableOpacity>

                                            {/* Graph Style */}
                                            <TouchableOpacity onPress={() => { selectionFeedback(); setActiveOverlay('graph'); }}
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderWidth: 1, borderColor: effectiveBorderColor, marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <Ionicons name={GRAPH_STYLES.find(g => g.id === graphStyle)?.icon as any} size={20} color={selectedColor} />
                                                    <View>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: isLight ? colors.textSecondary : 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>VISUALIZATION</Text>
                                                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, fontFamily: 'Lexend' }} numberOfLines={1}>{GRAPH_STYLES.find(g => g.id === graphStyle)?.label}</Text>
                                                    </View>
                                                </View>
                                                <Ionicons name="chevron-forward" size={18} color={isLight ? colors.textTertiary : 'rgba(255,255,255,0.25)'} />
                                            </TouchableOpacity>
                                        </Animated.View>
                                    )}

                                </ScrollView>

                                {/* ═══════ BOTTOM CTA ═══════ */}
                                <View style={{ paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 32 }}>
                                    <TouchableOpacity onPress={handleNext} disabled={saving || (currentStep === 1 && !title.trim())}
                                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 16, backgroundColor: (saving || (currentStep === 1 && !title.trim())) ? (isLight ? colors.surfaceSecondary : colors.surfaceTertiary) : selectedColor }}>
                                        {saving ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (<>
                                            <Text style={{ color: (currentStep === 1 && !title.trim()) ? colors.textTertiary : '#fff', fontSize: 17, fontWeight: '700', fontFamily: 'Lexend_600SemiBold' }}>
                                                {currentStep === TOTAL_STEPS ? (habitToEdit ? 'Save Changes' : 'Create Habit') : 'Continue'}
                                            </Text>
                                            {currentStep < TOTAL_STEPS && <Ionicons name="arrow-forward" size={20} color="#fff" />}
                                        </>)}
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </SafeAreaView>
                    </Animated.View>
                </GestureDetector>
            </View>

            {/* --- OVERLAYS (Simulated Modals) --- */}
            {
                activeOverlay !== 'none' && (
                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}
                        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 }]}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveOverlay('none')} />
                    </Animated.View>
                )
            }

            {/* Overlay Container with Separate Gesture */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

                {/* ICON OVERLAY */}
                {activeOverlay === 'icon' && (
                    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { height: height * 0.7, backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}>
                        <OverlayHeader title="Choose Icon" onClose={() => { setActiveOverlay('none'); setIconSearch(''); }} />
                        {/* Search Bar */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 }}>
                            <Ionicons name="search" size={18} color={colors.textTertiary} />
                            <TextInput
                                style={{ flex: 1, color: colors.text, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14 }}
                                placeholder="Search icons..."
                                placeholderTextColor={colors.textTertiary}
                                value={iconSearch}
                                onChangeText={setIconSearch}
                                autoCapitalize="none"
                            />
                            {iconSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setIconSearch('')}>
                                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView contentContainerStyle={styles.iconGrid} showsVerticalScrollIndicator={false}>
                            {ICONS.filter(icon => icon.toLowerCase().includes(iconSearch.toLowerCase())).map(icon => (
                                <TouchableOpacity
                                    key={icon}
                                    onPress={() => { selectionFeedback(); setSelectedIcon(icon); setActiveOverlay('none'); setIconSearch(''); }}
                                    style={[styles.iconOption, {
                                        backgroundColor: selectedIcon === icon ? selectedColor + '20' : (isLight ? colors.surfaceSecondary : colors.surfaceTertiary),
                                        borderColor: selectedIcon === icon ? selectedColor : effectiveBorderColor
                                    }]}
                                >
                                    <Ionicons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : (isLight ? colors.textSecondary : 'rgba(255,255,255,0.5)')} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Animated.View>
                )}

                {/* COLOR OVERLAY */}
                {activeOverlay === 'color' && (
                    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { maxHeight: height * 0.8, backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}>
                        <OverlayHeader title="Choose Color" onClose={() => setActiveOverlay('none')} />

                        {/* Scrollable content for presets + custom */}
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                            {/* Preset Colors */}
                            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 16, letterSpacing: 1 }}>PRESETS</Text>
                            <View style={styles.colorGrid}>
                                {COLORS.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        onPress={() => { selectionFeedback(); setSelectedColor(c); }}
                                        style={[styles.colorOption, { backgroundColor: c }, selectedColor === c && styles.colorSelected]}
                                    />
                                ))}
                            </View>

                            {/* Custom Colors Section */}
                            {customColors.length > 0 && (
                                <View style={{ marginTop: 20 }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 12, letterSpacing: 1 }}>MY COLORS</Text>
                                    <View style={styles.colorGrid}>
                                        {customColors.map(c => (
                                            <TouchableOpacity
                                                key={c}
                                                onPress={() => { selectionFeedback(); setSelectedColor(c); }}
                                                style={[styles.colorOption, { backgroundColor: c }, selectedColor === c && styles.colorSelected]}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        {/* Done Button */}
                        <TouchableOpacity onPress={() => setActiveOverlay('none')} style={[styles.doneButton, { backgroundColor: selectedColor, marginTop: 16 }]}>
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* TIME OVERLAY */}
                {activeOverlay === 'time' && (
                    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}>
                        <OverlayHeader title="Set Schedule" onClose={() => setActiveOverlay('none')} />

                        {/* Time Pickers - Always Visible */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={[styles.pickerLabel, { color: colors.textTertiary }]}>START</Text>
                                <View style={{ height: 100, overflow: 'hidden', justifyContent: 'center' }}>
                                    <DateTimePicker
                                        value={startTime}
                                        mode="time"
                                        display="spinner"
                                        onChange={(_, d) => d && setStartTime(d)}
                                        textColor={isLight ? '#000' : '#fff'}
                                        style={{ height: 120, width: '100%', transform: [{ scale: 0.8 }] }}
                                    />
                                </View>
                            </View>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={[styles.pickerLabel, { color: colors.textTertiary }]}>END</Text>
                                <View style={{ height: 100, overflow: 'hidden', justifyContent: 'center' }}>
                                    <DateTimePicker
                                        value={endTime}
                                        mode="time"
                                        display="spinner"
                                        onChange={(_, d) => d && setEndTime(d)}
                                        textColor={isLight ? '#000' : '#fff'}
                                        style={{ height: 120, width: '100%', transform: [{ scale: 0.8 }] }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Anytime Toggle Removed */}

                        {/* Automatic Scheduling Button */}
                        <TouchableOpacity
                            onPress={async () => {
                                selectionFeedback();
                                setIsLoadingSlots(true);
                                try {
                                    const hasPermission = await CalendarService.hasPermission();
                                    if (!hasPermission) {
                                        const granted = await CalendarService.requestPermission();
                                        if (!granted) {
                                            Alert.alert('Calendar Access', 'Calendar permission is required to find free time slots.');
                                            setIsLoadingSlots(false);
                                            return;
                                        }
                                    }
                                    const slots = await CalendarService.getSuggestedTimes(habitStartDate, 5);
                                    if (slots.length === 0) {
                                        Alert.alert('No Free Time', 'Could not find any free slots in your calendar for this day.');
                                    } else {
                                        setSuggestedSlots(slots);
                                    }
                                } catch (e) {
                                    console.error('Calendar error:', e);
                                    Alert.alert('Error', 'Could not access calendar.');
                                } finally {
                                    setIsLoadingSlots(false);
                                }
                            }}
                            style={[
                                styles.toggleRow,
                                { marginBottom: 16, backgroundColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)', borderWidth: 1 }
                            ]}
                            disabled={isLoadingSlots}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="calendar" size={18} color={selectedColor} />
                                <Text style={{ color: selectedColor, fontWeight: '600' }}>Find Free Time (Auto)</Text>
                            </View>
                            {isLoadingSlots && <ActivityIndicator size="small" color={selectedColor} />}
                        </TouchableOpacity>

                        {/* Suggested Slots */}
                        {suggestedSlots.length > 0 && (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={[styles.pickerLabel, { color: colors.textTertiary }]}>SUGGESTED TIMES</Text>
                                <View style={{ gap: 8 }}>
                                    {suggestedSlots.map((slot, index) => {
                                        const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                        const label = `${formatTime(slot.start)} - ${formatTime(slot.end)}`;
                                        return (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() => {
                                                    selectionFeedback();
                                                    setStartTime(slot.start);
                                                    setEndTime(slot.end);
                                                    setUseFreeTime(false);
                                                    setSuggestedSlots([]);
                                                }}
                                                style={[
                                                    styles.toggleRow,
                                                    { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1 }
                                                ]}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Ionicons name="time" size={16} color="#10B981" />
                                                    <Text style={{ color: '#10B981', fontWeight: '500' }}>{label}</Text>
                                                </View>
                                                <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        <TouchableOpacity onPress={() => { setActiveOverlay('none'); setSuggestedSlots([]); }} style={[styles.doneButton, { backgroundColor: selectedColor }]}>
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* REMINDER OVERLAY */}
                {activeOverlay === 'reminder' && (
                    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { maxHeight: height * 0.8, backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}>
                        <OverlayHeader title="Notifications" onClose={() => setActiveOverlay('none')} />

                        {/* Toggle */}
                        <TouchableOpacity
                            onPress={() => { selectionFeedback(); setReminderEnabled(!reminderEnabled); }}
                            style={[styles.toggleRow, { marginBottom: 24, backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)' }]}
                        >
                            <Text style={{ color: colors.text, fontWeight: '600' }}>Enable Reminders</Text>
                            <Ionicons name={reminderEnabled ? "notifications" : "notifications-off"} size={24} color={reminderEnabled ? selectedColor : colors.textTertiary} />
                        </TouchableOpacity>

                        {reminderEnabled && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Time Picker */}
                                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                    <Text style={[styles.pickerLabel, { color: colors.textTertiary }]}>REMINDER TIME</Text>
                                    <DateTimePicker
                                        value={reminderTime}
                                        mode="time"
                                        display="spinner"
                                        onChange={(_, d) => d && setReminderTime(d)}
                                        textColor="#fff"
                                        style={{ height: 120 }}
                                    />
                                </View>

                                {/* Relative Time Reminder */}
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={[styles.pickerLabel, { color: colors.textTertiary }]}>REMIND ME BEFORE</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                        {[undefined, 5, 15, 30, 60].map((mins) => (
                                            <TouchableOpacity
                                                key={mins === undefined ? 'none' : mins}
                                                onPress={() => { selectionFeedback(); setReminderOffset(mins); }}
                                                style={[
                                                    styles.unitChip,
                                                    reminderOffset === mins && { backgroundColor: selectedColor + '20', borderColor: selectedColor }
                                                ]}
                                            >
                                                <Text style={{ color: reminderOffset === mins ? selectedColor : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                                                    {mins === undefined ? 'At time' : `${mins} min before`}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Location Reminder (Placeholder Logic) */}
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={[styles.pickerLabel, { color: colors.textTertiary }]}>LOCATION TRIGGER (Beta)</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                selectionFeedback();
                                                if (locationReminders.some(l => l.name === 'Home')) {
                                                    setLocationReminders(prev => prev.filter(l => l.name !== 'Home'));
                                                } else {
                                                    // Mock Location for now
                                                    setLocationReminders(prev => [...prev, { name: 'Home', latitude: 0, longitude: 0 }]);
                                                }
                                            }}
                                            style={[
                                                styles.unitChip,
                                                locationReminders.some(l => l.name === 'Home') && { backgroundColor: selectedColor + '20', borderColor: selectedColor }
                                            ]}
                                        >
                                            <Ionicons name="home" size={14} color={locationReminders.some(l => l.name === 'Home') ? selectedColor : colors.textSecondary} style={{ marginRight: 6 }} />
                                            <Text style={{ color: locationReminders.some(l => l.name === 'Home') ? selectedColor : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Arriving Home</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => {
                                                selectionFeedback();
                                                if (locationReminders.some(l => l.name === 'Work')) {
                                                    setLocationReminders(prev => prev.filter(l => l.name !== 'Work'));
                                                } else {
                                                    setLocationReminders(prev => [...prev, { name: 'Work', latitude: 0, longitude: 0 }]);
                                                }
                                            }}
                                            style={[
                                                styles.unitChip,
                                                locationReminders.some(l => l.name === 'Work') && { backgroundColor: selectedColor + '20', borderColor: selectedColor }
                                            ]}
                                        >
                                            <Ionicons name="business" size={14} color={locationReminders.some(l => l.name === 'Work') ? selectedColor : colors.textSecondary} style={{ marginRight: 6 }} />
                                            <Text style={{ color: locationReminders.some(l => l.name === 'Work') ? selectedColor : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Arriving Work</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </ScrollView>
                        )}

                        <TouchableOpacity onPress={() => setActiveOverlay('none')} style={[styles.doneButton, { backgroundColor: selectedColor, marginTop: 'auto' }]}>
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* GRAPH OVERLAY */}
                {activeOverlay === 'graph' && (
                    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}>
                        <OverlayHeader title="Graph Style" onClose={() => setActiveOverlay('none')} />
                        {GRAPH_STYLES.map(g => (
                            <TouchableOpacity
                                key={g.id}
                                onPress={() => { selectionFeedback(); setGraphStyle(g.id); setActiveOverlay('none'); }}
                                style={[styles.listItem, { backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderColor: effectiveBorderColor }, graphStyle === g.id && { backgroundColor: selectedColor + '20' }]}
                            >
                                <Ionicons name={g.icon as any} size={20} color={graphStyle === g.id ? selectedColor : colors.textSecondary} />
                                <Text style={[styles.listItemText, { color: graphStyle === g.id ? selectedColor : colors.text }]}>{g.label}</Text>
                                {graphStyle === g.id && <Ionicons name="checkmark" size={20} color={selectedColor} />}
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                )}

                {/* HEALTHKIT OVERLAY */}
                {activeOverlay === 'healthKit' && (
                    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}>
                        <OverlayHeader title="Apple Health" onClose={() => setActiveOverlay('none')} />

                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
                            Automatically sync data from Apple Health to complete this habit.
                        </Text>

                        <TouchableOpacity
                            onPress={() => { selectionFeedback(); setHealthKitMetric(undefined); setHealthKitTarget(undefined); setActiveOverlay('none'); }}
                            style={[styles.listItem, { backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderColor: effectiveBorderColor }, !healthKitMetric && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                        >
                            <Ionicons name="close-circle-outline" size={20} color={!healthKitMetric ? selectedColor : colors.textSecondary} />
                            <Text style={[styles.listItemText, { color: !healthKitMetric ? selectedColor : colors.text }]}>Manual Tracking (No Sync)</Text>
                            {!healthKitMetric && <Ionicons name="checkmark" size={20} color={selectedColor} />}
                        </TouchableOpacity>

                        <View style={{ height: 1, backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', marginVertical: 10 }} />

                        {HEALTH_KIT_METRICS.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => {
                                    selectionFeedback();
                                    setHealthKitMetric(m.id as any);
                                    // Auto-set unit
                                    setMeasurementUnit(m.unit);
                                    // If target not set, set a default? No, keep user's.
                                    setActiveOverlay('none');
                                }}
                                style={[styles.listItem, { backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderColor: effectiveBorderColor }, healthKitMetric === m.id && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                            >
                                <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#FA2D4820', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name={m.icon as any} size={14} color="#FA2D48" />
                                </View>
                                <Text style={[styles.listItemText, { color: healthKitMetric === m.id ? selectedColor : colors.text }]}>{m.label}</Text>
                                {healthKitMetric === m.id && <Ionicons name="checkmark" size={20} color={selectedColor} />}
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                )}

                {/* MEASUREMENT OVERLAY */}
                {activeOverlay === 'measurement' && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                        <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
                        <Animated.View
                            entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
                            exiting={SlideOutDown.duration(250)}
                            style={[styles.overlayPanel, { backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}
                            onStartShouldSetResponder={() => true}
                        >
                            <OverlayHeader title="Target & Units" onClose={() => { Keyboard.dismiss(); setActiveOverlay('none'); }} />

                            {/* Number Input with Keyboard */}
                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <Text style={[styles.pickerLabel, { color: colors.textTertiary }]}>TARGET VALUE</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <TouchableOpacity onPress={() => {
                                        const current = parseInt(targetInputValue, 10) || 1;
                                        const newVal = Math.max(1, current - 1);
                                        setTargetInputValue(newVal.toString());
                                        setMeasurementValue(newVal);
                                    }} style={[styles.counterBtn, { backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }]}>
                                        <Ionicons name="remove" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                    <TextInput
                                        value={targetInputValue}
                                        onChangeText={(text) => {
                                            // Allow empty string while typing
                                            const cleaned = text.replace(/[^0-9]/g, '');
                                            setTargetInputValue(cleaned);
                                            const num = parseInt(cleaned, 10);
                                            if (!isNaN(num) && num > 0) setMeasurementValue(num);
                                        }}
                                        onBlur={() => {
                                            // On blur, ensure valid value
                                            const num = parseInt(targetInputValue, 10);
                                            if (isNaN(num) || num < 1) {
                                                setTargetInputValue('1');
                                                setMeasurementValue(1);
                                            }
                                        }}
                                        keyboardType="number-pad"
                                        style={{
                                            fontSize: 40,
                                            fontWeight: '900',
                                            color: colors.text,
                                            textAlign: 'center',
                                            minWidth: 80,
                                            backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                                            borderRadius: 12,
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                        }}
                                    />
                                    <TouchableOpacity onPress={() => {
                                        const current = parseInt(targetInputValue, 10) || 0;
                                        const newVal = current + 1;
                                        setTargetInputValue(newVal.toString());
                                        setMeasurementValue(newVal);
                                    }} style={[styles.counterBtn, { backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }]}>
                                        <Ionicons name="add" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                                {/* Live Preview */}
                                <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6, fontFamily: 'Lexend_400Regular' }}>
                                    Target: {targetInputValue || '1'} {measurementUnit || 'count'}
                                </Text>
                            </View>

                            {/* Categorized Units */}
                            {/* Unit Selection */}
                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                                {UNIT_CATEGORIES.map(cat => (
                                    <View key={cat.category} style={{ marginBottom: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                            <Ionicons name={cat.icon as any} size={14} color={colors.textTertiary} />
                                            <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{cat.category.toUpperCase()}</Text>
                                        </View>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 20 }}
                                        >
                                            {cat.units.map(u => (
                                                <TouchableOpacity
                                                    key={u.id}
                                                    onPress={() => { selectionFeedback(); setMeasurementUnit(u.id); }}
                                                    style={[styles.unitChip, measurementUnit === u.id && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                                                >
                                                    <Text style={{ color: measurementUnit === u.id ? selectedColor : colors.textSecondary, fontSize: 12 }}>{u.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                ))}
                            </ScrollView>

                            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setActiveOverlay('none'); }} style={[styles.doneButton, { backgroundColor: selectedColor }]}>
                                <Text style={styles.doneButtonText}>Done</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}

                {/* TEMPLATES OVERLAY */}
                {activeOverlay === 'templates' && (
                    <Animated.View entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(250)} style={[styles.overlayPanel, { maxHeight: '85%', backgroundColor: isLight ? colors.surface : colors.surfaceSecondary }]}>
                        <OverlayHeader title="Quick Templates" onClose={() => setActiveOverlay('none')} />
                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                            {LIFE_PILLARS.map(pillar => (
                                <View key={pillar.id} style={{ marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: pillar.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name={pillar.icon as any} size={12} color={pillar.color} />
                                        </View>
                                        <Text style={{ color: pillar.color, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{pillar.fullName.toUpperCase()}</Text>
                                    </View>
                                    <View style={{ gap: 6 }}>
                                        {PREMADE_HABITS.filter(h => h.pillar === pillar.id).map((habit, idx) => (
                                            <TouchableOpacity
                                                key={`${pillar.id}-${idx}`}
                                                onPress={() => {
                                                    selectionFeedback();
                                                    setTitle(habit.name);
                                                    setSelectedIcon(habit.icon);
                                                    setSelectedColor(pillar.color);
                                                    setLifePillar(pillar.id);
                                                    setMeasurementValue(habit.goalValue);
                                                    setMeasurementUnit(habit.unit);
                                                    setActiveOverlay('none');
                                                }}
                                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: isLight ? colors.surfaceSecondary : colors.surfaceTertiary, borderRadius: 10, borderWidth: 1, borderColor: effectiveBorderColor }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <Ionicons name={habit.icon as any} size={18} color={pillar.color} />
                                                    <Text style={{ color: colors.text, fontSize: 13 }}>{habit.name}</Text>
                                                </View>
                                                <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{habit.goalValue} {habit.unit}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </Animated.View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    // New Wizard Styles
    progressContainer: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 },
    stepIndicator: { fontSize: 10, fontWeight: '700', fontFamily: 'Lexend_600SemiBold', letterSpacing: 1 },
    progressBar: { width: 100, height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },

    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, overflow: 'hidden', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    sheetLayout: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderBottomWidth: 0 },
    handleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 5 },
    handle: { width: 40, height: 4, borderRadius: 2 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, marginBottom: 10 },
    headerTitle: { fontSize: 16, textAlign: 'center', fontWeight: '900', color: '#fff', letterSpacing: 2, fontFamily: 'Lexend' },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    mainCard: { padding: 16, borderRadius: 20, marginBottom: 30 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bigIconBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    mainInput: { flex: 1, fontSize: 18, fontWeight: '600', color: '#fff', fontFamily: 'Lexend' },
    colorDotBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 16, letterSpacing: 1, opacity: 0.8, fontFamily: 'Lexend' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: { width: '48%', padding: 16, borderRadius: 16, borderWidth: 1, minHeight: 100, justifyContent: 'space-between' },
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
    iconOption: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
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
    unitChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
});
