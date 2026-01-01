import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, DeviceEventEmitter, Platform, Dimensions, ScrollView, Modal, Switch, KeyboardAvoidingView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addHabit, updateHabit, HabitCategory, HabitType, GoalPeriod, ChartType } from '@/lib/habits';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { UnifiedInputModal, InputMode } from '@/components/Common/UnifiedInputModal';
import { cn } from '@/lib/utils';
import { useRouter, useGlobalSearchParams } from 'expo-router';
import { IconPicker } from '@/components/IconPicker';
import { UnitSelector } from '@/components/UnitSelector';
import { ColorPickerModal } from '@/components/ColorPickerModal';
import { GoalPicker } from '@/components/GoalPicker';

// --- Constants ---

const categories: { key: HabitCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'health', label: 'Health', icon: 'medical' },
    { key: 'fitness', label: 'Fitness', icon: 'fitness' },
    { key: 'work', label: 'Work', icon: 'briefcase' },
    { key: 'personal', label: 'Personal', icon: 'person' },
    { key: 'mindfulness', label: 'Mindfulness', icon: 'leaf' },
    { key: 'misc', label: 'Misc', icon: 'grid' },
];

const PRESET_COLORS = [
    '#6B46C1', // Purple (Build default)
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F97316', // Orange
    '#EF4444', // Red (Quit default)
    '#EC4899', // Pink
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#374151', // Dark Gray
    'custom', // Trigger custom color picker
];

export default function CreateScreen() {
    const router = useRouter();
    const params = useGlobalSearchParams();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'dark'];

    const parseTime = (timeStr?: string) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    };

    // --- State ---
    const [name, setName] = useState(params.name as string || '');
    const [description, setDescription] = useState(params.description as string || '');
    const [type, setType] = useState<HabitType>((params.type as HabitType) || 'build');
    const [iconName, setIconName] = useState<keyof typeof Ionicons.glyphMap | undefined>(params.icon as any || undefined);
    const [color, setColor] = useState(params.color as string || PRESET_COLORS[0]);
    const [category, setCategory] = useState<HabitCategory>((params.category as HabitCategory) || 'work');

    const [goalValue, setGoalValue] = useState(params.goalValue ? String(params.goalValue) : '1');
    const [unit, setUnit] = useState(params.unit as string || 'count');
    const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>((params.goalPeriod as GoalPeriod) || 'daily');

    const [startAt, setStartAt] = useState<Date | null>(parseTime(params.startTime as string));
    const [endAt, setEndAt] = useState<Date | null>(parseTime(params.endTime as string));
    const [startDate, setStartDate] = useState<Date>(params.startDate ? new Date(params.startDate as string) : new Date());
    const [endDate, setEndDate] = useState<Date | null>(params.endDate ? new Date(params.endDate as string) : null);

    const [taskDays, setTaskDays] = useState<string[]>(params.taskDays ? JSON.parse(params.taskDays as string) : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    const [chartType, setChartType] = useState<ChartType>((params.chartType as ChartType) || 'bar');

    const [isGoal, setIsGoal] = useState(params.isGoal === 'true');
    const [targetDate, setTargetDate] = useState<Date>(params.targetDate ? new Date(params.targetDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const [goalId, setGoalId] = useState<string | undefined>(params.goalId as string || undefined);
    const [linkToGoal, setLinkToGoal] = useState<boolean>(!!params.goalId);

    const [isArchived, setIsArchived] = useState(params.isArchived === 'true');
    const [remindersEnabled, setRemindersEnabled] = useState(false); // Simplified for now

    const [saving, setSaving] = useState(false);

    // Pickers visibility
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showGoalPicker, setShowGoalPicker] = useState(false);
    const [goalName, setGoalName] = useState('');

    // Unified Input Modal State
    const [inputModalVisible, setInputModalVisible] = useState(false);
    const [inputModalMode, setInputModalMode] = useState<InputMode>('text');
    const [inputModalTitle, setInputModalTitle] = useState('');
    const [inputModalValue, setInputModalValue] = useState<any>(null);
    const [inputModalOnConfirm, setInputModalOnConfirm] = useState<(val: any) => void>(() => { });
    const [inputModalOptions, setInputModalOptions] = useState<{ label: string, value: string }[]>([]);
    const [inputModalUnit, setInputModalUnit] = useState<string | undefined>(undefined);
    const [inputModalShowClear, setInputModalShowClear] = useState(false);
    const [inputModalOnClear, setInputModalOnClear] = useState<(() => void) | undefined>(undefined);

    const nameInputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (type === 'quit' && color === PRESET_COLORS[0]) setColor('#EF4444');
        if (type === 'build' && color === '#EF4444') setColor(PRESET_COLORS[0]);
    }, [type]);

    useEffect(() => {
        const timer = setTimeout(() => {
            nameInputRef.current?.focus();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleCreate = async () => {
        if (!name.trim()) return;
        try {
            setSaving(true);
            const fmtTime = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : undefined);
            const fmtDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : undefined;

            const habitData = {
                name: name.trim(),
                description: description.trim(),
                type,
                icon: iconName,
                color,
                category,
                goalValue: parseInt(goalValue) || 1,
                unit,
                goalPeriod,
                startTime: fmtTime(startAt),
                endTime: fmtTime(endAt),
                startDate: startDate.toISOString(),
                endDate: endDate ? endDate.toISOString() : undefined,
                isArchived,
                taskDays,
                reminders: [],
                chartType,
                showMemo: false,
                isGoal,
                targetDate: isGoal ? targetDate.toISOString() : undefined,
                goalId: goalId
            };

            if (params.id) {
                await updateHabit({
                    id: params.id as string,
                    ...habitData
                });
            } else {
                await addHabit(habitData);
            }

            DeviceEventEmitter.emit('habit_created');
            router.back();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to save habit. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const isEditing = !!params.id;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            {/* Header */}
            <View className="px-6 pt-6 pb-4 flex-row justify-between items-center" style={{ backgroundColor: colors.background }}>
                <Text className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                    {isEditing ? 'Edit Habit' : 'Custom Habit'}
                </Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.surfaceSecondary }}
                >
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

                {/* Section: Habit Details */}
                <View className="mb-8">
                    <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Habit Details</Text>

                    {/* Name & Icon */}
                    <View className="flex-row gap-3 mb-3">
                        <TouchableOpacity
                            onPress={() => setShowIconPicker(true)}
                            className="w-16 h-16 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                        >
                            <Ionicons name={(iconName ?? 'add') as any} size={32} color={color} />
                        </TouchableOpacity>
                        <View className="flex-1 rounded-2xl border px-4 justify-center"
                            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                            <TextInput
                                ref={nameInputRef}
                                value={name}
                                onChangeText={setName}
                                placeholder="Habit Name"
                                placeholderTextColor={colors.textTertiary}
                                style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}
                                returnKeyType="next"
                            />
                        </View>
                    </View>

                    {/* Description */}
                    <View className="rounded-2xl border px-4 py-3 mb-4" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Description (optional)"
                            placeholderTextColor={colors.textTertiary}
                            style={{ color: colors.textPrimary, fontSize: 15, minHeight: 60 }}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Type Selection */}
                    <View className="flex-row rounded-xl p-1 mb-4 border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                        <TouchableOpacity
                            onPress={() => setType('build')}
                            className={cn("flex-1 py-2 rounded-lg items-center", type === 'build' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                        >
                            <Text className={cn("font-semibold", type === 'build' ? "text-purple-600" : "text-gray-400")}>Build</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setType('quit')}
                            className={cn("flex-1 py-2 rounded-lg items-center", type === 'quit' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                        >
                            <Text className={cn("font-semibold", type === 'quit' ? "text-red-500" : "text-gray-400")}>Quit</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Color Picker */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                        <View className="flex-row gap-3">
                            {PRESET_COLORS.map(c => {
                                if (c === 'custom') {
                                    // Check if current color is custom (not in preset list)
                                    const isCustomColor = !PRESET_COLORS.slice(0, -1).includes(color);
                                    return (
                                        <TouchableOpacity
                                            key="custom"
                                            onPress={() => setShowColorPicker(true)}
                                            className="w-10 h-10 rounded-full items-center justify-center border-2"
                                            style={{
                                                borderColor: isCustomColor ? colors.textPrimary : colors.border,
                                                backgroundColor: isCustomColor ? color : colors.surfaceSecondary
                                            }}
                                        >
                                            <Ionicons
                                                name="color-palette"
                                                size={20}
                                                color={isCustomColor ? 'white' : colors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    );
                                }

                                return (
                                    <TouchableOpacity
                                        key={c}
                                        onPress={() => setColor(c)}
                                        className="w-10 h-10 rounded-full items-center justify-center border-2"
                                        style={{ backgroundColor: c, borderColor: color === c ? colors.textPrimary : 'transparent' }}
                                    >
                                        {color === c && <Ionicons name="checkmark" size={20} color="white" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Category */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View className="flex-row gap-2">
                            {categories.map(c => {
                                const isSelected = category === c.key;
                                return (
                                    <TouchableOpacity
                                        key={c.key}
                                        onPress={() => setCategory(c.key)}
                                        className="flex-row items-center px-3 py-2 rounded-full border"
                                        style={{
                                            backgroundColor: isSelected ? color + '20' : colors.surfaceSecondary,
                                            borderColor: isSelected ? color : colors.surfaceSecondary
                                        }}
                                    >
                                        <Ionicons name={c.icon} size={16} color={isSelected ? color : colors.textSecondary} />
                                        <Text className="ml-2 text-sm font-medium" style={{ color: isSelected ? color : colors.textPrimary }}>{c.label}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </ScrollView>
                </View>

                {/* Section: Goal Info (only if isGoal is true) */}
                {isGoal && (
                    <View className="mb-8">
                        <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Goal Settings</Text>
                        <TouchableOpacity
                            onPress={() => {
                                setInputModalMode('date');
                                setInputModalTitle('Target Date');
                                setInputModalValue(targetDate);
                                setInputModalOnConfirm(() => (date: Date) => setTargetDate(date));
                                setInputModalShowClear(false);
                                setInputModalVisible(true);
                            }}
                            className="rounded-2xl border px-4 py-4 flex-row justify-between items-center"
                            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                        >
                            <View>
                                <Text className="text-xs" style={{ color: colors.textSecondary }}>Target Date</Text>
                                <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>{targetDate.toLocaleDateString()}</Text>
                            </View>
                            <Ionicons name="calendar" size={20} color={color} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Section: Link to Goal */}
                {!isGoal && (
                    <View className="mb-8">
                        <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Link to Goal (Optional)</Text>

                        <View className="rounded-2xl border overflow-hidden" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                            <View className="flex-row justify-between items-center p-4">
                                <View className="flex-1">
                                    <Text className="font-semibold" style={{ color: colors.textPrimary }}>Connect to a Goal</Text>
                                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>Track this habit as part of a larger goal</Text>
                                </View>
                                <Switch
                                    value={linkToGoal}
                                    onValueChange={(val) => {
                                        setLinkToGoal(val);
                                        if (!val) setGoalId(undefined);
                                    }}
                                    trackColor={{ false: colors.border, true: color + '40' }}
                                    thumbColor={linkToGoal ? color : colors.surfaceSecondary}
                                />
                            </View>

                            {linkToGoal && (
                                <TouchableOpacity
                                    onPress={() => {
                                        // TODO: Show goal picker modal
                                        Alert.alert('Select Goal', 'Goal selection coming soon! For now, create a goal first from the home screen.');
                                    }}
                                    className="p-4 border-t flex-row justify-between items-center"
                                    style={{ borderColor: colors.border }}
                                >
                                    <Text style={{ color: colors.textPrimary }}>
                                        {goalId ? 'Change Goal' : 'Select Goal'}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Section: Goal Setup */}
                <View className="mb-8">
                    <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Goal Setup</Text>

                    <View className="flex-row gap-3">
                        {/* Value & Unit */}
                        <TouchableOpacity
                            onPress={() => setShowUnitSelector(true)}
                            className="flex-1 rounded-2xl border p-3"
                            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                        >
                            <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Target</Text>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>{goalValue}</Text>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-sm font-medium opacity-60" style={{ color: colors.textSecondary }}>{unit || 'count'}</Text>
                                    <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Period */}
                        <TouchableOpacity
                            onPress={() => {
                                setInputModalMode('text');
                                setInputModalTitle('Frequency');
                                setInputModalValue(goalPeriod);
                                setInputModalOptions([
                                    { label: 'Daily', value: 'daily' },
                                    { label: 'Weekly', value: 'weekly' },
                                    { label: 'Monthly', value: 'monthly' }
                                ]);
                                setInputModalOnConfirm(() => (val: string) => setGoalPeriod(val as GoalPeriod));
                                setInputModalShowClear(false);
                                setInputModalVisible(true);
                            }}
                            className="flex-1 rounded-2xl border p-3"
                            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                        >
                            <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Frequency</Text>
                            <View className="flex-row items-center justify-between mt-1">
                                <Text className="text-lg font-bold capitalize" style={{ color: color }}>{goalPeriod}</Text>
                                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Section: Schedule */}
                <View className="mb-8">
                    <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Schedule</Text>

                    {/* Task Days */}
                    <View className="flex-row justify-between mb-4">
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day, i) => {
                            const isSelected = taskDays.includes(day);
                            const label = day.charAt(0).toUpperCase();
                            return (
                                <TouchableOpacity
                                    key={day}
                                    onPress={() => {
                                        if (isSelected && taskDays.length > 1) {
                                            setTaskDays(taskDays.filter(d => d !== day));
                                        } else if (!isSelected) {
                                            setTaskDays([...taskDays, day]);
                                        }
                                    }}
                                    className="w-10 h-10 rounded-full items-center justify-center border"
                                    style={{
                                        backgroundColor: isSelected ? color : colors.surfaceSecondary,
                                        borderColor: isSelected ? color : colors.border
                                    }}
                                >
                                    <Text className={cn("font-bold", isSelected ? "text-white" : "")} style={{ color: isSelected ? 'white' : colors.textSecondary }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Time Range */}
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="flex-1 p-3 rounded-2xl border"
                            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                            onPress={() => {
                                setInputModalMode('time');
                                setInputModalTitle('Start Time');
                                setInputModalValue(startAt || new Date());
                                setInputModalOnConfirm(() => (date: Date) => setStartAt(date));
                                setInputModalShowClear(true);
                                setInputModalOnClear(() => () => setStartAt(null));
                                setInputModalVisible(true);
                            }}
                        >
                            <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Start Time</Text>
                            <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                                {startAt ? `${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}` : 'Anytime'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-1 p-3 rounded-2xl border"
                            style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}
                            onPress={() => {
                                setInputModalMode('time');
                                setInputModalTitle('End Time');
                                setInputModalValue(endAt || new Date());
                                setInputModalOnConfirm(() => (date: Date) => setEndAt(date));
                                setInputModalShowClear(true);
                                setInputModalOnClear(() => () => setEndAt(null));
                                setInputModalVisible(true);
                            }}
                        >
                            <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>End Time</Text>
                            <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                                {endAt ? `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}` : 'Anytime'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Section: Analytics */}
                <View className="mb-8">
                    <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Analytics</Text>
                    <View className="flex-row rounded-xl p-1 border" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                        <TouchableOpacity
                            onPress={() => setChartType('bar')}
                            className={cn("flex-1 py-2 rounded-lg items-center flex-row justify-center gap-2", chartType === 'bar' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                        >
                            <Ionicons name="bar-chart" size={16} color={chartType === 'bar' ? color : colors.textSecondary} />
                            <Text className="font-semibold" style={{ color: chartType === 'bar' ? color : colors.textSecondary }}>Bar Chart</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setChartType('line')}
                            className={cn("flex-1 py-2 rounded-lg items-center flex-row justify-center gap-2", chartType === 'line' ? "bg-white dark:bg-gray-700 shadow-sm" : "")}
                        >
                            <Ionicons name="pulse" size={16} color={chartType === 'line' ? color : colors.textSecondary} />
                            <Text className="font-semibold" style={{ color: chartType === 'line' ? color : colors.textSecondary }}>Line Chart</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Section: Term */}
                <View className="mb-8">
                    <Text className="text-sm font-bold uppercase tracking-wider mb-3 opacity-70" style={{ color: colors.textSecondary }}>Term</Text>

                    <View className="rounded-2xl border overflow-hidden" style={{ backgroundColor: colors.surfaceSecondary, borderColor: colors.border }}>
                        <TouchableOpacity
                            className="flex-row justify-between items-center p-4 border-b"
                            style={{ borderColor: colors.border }}
                            onPress={() => {
                                setInputModalMode('date');
                                setInputModalTitle('Start Date');
                                setInputModalValue(startDate);
                                setInputModalOnConfirm(() => (date: Date) => setStartDate(date));
                                setInputModalShowClear(false);
                                setInputModalVisible(true);
                            }}
                        >
                            <Text style={{ color: colors.textPrimary }}>Start Date</Text>
                            <Text style={{ color: colors.textSecondary }}>{startDate.toLocaleDateString()}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-row justify-between items-center p-4"
                            onPress={() => {
                                setInputModalMode('date');
                                setInputModalTitle('End Date');
                                setInputModalValue(endDate || new Date());
                                setInputModalOnConfirm(() => (date: Date) => setEndDate(date));
                                setInputModalShowClear(true);
                                setInputModalOnClear(() => () => setEndDate(null));
                                setInputModalVisible(true);
                            }}
                        >
                            <Text style={{ color: colors.textPrimary }}>End Date</Text>
                            <Text style={{ color: colors.textSecondary }}>{endDate ? endDate.toLocaleDateString() : 'Forever'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>


                {/* Icon Picker Modal */}
                <IconPicker
                    visible={showIconPicker}
                    onClose={() => setShowIconPicker(false)}
                    onSelect={(icon) => {
                        setIconName(icon);
                        setShowIconPicker(false);
                    }}
                    selectedIcon={iconName}
                    habitName={name}
                    color={color}
                />

                <UnifiedInputModal
                    visible={inputModalVisible}
                    onClose={() => setInputModalVisible(false)}
                    onConfirm={inputModalOnConfirm}
                    initialValue={inputModalValue}
                    mode={inputModalMode}
                    title={inputModalTitle}
                    options={inputModalOptions}
                    unit={inputModalUnit}
                    showClear={inputModalShowClear}
                    onClear={inputModalOnClear}
                    color={color}
                />

                <UnitSelector
                    visible={showUnitSelector}
                    onClose={() => setShowUnitSelector(false)}
                    onSelect={(selectedUnit) => setUnit(selectedUnit)}
                    currentUnit={unit}
                />

            </ScrollView>

            {/* Floating Bottom Button */}
            <View className="absolute bottom-10 left-0 right-0 px-6">
                <TouchableOpacity
                    disabled={!name.trim() || saving}
                    onPress={handleCreate}
                    className="w-full py-4 rounded-full items-center shadow-lg"
                    style={{
                        backgroundColor: !name.trim() ? colors.surfaceSecondary : color,
                        opacity: saving ? 0.7 : 1,
                        shadowColor: color,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8
                    }}
                >
                    <Text className="text-lg font-bold" style={{ color: !name.trim() ? colors.textTertiary : 'white' }}>
                        {isEditing ? 'Save Changes' : 'Create Habit'}
                    </Text>
                </TouchableOpacity>
            </View>

        </KeyboardAvoidingView>
    );
}
