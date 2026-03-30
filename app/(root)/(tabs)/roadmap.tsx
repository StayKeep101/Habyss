import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, LayoutAnimation, Platform, UIManager, InteractionManager, DeviceEventEmitter, ScrollView, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    Easing,
    interpolate,
    Extrapolation,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { GoalCard } from '@/components/Home/GoalCard';
import { GoalCreationWizard } from '@/components/GoalCreationWizard';

import { subscribeToHabits, getCompletions, toggleCompletion, removeHabitEverywhere, calculateGoalProgress, calculateGoalProgressInstant, getLastNDaysCompletions, isHabitScheduledForDate, addHabit, updateHabit, Habit as StoreHabit } from '@/lib/habitsSQLite';
import { FriendsService } from '@/lib/friendsService';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useFocusTime } from '@/constants/FocusTimeContext';
import { useRoutines } from '@/constants/RoutineContext';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface Habit extends StoreHabit {
    streak?: number;
    completed?: boolean;
}

type FilterType = 'all' | 'goals_only' | 'habits_only';
type SortType = 'default' | 'name' | 'progress';
type TimeFilter = 'all' | 'morning' | 'afternoon' | 'evening';

// Helper to categorize habits by their start time
const getTimeCategory = (startTime?: string): TimeFilter => {
    if (!startTime) return 'all';
    const hour = parseInt(startTime.split(':')[0], 10);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
};

const CalendarScreen = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();
    const { cardSize } = useAppSettings();
    const { activeHabitId, activeHabitName, isRunning: isFocusRunning, startTimer, timeLeft, totalDuration } = useFocusTime();
    const { getRoutinesForHabit } = useRoutines();

    // Data State
    const [habitsStore, setHabitsStore] = useState<StoreHabit[]>([]);
    // habits state removed - usage replaced by memoized derivation
    const [completions, setCompletions] = useState<Record<string, boolean>>({});
    const [todayCompletions, setTodayCompletions] = useState<Record<string, boolean>>({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [goalProgress, setGoalProgress] = useState<Record<string, number>>({});
    const [sharedHabits, setSharedHabits] = useState<any[]>([]);
    const [sharedGoals, setSharedGoals] = useState<any[]>([]);

    // UI State
    const [isWizardVisible, setIsWizardVisible] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [activeSort, setActiveSort] = useState<SortType>('default');
    const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('all');
    const [selectedGoalFilter, setSelectedGoalFilter] = useState<string | null>(null); // Filter by specific goal ID
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null); // Filter by life pillar
    const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
    const [weeklyCompletions, setWeeklyCompletions] = useState<Record<string, { completed: number; total: number }>>({});
    const [historyData, setHistoryData] = useState<{ date: string; completedIds: string[] }[]>([]);
    const [draggingHabit, setDraggingHabit] = useState<Habit | null>(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
    const goalRefs = useRef<Record<string, View | null>>({});
    const goalDropLayouts = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});

    // Pull-to-Filter Logic
    const scrollY = useSharedValue(0);
    const filterTriggered = useSharedValue(false);
    const wasAtTop = useSharedValue(true); // Track if user was at top before pulling

    // Filter Modal Animation
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');
    const FILTER_SHEET_HEIGHT = SCREEN_HEIGHT * 0.55;
    const FILTER_DRAG_THRESHOLD = 60;
    const filterTranslateY = useSharedValue(FILTER_SHEET_HEIGHT);

    const closeFilterModal = useCallback(() => {
        filterTranslateY.value = withTiming(FILTER_SHEET_HEIGHT, { duration: 280, easing: Easing.in(Easing.cubic) });
        setTimeout(() => setShowFilter(false), 280);
    }, [FILTER_SHEET_HEIGHT]);

    const openFilterModal = useCallback(() => {
        setShowFilter(true);
        // Use spring for smoother, more natural entrance
        filterTranslateY.value = withSpring(0, { damping: 20, stiffness: 90 });
    }, []);

    const filterPanGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) filterTranslateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > FILTER_DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeFilterModal)();
            else filterTranslateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        });

    const filterSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: filterTranslateY.value }] }));
    const filterBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(filterTranslateY.value, [0, FILTER_SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP)
    }));

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentY = event.contentOffset.y;
            scrollY.value = currentY;

            // Track if user is at the top of the content
            if (currentY <= 0) {
                wasAtTop.value = true;
            } else if (currentY > 50) {
                // Only reset once scrolled down enough
                wasAtTop.value = false;
            }

            // Only trigger filter if: pulling down (-80), was already at top, and not already triggered
            if (currentY < -80 && wasAtTop.value && !filterTriggered.value) {
                filterTriggered.value = true;
                runOnJS(lightFeedback)();
                runOnJS(openFilterModal)();
            }
        },
        onEndDrag: () => {
            filterTriggered.value = false;
        }
    });

    // --- Subscriptions & Effects ---

    useEffect(() => {
        const unsubPromise = subscribeToHabits((newHabits) => {
            setHabitsStore(newHabits);
        });
        return () => { unsubPromise.then(unsub => unsub()); };
    }, []);

    useEffect(() => {
        const loadCompletions = async () => {
            // Use local date format (not UTC)
            const now = selectedDate;
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const c = await getCompletions(dateStr);
            setCompletions(c);
        };
        loadCompletions();

        // Listen for updates from other screens (Home, Detail)
        const sub = DeviceEventEmitter.addListener('habit_completion_updated', ({ habitId, date, completed }) => {
            const now = selectedDate;
            const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Update viewed completions if date matches
            if (date === currentDateStr) {
                setCompletions(prev => ({
                    ...prev,
                    [habitId]: completed
                }));
            }

            // Update todayCompletions if date matches today
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (date === todayStr) {
                setTodayCompletions(prev => ({
                    ...prev,
                    [habitId]: completed
                }));
            }
        });

        return () => sub.remove();
    }, [selectedDate]); // FIXED: Removed historyData from deps to prevent infinite loop

    // Load Today's Completions specifically for Goal Calculation
    useEffect(() => {
        const loadToday = async () => {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const c = await getCompletions(todayStr);
            setTodayCompletions(c);
        };
        loadToday();
    }, []);

    // SEPARATE EFFECT: Load history data ONCE on mount (not on every historyData change!)
    useEffect(() => {
        const loadHistory = async () => {
            const data = await getLastNDaysCompletions(90);
            setHistoryData(data);
        };
        loadHistory();
    }, []); // Empty deps - only run once on mount

    // Load shared items
    useEffect(() => {
        const loadShared = async () => {
            try {
                const [habits, goals] = await Promise.all([
                    FriendsService.getHabitsSharedWithMe(),
                    FriendsService.getGoalsSharedWithMe()
                ]);
                setSharedHabits(habits);
                setSharedGoals(goals);
            } catch (e) {
                console.log('Error loading shared items:', e);
            }
        };
        loadShared();
    }, []);

    // Optimized History Lookup Maps
    const historyMap = useMemo(() => {
        const map: Record<string, string[]> = {};
        historyData.forEach(d => map[d.date] = d.completedIds);
        return map;
    }, [historyData]);

    // SEPARATE EFFECT: Recalculate goal progress when relevant data changes
    useEffect(() => {
        if (historyData.length === 0) return; // Wait for history to load

        const goals = habitsStore.filter(h => h.isGoal);
        if (goals.length === 0) return;

        // Defer heavy calculation to after navigation animation
        const task = InteractionManager.runAfterInteractions(() => {
            const progressMap: Record<string, number> = {};
            goals.forEach(g => {
                // IMPORTANT: Pass todayCompletions, NOT current view completions
                progressMap[g.id] = calculateGoalProgressInstant(g, habitsStore, todayCompletions, historyMap);
            });
            setGoalProgress(progressMap);
        });
        return () => task.cancel();
    }, [habitsStore, todayCompletions, historyMap]);

    // Map habits with completion status - OPTIMIZED: only on data changes
    // Map habits effect removed - redundant O(N) state update

    // Weekly Calcs - OPTIMIZED: only run on mount to prevent JS thread hammering
    useEffect(() => {
        const calcWeeklyCompletions = async () => {
            const today = new Date();
            const dates: string[] = [];

            // Generate date strings (14 days only for performance)
            for (let i = -7; i <= 7; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() + i);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                dates.push(dateStr);
            }

            // Load all completions in PARALLEL
            const completionsArray = await Promise.all(dates.map(d => getCompletions(d)));

            // Build result map
            const totalHabits = habitsStore.filter(h => !h.isGoal).length;
            const result: Record<string, { completed: number; total: number }> = {};
            dates.forEach((dateStr, i) => {
                const completedCount = Object.values(completionsArray[i]).filter(Boolean).length;
                result[dateStr] = { completed: completedCount, total: totalHabits };
            });

            setWeeklyCompletions(result);
        };

        if (habitsStore.length > 0) {
            // Defer heavy calculation until after navigation animation
            const task = InteractionManager.runAfterInteractions(() => {
                calcWeeklyCompletions();
            });
            return () => task.cancel();
        }
    }, [habitsStore]); // Only depend on habitsStore, not completions

    const { playComplete, playClick } = useSoundEffects();

    const handleDateSelect = (date: Date) => {
        lightFeedback();
        playClick();
        setSelectedDate(date);
    };

    // Debounce ref to prevent double-tap
    const isNavigating = useRef(false);

    const handleHabitPress = useCallback(async (habit: Habit) => {
        // Prevent double-tap
        if (isNavigating.current) return;
        isNavigating.current = true;

        // TOGGLE COMPLETION LOGIC for Roadmap
        const now = selectedDate;
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Get today's date for comparison
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Only allow completion for TODAY
        if (dateStr !== todayStr) {
            Alert.alert('Cannot Modify', 'You can only mark habits complete for today.');
            isNavigating.current = false;
            return;
        }

        // 1. Optimistic Update
        const isCompleted = !completions[habit.id];
        setCompletions(prev => ({ ...prev, [habit.id]: isCompleted }));
        // Also update todayCompletions since we are editing today
        setTodayCompletions(prev => ({ ...prev, [habit.id]: isCompleted }));

        // 2. Feedback
        if (isCompleted) {
            playComplete();
            selectionFeedback(); // Stronger feedback for complete
        } else {
            lightFeedback();
        }

        // 3. Persist - Fire and forget (no await) for instant response
        toggleCompletion(habit.id, dateStr).catch(e => {
            // Revert on error
            setCompletions(prev => ({ ...prev, [habit.id]: !isCompleted }));
            console.error(e);
        });

        setTimeout(() => { isNavigating.current = false; }, 300);
    }, [selectedDate, completions, playComplete, selectionFeedback, lightFeedback]);

    const handleDelete = (habit: Habit) => {
        Alert.alert(
            habit.isGoal ? "Delete Goal" : "Delete Habit",
            "Are you sure? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await removeHabitEverywhere(habit.id);
                    }
                }
            ]
        );
    };

    const handleEdit = (habit: Habit) => {
        // Use global modal via DeviceEventEmitter
        DeviceEventEmitter.emit('show_habit_modal', {
            goalId: habit.goalId,
            initialHabit: habit
        });
    };

    const getRoutineMeta = useCallback((habitId: string) => {
        const routines = getRoutinesForHabit(habitId);
        if (routines.length === 0) return null;
        const primaryRoutine = routines[0];
        return {
            name: primaryRoutine.name,
            emoji: primaryRoutine.emoji,
        };
    }, [getRoutinesForHabit]);

    const isHabitFocusableNow = useCallback((habit: Habit) => {
        if (!habit.startTime) return false;

        const now = new Date();
        const selectedStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (selectedStr !== todayStr) return false;

        const [hour, minute] = habit.startTime.split(':').map(Number);
        if (Number.isNaN(hour) || Number.isNaN(minute)) return false;

        const scheduledStart = new Date(now);
        scheduledStart.setHours(hour, minute, 0, 0);

        const bufferMinutes = 10;
        const durationMinutes = habit.durationMinutes || 30;
        const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);
        const openWindowStart = new Date(scheduledStart.getTime() - bufferMinutes * 60 * 1000);

        return now >= openWindowStart && now <= scheduledEnd;
    }, [selectedDate]);

    const handleFocusHabit = useCallback((habit: Habit) => {
        if (activeHabitId === habit.id) {
            router.push({ pathname: '/habit-detail', params: { habitId: habit.id } });
            return;
        }

        if (isFocusRunning && activeHabitId && activeHabitId !== habit.id) {
            Alert.alert(
                'Focus Session Active',
                `Finish "${activeHabitName || 'your current habit'}" before starting focus on another habit.`
            );
            return;
        }

        const durationSeconds = Math.max((habit.durationMinutes || 25) * 60, 300);
        const started = startTimer(habit.id, habit.name, durationSeconds);
        if (!started) {
            Alert.alert('Unable to Start Focus', 'A focus session is already active for another habit.');
            return;
        }

        lightFeedback();
    }, [activeHabitId, activeHabitName, isFocusRunning, lightFeedback, router, startTimer]);

    const measureGoalDropTargets = useCallback(async (goalList: Habit[]) => {
        const entries = await Promise.all(
            goalList.map(
                (goal) =>
                    new Promise<[string, { x: number; y: number; width: number; height: number } | null]>((resolve) => {
                        const ref = goalRefs.current[goal.id];
                        if (!ref || typeof ref.measureInWindow !== 'function') {
                            resolve([goal.id, null]);
                            return;
                        }

                        ref.measureInWindow((x, y, width, height) => {
                            resolve([goal.id, { x, y, width, height }]);
                        });
                    })
            )
        );

        goalDropLayouts.current = Object.fromEntries(entries.filter((entry): entry is [string, { x: number; y: number; width: number; height: number }] => !!entry[1]));
    }, []);

    const getHoveredGoalAtPoint = useCallback((x: number, y: number) => {
        for (const [goalId, layout] of Object.entries(goalDropLayouts.current)) {
            if (x >= layout.x && x <= layout.x + layout.width && y >= layout.y && y <= layout.y + layout.height) {
                return goalId;
            }
        }
        return null;
    }, []);

    const handleHabitDragStart = useCallback(async (habit: Habit, x: number, y: number) => {
        selectionFeedback();
        setDraggingHabit(habit);
        setDragPosition({ x, y });
        const currentGoals = habitsStore.filter((item) => item.isGoal) as Habit[];
        await measureGoalDropTargets(currentGoals);
        setHoveredGoalId(getHoveredGoalAtPoint(x, y));
    }, [measureGoalDropTargets, getHoveredGoalAtPoint, selectionFeedback, habitsStore]);

    const handleHabitDragMove = useCallback((habit: Habit, x: number, y: number) => {
        setDragPosition({ x, y });
        setHoveredGoalId(getHoveredGoalAtPoint(x, y));
    }, [getHoveredGoalAtPoint]);

    const handleHabitDragEnd = useCallback(async (habit: Habit, x: number, y: number) => {
        const targetGoalId = getHoveredGoalAtPoint(x, y);

        setDraggingHabit(null);
        setHoveredGoalId(null);

        if (!targetGoalId || targetGoalId === habit.goalId) {
            return;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        await updateHabit({ id: habit.id, goalId: targetGoalId });
        setExpandedGoals((prev) => ({ ...prev, [targetGoalId]: true }));
        lightFeedback();
    }, [getHoveredGoalAtPoint, lightFeedback]);

    const toggleGoalExpansion = (goalId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedGoals(prev => ({
            ...prev,
            [goalId]: !prev[goalId]
        }));
        selectionFeedback();
    };

    // --- Grouping Logic ---
    const goals = useMemo(() => habitsStore.filter(h => h.isGoal), [habitsStore]);

    // Only show habits scheduled for the selected date
    // Memoized Data derivation with additional filters
    const { allHabits, habitsByGoal } = useMemo(() => {
        let filtered = habitsStore.filter(h => !h.isGoal && !h.isArchived && isHabitScheduledForDate(h, selectedDate));

        // Apply goal filter - show only habits linked to specific goal
        if (selectedGoalFilter) {
            filtered = filtered.filter(h => h.goalId === selectedGoalFilter);
        }

        // Apply category (life pillar) filter
        if (selectedCategoryFilter) {
            filtered = filtered.filter(h => h.category === selectedCategoryFilter);
        }

        if (activeTimeFilter !== 'all') {
            filtered = filtered.filter(h => getTimeCategory(h.startTime) === activeTimeFilter);
        }

        const byGoal: Record<string, Habit[]> = {};

        filtered.forEach(h => {
            if (h.goalId) {
                if (!byGoal[h.goalId]) byGoal[h.goalId] = [];
                byGoal[h.goalId].push(h);
            }
        });

        return { allHabits: filtered, habitsByGoal: byGoal };
    }, [habitsStore, selectedDate, selectedGoalFilter, selectedCategoryFilter, activeTimeFilter]);

    // Loose habits are those not linked to any goal, or linked to a non-existent goal
    const looseHabits = useMemo(() => {
        return allHabits.filter(h => !h.goalId || !goals.some(g => g.id === h.goalId));
    }, [allHabits, goals]);

    const isGoalFilter = activeFilter === 'goals_only';
    const isHabitFilter = activeFilter === 'habits_only';
    const hasActiveFilters = selectedGoalFilter !== null || selectedCategoryFilter !== null;

    const activeGoalName = selectedGoalFilter ? goals.find(g => g.id === selectedGoalFilter)?.name : null;
    const visibleHabitCount = activeFilter === 'all'
        ? looseHabits.length + Object.values(habitsByGoal).flat().length
        : allHabits.length;
    const visibleGoalCount = activeFilter === 'habits_only'
        ? 0
        : goals.filter(goal => activeTimeFilter === 'all' || (habitsByGoal[goal.id] || []).length > 0).length;
    const activeFilterCount = [
        activeFilter !== 'all',
        activeSort !== 'default',
        activeTimeFilter !== 'all',
        !!selectedGoalFilter,
        !!selectedCategoryFilter,
    ].filter(Boolean).length;

    const resetFilters = useCallback(() => {
        selectionFeedback();
        setActiveFilter('all');
        setActiveSort('default');
        setSelectedGoalFilter(null);
        setSelectedCategoryFilter(null);
        setActiveTimeFilter('all');
    }, [selectionFeedback]);

    // Sorting Logic
    const sortedGoals = useMemo(() => {
        return [...goals].sort((a, b) => {
            if (activeSort === 'name') return a.name.localeCompare(b.name);
            if (activeSort === 'progress') {
                return (goalProgress[b.id] || 0) - (goalProgress[a.id] || 0);
            }
            return 0; // Default (Creation order usually)
        });
    }, [goals, activeSort, goalProgress]);

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={{ flex: 1, position: 'relative' }}>

                    {/* Layer 1: Calendar Strip */}
                    <View style={{ zIndex: 10 }}>
                        <CalendarStrip
                            selectedDate={selectedDate}
                            onSelectDate={handleDateSelect}
                            completionData={weeklyCompletions}
                            goalDeadlines={useMemo(() => {
                                const map: Record<string, { count: number, color: string }> = {};
                                goals.forEach(g => {
                                    if (g.targetDate) {
                                        // targetDate is likely YYYY-MM-DD string already? 
                                        // StoreHabit definition has targetDate?: string
                                        // Let's assume it matches the dateStr format or normalize it if needed.
                                        // Ideally targetDate is "YYYY-MM-DD".
                                        if (!map[g.targetDate]) {
                                            map[g.targetDate] = { count: 1, color: g.color || accentColor };
                                        } else {
                                            map[g.targetDate].count++;
                                        }
                                    }
                                });
                                return map;
                            }, [goals, accentColor])}
                        />
                    </View>

                    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                        <Animated.ScrollView
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: 8 }}
                            showsVerticalScrollIndicator={false}
                            bounces={true}
                            alwaysBounceVertical={true}
                            style={{ backgroundColor: 'transparent' }}
                        >

                            {/* Filter Indicator - Subtle compact pill */}
                            {(activeFilter !== 'all' || hasActiveFilters || activeTimeFilter !== 'all' || activeSort !== 'default') && (
                                <View style={{
                                    alignSelf: 'flex-start',
                                    backgroundColor: accentColor + '25',
                                    paddingLeft: 10,
                                    paddingRight: 4,
                                    paddingVertical: 4,
                                    borderRadius: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    marginBottom: 8,
                                }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            lightFeedback();
                                            openFilterModal();
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Ionicons name="filter" size={10} color={accentColor} />
                                        <Text style={{ color: accentColor, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>
                                            {[
                                                activeFilter !== 'all' && (activeFilter === 'goals_only' ? 'Goals' : 'Habits'),
                                                selectedGoalFilter && goals.find(g => g.id === selectedGoalFilter)?.name?.slice(0, 12),
                                                selectedCategoryFilter && selectedCategoryFilter.charAt(0).toUpperCase() + selectedCategoryFilter.slice(1),
                                                activeTimeFilter !== 'all' && activeTimeFilter.charAt(0).toUpperCase() + activeTimeFilter.slice(1),
                                                activeSort !== 'default' && (activeSort === 'name' ? 'A-Z' : 'Progress'),
                                            ].filter(Boolean).join(' • ') || 'Filtered'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            lightFeedback();
                                            resetFilters();
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={14} color={accentColor} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* SHARED ITEMS SECTION */}
                            {(sharedHabits.length > 0 || sharedGoals.length > 0) && !hasActiveFilters && activeFilter === 'all' && (
                                <View style={{ marginBottom: 24 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'Lexend_400Regular', letterSpacing: 2 }}>
                                            SHARED WITH YOU
                                        </Text>
                                    </View>

                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            {/* Shared Habits */}
                                            {sharedHabits.map((item, index) => (
                                                <VoidCard key={`sh-${index}`} glass={!theme.includes('trueDark')} intensity={30} style={{ width: 220, padding: 12, marginRight: 0 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                                            <Text style={{ fontSize: 16 }}>{item.habit.icon || '📝'}</Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', fontFamily: 'Lexend' }} numberOfLines={1}>{item.habit.name}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                                {item.owner.avatarUrl ? (
                                                                    <Image source={{ uri: item.owner.avatarUrl }} style={{ width: 14, height: 14, borderRadius: 7, marginRight: 4 }} />
                                                                ) : (
                                                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, marginRight: 4, alignItems: 'center', justifyContent: 'center' }}>
                                                                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>{item.owner.username.charAt(0).toUpperCase()}</Text>
                                                                    </View>
                                                                )}
                                                                <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{item.owner.username}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={{ backgroundColor: accentColor, borderRadius: 8, paddingVertical: 6, alignItems: 'center', marginTop: 4 }}
                                                        onPress={() => {
                                                            lightFeedback();
                                                            Alert.alert(
                                                                'Add Habit',
                                                                `Add "${item.habit.name}" to your habits?`,
                                                                [
                                                                    { text: 'Cancel', style: 'cancel' },
                                                                    {
                                                                        text: 'Add',
                                                                        onPress: async () => {
                                                                            const newHabit = await addHabit({
                                                                                name: item.habit.name,
                                                                                icon: item.habit.icon,
                                                                                category: item.habit.category,
                                                                                taskDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                                                                            });
                                                                            if (newHabit) {
                                                                                Alert.alert('Success', 'Habit added!');
                                                                                // Refresh shared list to remove added one? Or just keep it?
                                                                                // Ideally we should call API to accept/remove from pending view.
                                                                                setSharedHabits(prev => prev.filter(h => h.habit.id !== item.habit.id));
                                                                            }
                                                                        }
                                                                    }
                                                                ]
                                                            );
                                                        }}
                                                    >
                                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Add to list</Text>
                                                    </TouchableOpacity>
                                                </VoidCard>
                                            ))}

                                            {/* Shared Goals */}
                                            {sharedGoals.map((item, index) => (
                                                <VoidCard key={`sg-${index}`} glass={!theme.includes('trueDark')} intensity={30} style={{ width: 220, padding: 12, marginRight: 0 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                                            <Text style={{ fontSize: 16 }}>{item.goal.icon || '🎯'}</Text>
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', fontFamily: 'Lexend' }} numberOfLines={1}>{item.goal.name}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                                {item.owner.avatarUrl ? (
                                                                    <Image source={{ uri: item.owner.avatarUrl }} style={{ width: 14, height: 14, borderRadius: 7, marginRight: 4 }} />
                                                                ) : (
                                                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, marginRight: 4, alignItems: 'center', justifyContent: 'center' }}>
                                                                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>{item.owner.username.charAt(0).toUpperCase()}</Text>
                                                                    </View>
                                                                )}
                                                                <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{item.owner.username}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, alignItems: 'center', marginTop: 4 }}
                                                        onPress={() => {
                                                            lightFeedback();
                                                            router.push({
                                                                pathname: '/goal-detail',
                                                                params: { goalId: item.goal.id }
                                                            });
                                                        }}
                                                    >
                                                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>View Goal</Text>
                                                    </TouchableOpacity>
                                                </VoidCard>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>
                            )}

                            {/* GOALS SECTION */}
                            {!isHabitFilter && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'Lexend_400Regular', letterSpacing: 2, marginBottom: 10 }}>
                                        GOALS
                                    </Text>

                                    {sortedGoals.length > 0 ? (
                                        sortedGoals.map(goal => {
                                            const linkedHabits = habitsByGoal[goal.id] || [];
                                            const isExpanded = expandedGoals[goal.id];

                                            // Progress Calculation - USE STRICT PROGRESS
                                            const progress = goalProgress[goal.id] || 0;

                                            return (
                                                    <View key={goal.id} style={{ marginBottom: 16 }}>
                                                    <View ref={(ref) => { goalRefs.current[goal.id] = ref; }}>
                                                    {/* Goal Header / Card */}
                                                    <View style={{ position: 'relative' }}>
                                                        <GoalCard
                                                            goal={{ ...goal, color: accentColor }}
                                                            progress={progress}
                                                            size={cardSize}
                                                            isExpanded={!!isExpanded}
                                                            linkedHabitsCount={linkedHabits.length}
                                                            isDropTarget={hoveredGoalId === goal.id}
                                                            onToggleExpand={() => toggleGoalExpansion(goal.id)}
                                                            onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                                                        />
                                                    </View>

                                                    {/* Linked Habits Accordion */}
                                                    {isExpanded && (
                                                        <View style={{
                                                            marginTop: 8,
                                                            marginLeft: 16,
                                                            paddingLeft: 16,
                                                            borderLeftWidth: 2,
                                                            borderLeftColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
                                                        }}>
                                                            {linkedHabits.length > 0 ? (
                                                                linkedHabits.map(habit => (
                                                                    <SwipeableHabitItem
                                                                        key={habit.id}
                                                                        habit={habit}
                                                                        size={cardSize}
                                                                        completed={!!completions[habit.id]}
                                                                        isDragging={draggingHabit?.id === habit.id}
                                                                        isActive={habit.id === activeHabitId}
                                                                        timeLeft={habit.id === activeHabitId ? timeLeft : undefined}
                                                                        totalDuration={habit.id === activeHabitId ? totalDuration : undefined}
                                                                        routineName={getRoutineMeta(habit.id)?.name}
                                                                        routineEmoji={getRoutineMeta(habit.id)?.emoji}
                                                                        canFocusNow={isHabitFocusableNow(habit)}
                                                                        onFocusPress={handleFocusHabit}
                                                                        onDragStart={handleHabitDragStart}
                                                                        onDragMove={handleHabitDragMove}
                                                                        onDragEnd={handleHabitDragEnd}
                                                                        onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } })}
                                                                        onToggle={() => handleHabitPress(habit)}
                                                                        onEdit={handleEdit}
                                                                        onDelete={handleDelete}
                                                                    />
                                                                ))
                                                            ) : (
                                                                <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', paddingVertical: 8 }}>
                                                                    No linked habits yet.
                                                                </Text>
                                                            )}
                                                        </View>
                                                    )}
                                                    </View>
                                                </View>
                                            );
                                        })
                                    ) : (
                                        <VoidCard style={{ alignItems: 'center', justifyContent: 'center', padding: 24, borderStyle: 'dashed' }}>
                                            <Text style={{ color: colors.textTertiary, fontFamily: 'Lexend_400Regular' }}>NO ACTIVE GOALS</Text>
                                        </VoidCard>
                                    )}
                                </View>
                            )}

                            {/* HABITS SECTION */}
                            {!isGoalFilter && (activeFilter === 'all' ? looseHabits : allHabits).length > 0 && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: 'Lexend_400Regular', letterSpacing: 2, marginBottom: 10 }}>
                                        {activeFilter === 'all' ? 'OTHER HABITS' : 'ALL HABITS'}
                                    </Text>

                                    {(activeFilter === 'all' ? looseHabits : allHabits).map(habit => {
                                        // Find associated goal name for habit
                                        const associatedGoal = goals.find(g => g.id === habit.goalId);
                                        return (
                                            <SwipeableHabitItem
                                                key={habit.id}
                                                habit={habit}
                                                completed={!!completions[habit.id]}
                                                isDragging={draggingHabit?.id === habit.id}
                                                isActive={habit.id === activeHabitId}
                                                timeLeft={habit.id === activeHabitId ? timeLeft : undefined}
                                                totalDuration={habit.id === activeHabitId ? totalDuration : undefined}
                                                routineName={getRoutineMeta(habit.id)?.name}
                                                routineEmoji={getRoutineMeta(habit.id)?.emoji}
                                                canFocusNow={isHabitFocusableNow(habit)}
                                                onFocusPress={handleFocusHabit}
                                                goalName={activeFilter === 'habits_only' && associatedGoal ? associatedGoal.name : undefined}
                                                onDragStart={handleHabitDragStart}
                                                onDragMove={handleHabitDragMove}
                                                onDragEnd={handleHabitDragEnd}
                                                onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } })}
                                                onToggle={(h) => {
                                                    // Use local date format, not UTC
                                                    const today = new Date();
                                                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                                    const selectedStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

                                                    if (selectedStr !== todayStr) {
                                                        Alert.alert('Cannot Modify', 'You can only mark habits complete for today.');
                                                        return;
                                                    }

                                                    selectionFeedback();
                                                    toggleCompletion(h.id, todayStr);
                                                    setCompletions(prev => ({ ...prev, [h.id]: !prev[h.id] }));
                                                }}
                                                onEdit={handleEdit}
                                                onDelete={(h) => { handleDelete(h); }}
                                                size={cardSize}
                                            />
                                        );
                                    })
                                    }
                                </View>
                            )}

                            {/* Habits section removed - all habits must be linked to goals */}

                        </Animated.ScrollView>

                        {draggingHabit ? (
                            <View pointerEvents="none" style={styles.dragOverlay}>
                                <View
                                    style={[
                                        styles.dragPreview,
                                        {
                                            top: dragPosition.y - 28,
                                            left: 20,
                                            right: 20,
                                            borderColor: hoveredGoalId ? accentColor : colors.border,
                                            backgroundColor: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(10,12,16,0.96)',
                                        },
                                    ]}
                                >
                                    <Ionicons name={(draggingHabit.icon as any) || 'ellipse-outline'} size={16} color={draggingHabit.color || accentColor} />
                                    <Text style={[styles.dragPreviewText, { color: colors.text }]} numberOfLines={1}>
                                        Move "{draggingHabit.name}" into {hoveredGoalId ? goals.find((goal) => goal.id === hoveredGoalId)?.name || 'goal' : 'a goal'}
                                    </Text>
                                </View>
                            </View>
                        ) : null}
                    </View>

                    <GoalCreationWizard
                        visible={isWizardVisible}
                        onClose={() => setIsWizardVisible(false)}
                        onSuccess={() => {/* refresh */ }}
                    />

                    {/* Filter Modal - Compact & Swipeable */}
                    {showFilter && (
                        <Modal
                            visible={true}
                            transparent
                            animationType="none"
                            onRequestClose={closeFilterModal}
                            statusBarTranslucent
                        >
                            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }, filterBackdropStyle]}>
                                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeFilterModal} />
                                </Animated.View>

                                <GestureDetector gesture={filterPanGesture}>
                                    <Animated.View style={[{
                                        height: FILTER_SHEET_HEIGHT,
                                        borderTopLeftRadius: 24,
                                        borderTopRightRadius: 24,
                                        overflow: 'hidden',
                                        backgroundColor: isLight ? '#ffffff' : '#0a0c10',
                                    }, filterSheetStyle]}>

                                        {/* Handle Bar */}
                                        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)' }} />
                                        </View>

                                        <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flex: 1, paddingRight: 12 }}>
                                                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', fontFamily: 'Lexend' }}>Shape Your Roadmap</Text>
                                                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, fontFamily: 'Lexend_400Regular' }}>
                                                        {visibleHabitCount} habit{visibleHabitCount === 1 ? '' : 's'}{activeFilter !== 'habits_only' ? ` • ${visibleGoalCount} goal${visibleGoalCount === 1 ? '' : 's'}` : ''}
                                                    </Text>
                                                </View>
                                                {activeFilterCount > 0 && (
                                                    <TouchableOpacity
                                                        onPress={resetFilters}
                                                        style={{
                                                            paddingHorizontal: 12,
                                                            paddingVertical: 8,
                                                            borderRadius: 14,
                                                            backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'
                                                        }}
                                                    >
                                                        <Text style={{ color: accentColor, fontSize: 12, fontWeight: '700', fontFamily: 'Lexend_500Medium' }}>Clear</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                                                <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: accentColor + '18' }}>
                                                    <Text style={{ color: accentColor, fontSize: 11, fontFamily: 'Lexend_500Medium' }}>
                                                        {activeFilter === 'all' ? 'Everything' : activeFilter === 'goals_only' ? 'Goals only' : 'Habits only'}
                                                    </Text>
                                                </View>
                                                {activeGoalName && (
                                                    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}>
                                                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Lexend_500Medium' }} numberOfLines={1}>
                                                            Goal: {activeGoalName}
                                                        </Text>
                                                    </View>
                                                )}
                                                {activeTimeFilter !== 'all' && (
                                                    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}>
                                                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Lexend_500Medium' }}>
                                                            {activeTimeFilter.charAt(0).toUpperCase() + activeTimeFilter.slice(1)}
                                                        </Text>
                                                    </View>
                                                )}
                                                {activeSort !== 'default' && (
                                                    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}>
                                                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: 'Lexend_500Medium' }}>
                                                            Sort: {activeSort === 'name' ? 'A-Z' : 'Momentum'}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>

                                            <View style={{ marginBottom: 18 }}>
                                                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 }}>SHOW</Text>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {[
                                                        { id: 'all', label: 'Everything', icon: 'layers-outline', hint: 'Goals and habits together' },
                                                        { id: 'goals_only', label: 'Goals', icon: 'flag-outline', hint: 'Outcome-first view' },
                                                        { id: 'habits_only', label: 'Habits', icon: 'checkbox-outline', hint: 'Execution-only view' },
                                                    ].map((item) => (
                                                        <TouchableOpacity
                                                            key={item.id}
                                                            onPress={() => { selectionFeedback(); setActiveFilter(item.id as FilterType); }}
                                                            style={{
                                                                flex: 1,
                                                                paddingVertical: 14,
                                                                paddingHorizontal: 12,
                                                                borderRadius: 18,
                                                                backgroundColor: activeFilter === item.id ? accentColor : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'),
                                                            }}
                                                        >
                                                            <Ionicons name={item.icon as any} size={16} color={activeFilter === item.id ? 'white' : colors.textSecondary} />
                                                            <Text style={{ color: activeFilter === item.id ? 'white' : colors.text, fontSize: 13, fontWeight: '700', marginTop: 8, fontFamily: 'Lexend_500Medium' }}>{item.label}</Text>
                                                            <Text style={{ color: activeFilter === item.id ? 'rgba(255,255,255,0.78)' : colors.textTertiary, fontSize: 10, marginTop: 4, fontFamily: 'Lexend_400Regular' }}>{item.hint}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            <View style={{ marginBottom: 18 }}>
                                                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 }}>FOCUS</Text>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {[
                                                        { id: 'all', label: 'Any time', icon: 'sparkles-outline' },
                                                        { id: 'morning', label: 'Morning', icon: 'sunny-outline' },
                                                        { id: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline' },
                                                        { id: 'evening', label: 'Evening', icon: 'moon-outline' },
                                                    ].map((time) => (
                                                        <TouchableOpacity
                                                            key={time.id}
                                                            onPress={() => { selectionFeedback(); setActiveTimeFilter(time.id as TimeFilter); }}
                                                            style={{
                                                                flex: 1,
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                paddingVertical: 12,
                                                                borderRadius: 16,
                                                                backgroundColor: activeTimeFilter === time.id ? accentColor : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'),
                                                            }}
                                                        >
                                                            <Ionicons name={time.icon as any} size={18} color={activeTimeFilter === time.id ? 'white' : colors.textSecondary} />
                                                            <Text style={{ color: activeTimeFilter === time.id ? 'white' : colors.textSecondary, fontSize: 11, marginTop: 6, fontFamily: 'Lexend_500Medium' }}>{time.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            {goals.length > 0 && (
                                                <View style={{ marginBottom: 18 }}>
                                                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, marginBottom: 10, marginLeft: 2 }}>GOAL</Text>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                                            <TouchableOpacity
                                                                onPress={() => { selectionFeedback(); setSelectedGoalFilter(null); }}
                                                                style={{
                                                                    paddingHorizontal: 14,
                                                                    paddingVertical: 10,
                                                                    borderRadius: 18,
                                                                    backgroundColor: selectedGoalFilter === null ? accentColor : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'),
                                                                }}
                                                            >
                                                                <Text style={{ color: selectedGoalFilter === null ? 'white' : colors.textSecondary, fontSize: 12, fontWeight: '600', fontFamily: 'Lexend_500Medium' }}>All goals</Text>
                                                            </TouchableOpacity>
                                                            {goals.map((goal) => (
                                                                <TouchableOpacity
                                                                    key={goal.id}
                                                                    onPress={() => { selectionFeedback(); setSelectedGoalFilter(selectedGoalFilter === goal.id ? null : goal.id); }}
                                                                    style={{
                                                                        flexDirection: 'row',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                        paddingHorizontal: 14,
                                                                        paddingVertical: 10,
                                                                        borderRadius: 18,
                                                                        backgroundColor: selectedGoalFilter === goal.id ? (goal.color || accentColor) : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'),
                                                                    }}
                                                                >
                                                                    <Ionicons name={(goal.icon as any) || 'flag-outline'} size={13} color={selectedGoalFilter === goal.id ? 'white' : colors.textSecondary} />
                                                                    <Text style={{ color: selectedGoalFilter === goal.id ? 'white' : colors.textSecondary, fontSize: 12, fontWeight: '600', fontFamily: 'Lexend_500Medium' }} numberOfLines={1}>
                                                                        {goal.name.length > 14 ? `${goal.name.slice(0, 14)}…` : goal.name}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </ScrollView>
                                                </View>
                                            )}

                                            <View style={{ marginBottom: 18 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginLeft: 2 }}>
                                                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '600', letterSpacing: 1.2 }}>ORDER</Text>
                                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                                        <TouchableOpacity onPress={() => { selectionFeedback(); const all: Record<string, boolean> = {}; goals.forEach(g => all[g.id] = true); setExpandedGoals(all); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                            <Ionicons name="chevron-expand-outline" size={16} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => { selectionFeedback(); setExpandedGoals({}); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                            <Ionicons name="contract-outline" size={16} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {[
                                                        { id: 'default', label: 'Natural', icon: 'layers-outline' },
                                                        { id: 'name', label: 'A-Z', icon: 'text-outline' },
                                                        { id: 'progress', label: 'Momentum', icon: 'trending-up-outline' },
                                                    ].map((item) => (
                                                        <TouchableOpacity
                                                            key={item.id}
                                                            onPress={() => { selectionFeedback(); setActiveSort(item.id as SortType); }}
                                                            style={{
                                                                flex: 1,
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 6,
                                                                paddingVertical: 12,
                                                                borderRadius: 16,
                                                                backgroundColor: activeSort === item.id ? accentColor : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'),
                                                            }}
                                                        >
                                                            <Ionicons name={item.icon as any} size={14} color={activeSort === item.id ? 'white' : colors.textSecondary} />
                                                            <Text style={{ color: activeSort === item.id ? 'white' : colors.textSecondary, fontSize: 12, fontWeight: '700', fontFamily: 'Lexend_500Medium' }}>{item.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            <TouchableOpacity
                                                onPress={closeFilterModal}
                                                style={{
                                                    marginTop: 8,
                                                    backgroundColor: accentColor,
                                                    borderRadius: 18,
                                                    paddingVertical: 15,
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Lexend_500Medium' }}>
                                                    See My Roadmap
                                                </Text>
                                            </TouchableOpacity>

                                        </ScrollView>
                                    </Animated.View>
                                </GestureDetector>
                            </View>
                        </Modal>
                    )}
                </View>
            </SafeAreaView>


        </VoidShell>
    );
};

const styles = StyleSheet.create({
    dragOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 30,
    },
    dragPreview: {
        position: 'absolute',
        minHeight: 56,
        borderRadius: 18,
        borderWidth: 1.5,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    dragPreviewText: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Lexend_500Medium',
    },
    filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12
    },
    filterText: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular'
    },
    sortChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(128,128,128,0.2)',
        backgroundColor: 'rgba(128,128,128,0.05)',
    },
    sortText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(128,128,128,0.7)',
        fontFamily: 'Lexend_400Regular'
    }
});

export default CalendarScreen;
