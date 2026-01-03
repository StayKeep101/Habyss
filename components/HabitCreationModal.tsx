import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown, SlideOutDown, useSharedValue, useAnimatedStyle, withSpring, runOnJS, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';

import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { addHabit, HabitCategory, subscribeToHabits, Habit } from '@/lib/habits';

const { width, height } = Dimensions.get('window');

const ICONS = [
    'fitness', 'book', 'water', 'bed', 'cafe', 'walk', 'bicycle', 'barbell',
    'heart', 'musical-notes', 'brush', 'code-slash', 'language', 'leaf',
    'moon', 'sunny', 'flash', 'rocket', 'bulb', 'star'
];

const COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const CATEGORIES: { id: HabitCategory; label: string; icon: string }[] = [
    { id: 'health', label: 'Health', icon: 'heart' },
    { id: 'productivity', label: 'Productivity', icon: 'rocket' },
    { id: 'mindfulness', label: 'Mindfulness', icon: 'leaf' },
    { id: 'fitness', label: 'Fitness', icon: 'barbell' },
    { id: 'learning', label: 'Learning', icon: 'book' },
    { id: 'creativity', label: 'Creativity', icon: 'brush' },
    { id: 'social', label: 'Social', icon: 'people' },
    { id: 'personal', label: 'Personal', icon: 'person' },
];

interface HabitCreationModalProps {
    // Optional props for direct control, but can be self-managed
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

    // Internal state handling
    const [isVisible, setIsVisible] = useState(false);
    const [goalId, setGoalId] = useState<string | undefined>(propGoalId);
    const [availableGoals, setAvailableGoals] = useState<Habit[]>([]);

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

    // Listen for global events
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('show_habit_modal', (data) => {
            selectionFeedback();
            setIsVisible(true);
            setGoalId(data?.goalId || undefined);
        });
        return () => subscription.remove();
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        if (propOnClose) propOnClose();
        resetForm();
    };

    const handleSuccess = () => {
        successFeedback();
        setIsVisible(false);
        if (propOnSuccess) propOnSuccess();
        resetForm();
    };

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('fitness');
    const [selectedColor, setSelectedColor] = useState('#10B981');
    const [category, setCategory] = useState<HabitCategory>('personal');
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(Date.now() + 30 * 60 * 1000));
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const [saving, setSaving] = useState(false);

    const DAYS = [
        { id: 'mon', label: 'M' },
        { id: 'tue', label: 'T' },
        { id: 'wed', label: 'W' },
        { id: 'thu', label: 'T' },
        { id: 'fri', label: 'F' },
        { id: 'sat', label: 'S' },
        { id: 'sun', label: 'S' },
    ];

    const toggleDay = (day: string) => {
        selectionFeedback();
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const handleSave = async () => {
        if (!title.trim()) return;

        setSaving(true);
        mediumFeedback();

        try {
            const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

            await addHabit({
                name: title.trim(),
                description: description.trim(),
                type: 'build',
                icon: selectedIcon,
                color: selectedColor,
                category,
                goalValue: 1,
                unit: 'count',
                goalPeriod: 'daily',
                startTime: fmtTime(startTime),
                endTime: fmtTime(endTime),
                taskDays: selectedDays,
                startDate: new Date().toISOString(),
                isArchived: false,
                reminders: [],
                isGoal: false,
                goalId: goalId || undefined,
            });

            successFeedback();
            resetForm();
            handleSuccess();
        } catch (e) {
            console.error(e);
            setSaving(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setSelectedIcon('fitness');
        setSelectedColor('#10B981');
        setCategory('personal');
        setStartTime(new Date());
        setEndTime(new Date(Date.now() + 30 * 60 * 1000));
        setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
        setGoalId(undefined);
        setSaving(false);
    };

    // Gesture Handling
    const translateY = useSharedValue(0);
    const context = useSharedValue({ y: 0 });

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            // Only allow dragging down
            if (event.translationY > 0) {
                translateY.value = event.translationY + context.value.y;
            }
        })
        .onEnd(() => {
            if (translateY.value > 100) {
                runOnJS(handleClose)();
            } else {
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }]
        };
    });

    // Reset translation when modal opens
    useEffect(() => {
        if (isVisible) {
            translateY.value = 0;
        }
    }, [isVisible]);


    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={handleClose}
                >
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                </TouchableOpacity>

                <GestureDetector gesture={gesture}>
                    <Animated.View
                        entering={SlideInDown.springify().damping(15)}
                        exiting={SlideOutDown}
                        style={[styles.container, animatedStyle, { overflow: 'hidden' }]}
                    >
                        <LinearGradient
                            colors={['#334155', '#0f172a']}
                            style={StyleSheet.absoluteFill}
                        />

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.handle} />
                            <View style={styles.headerRow}>
                                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                                    New Habit
                                </Text>
                                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView
                            style={styles.content}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 100 }}
                        >
                            {/* Title */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>TITLE</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                                    placeholder="e.g., Morning Meditation"
                                    placeholderTextColor={colors.textTertiary}
                                    value={title}
                                    onChangeText={setTitle}
                                />
                            </View>

                            {/* Description */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION (OPTIONAL)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                                    placeholder="Add details about this habit..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            {/* Goal Link (Optional) */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>LINK TO GOAL (OPTIONAL)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => { selectionFeedback(); setGoalId(undefined); }}
                                        style={[
                                            styles.goalChip,
                                            { borderColor: !goalId ? colors.primary : colors.border, backgroundColor: !goalId ? colors.primary + '20' : 'transparent' }
                                        ]}
                                    >
                                        <Ionicons name="close-circle-outline" size={16} color={!goalId ? colors.primary : colors.textSecondary} />
                                        <Text style={{ color: !goalId ? colors.primary : colors.textSecondary, marginLeft: 6, fontSize: 12 }}>None</Text>
                                    </TouchableOpacity>
                                    {availableGoals.map(goal => (
                                        <TouchableOpacity
                                            key={goal.id}
                                            onPress={() => { selectionFeedback(); setGoalId(goal.id); }}
                                            style={[
                                                styles.goalChip,
                                                { borderColor: goalId === goal.id ? goal.color : colors.border, backgroundColor: goalId === goal.id ? goal.color + '20' : 'transparent' }
                                            ]}
                                        >
                                            <Ionicons name={goal.icon as any} size={16} color={goalId === goal.id ? goal.color : colors.textSecondary} />
                                            <Text style={{ color: goalId === goal.id ? goal.color : colors.textSecondary, marginLeft: 6, fontSize: 12 }}>
                                                {goal.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Time Range */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>TIME</Text>
                                <View style={styles.timeRow}>
                                    <TouchableOpacity
                                        style={[styles.timeButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                                        onPress={() => setShowStartPicker(true)}
                                    >
                                        <Ionicons name="time-outline" size={18} color={selectedColor} />
                                        <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>{formatTime(startTime)}</Text>
                                    </TouchableOpacity>
                                    <Text style={{ color: colors.textTertiary, marginHorizontal: 12 }}>to</Text>
                                    <TouchableOpacity
                                        style={[styles.timeButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                                        onPress={() => setShowEndPicker(true)}
                                    >
                                        <Ionicons name="time-outline" size={18} color={selectedColor} />
                                        <Text style={{ color: colors.textPrimary, marginLeft: 8 }}>{formatTime(endTime)}</Text>
                                    </TouchableOpacity>
                                </View>
                                {showStartPicker && (
                                    <DateTimePicker
                                        value={startTime}
                                        mode="time"
                                        display="spinner"
                                        onChange={(e, date) => {
                                            setShowStartPicker(false);
                                            if (date) setStartTime(date);
                                        }}
                                    />
                                )}
                                {showEndPicker && (
                                    <DateTimePicker
                                        value={endTime}
                                        mode="time"
                                        display="spinner"
                                        onChange={(e, date) => {
                                            setShowEndPicker(false);
                                            if (date) setEndTime(date);
                                        }}
                                    />
                                )}
                            </View>

                            {/* Days */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>REPEAT ON</Text>
                                <View style={styles.daysRow}>
                                    {DAYS.map(day => (
                                        <TouchableOpacity
                                            key={day.id}
                                            onPress={() => toggleDay(day.id)}
                                            style={[
                                                styles.dayButton,
                                                { borderColor: selectedDays.includes(day.id) ? selectedColor : colors.border },
                                                selectedDays.includes(day.id) && { backgroundColor: selectedColor + '30' }
                                            ]}
                                        >
                                            <Text style={{
                                                color: selectedDays.includes(day.id) ? selectedColor : colors.textSecondary,
                                                fontWeight: '600'
                                            }}>
                                                {day.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Category */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.categoriesRow}>
                                        {CATEGORIES.map(cat => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                onPress={() => { setCategory(cat.id); selectionFeedback(); }}
                                                style={[
                                                    styles.categoryChip,
                                                    { borderColor: category === cat.id ? selectedColor : colors.border },
                                                    category === cat.id && { backgroundColor: selectedColor + '20' }
                                                ]}
                                            >
                                                <Ionicons name={cat.icon as any} size={16} color={category === cat.id ? selectedColor : colors.textSecondary} />
                                                <Text style={{ color: category === cat.id ? selectedColor : colors.textSecondary, marginLeft: 6, fontSize: 12 }}>
                                                    {cat.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            {/* Icon */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>ICON</Text>
                                <View style={styles.iconsGrid}>
                                    {ICONS.map(icon => (
                                        <TouchableOpacity
                                            key={icon}
                                            onPress={() => { setSelectedIcon(icon); selectionFeedback(); }}
                                            style={[
                                                styles.iconButton,
                                                { borderColor: selectedIcon === icon ? selectedColor : colors.border },
                                                selectedIcon === icon && { backgroundColor: selectedColor + '20' }
                                            ]}
                                        >
                                            <Ionicons name={icon as any} size={22} color={selectedIcon === icon ? selectedColor : colors.textSecondary} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Color */}
                            <View style={styles.section}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>COLOR</Text>
                                <View style={styles.colorsRow}>
                                    {COLORS.map(color => (
                                        <TouchableOpacity
                                            key={color}
                                            onPress={() => { setSelectedColor(color); selectionFeedback(); }}
                                            style={[
                                                styles.colorButton,
                                                { backgroundColor: color },
                                                selectedColor === color && styles.colorSelected
                                            ]}
                                        >
                                            {selectedColor === color && (
                                                <Ionicons name="checkmark" size={16} color="#fff" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        {/* Save Button */}
                        <View style={[styles.footer, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={!title.trim() || saving}
                                style={[styles.saveButton, { opacity: !title.trim() ? 0.5 : 1 }]}
                            >
                                <LinearGradient
                                    colors={[selectedColor, selectedColor + 'CC']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.saveGradient}
                                >
                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                    <Text style={styles.saveText}>Create Habit</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </GestureDetector>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: height * 0.9,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 20,
    },
    section: {
        marginTop: 20,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 10,
        fontFamily: 'SpaceMono-Regular',
    },
    input: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        borderWidth: 1,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    categoriesRow: {
        flexDirection: 'row',
        gap: 10,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
    },
    iconsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    goalChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    colorsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    colorButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorSelected: {
        borderWidth: 3,
        borderColor: '#fff',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    saveButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    saveGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    saveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
    },
});
