import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, LayoutAnimation, Platform, UIManager, InteractionManager, DeviceEventEmitter, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    SlideInDown,
    SlideOutDown,
    runOnJS,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { GoalCard } from '@/components/Home/GoalCard';
import { GoalCreationWizard } from '@/components/GoalCreationWizard';
import { ShareHabitModal } from '@/components/ShareHabitModal';
import { subscribeToHabits, getCompletions, toggleCompletion, removeHabitEverywhere, calculateGoalProgress, calculateGoalProgressInstant, getLastNDaysCompletions, isHabitScheduledForDate, Habit as StoreHabit } from '@/lib/habitsSQLite';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
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

    // Data State
    const [habitsStore, setHabitsStore] = useState<StoreHabit[]>([]);
    // habits state removed - usage replaced by memoized derivation
    const [completions, setCompletions] = useState<Record<string, boolean>>({});
    const [todayCompletions, setTodayCompletions] = useState<Record<string, boolean>>({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [goalProgress, setGoalProgress] = useState<Record<string, number>>({});

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
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [habitToShare, setHabitToShare] = useState<Habit | null>(null);
    const [historyData, setHistoryData] = useState<{ date: string; completedIds: string[] }[]>([]);

    // Pull-to-Filter Logic
    const scrollY = useSharedValue(0);
    const filterTriggered = useSharedValue(false);
    const wasAtTop = useSharedValue(true); // Track if user was at top before pulling

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
                runOnJS(setShowFilter)(true);
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
        router.push({
            pathname: '/create',
            params: {
                id: habit.id,
                name: habit.name,
                category: habit.category,
                icon: habit.icon,
                duration: habit.durationMinutes ? String(habit.durationMinutes) : '',
                startAt: habit.startTime,
                endAt: habit.endTime,
                isGoal: habit.isGoal ? 'true' : 'false',
                targetDate: habit.targetDate
            }
        });
    };

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

        const byGoal: Record<string, Habit[]> = {};

        filtered.forEach(h => {
            if (h.goalId) {
                if (!byGoal[h.goalId]) byGoal[h.goalId] = [];
                byGoal[h.goalId].push(h);
            }
        });

        return { allHabits: filtered, habitsByGoal: byGoal };
    }, [habitsStore, selectedDate, selectedGoalFilter, selectedCategoryFilter]);

    // Loose habits are those not linked to any goal, or linked to a non-existent goal
    const looseHabits = useMemo(() => {
        return allHabits.filter(h => !h.goalId || !goals.some(g => g.id === h.goalId));
    }, [allHabits, goals]);

    const isGoalFilter = activeFilter === 'goals_only';
    const isHabitFilter = activeFilter === 'habits_only';
    const hasActiveFilters = selectedGoalFilter !== null || selectedCategoryFilter !== null;

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
                        />
                    </View>

                    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                        <Animated.ScrollView
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: 40 }}
                            showsVerticalScrollIndicator={false}
                            bounces={true}
                            alwaysBounceVertical={true}
                            style={{ backgroundColor: 'transparent' }}
                        >
                            {/* Pull-to-Filter Hint */}
                            <View style={{ alignItems: 'center', marginTop: -20, marginBottom: 16 }}>
                                {/* Pull hint removed for cleaner UI */}
                            </View>

                            {/* Filter Indicator - Subtle compact pill */}
                            {(activeFilter !== 'all' || hasActiveFilters || activeTimeFilter !== 'all') && (
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
                                            setShowFilter(true);
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
                                            ].filter(Boolean).join(' • ') || 'Filtered'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            lightFeedback();
                                            // Clear all filters
                                            setActiveFilter('all');
                                            setSelectedGoalFilter(null);
                                            setSelectedCategoryFilter(null);
                                            setActiveTimeFilter('all');
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={14} color={accentColor} />
                                    </TouchableOpacity>
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
                                            // Filter linked habits by time category if active
                                            const allLinkedHabits = habitsByGoal[goal.id] || [];
                                            const linkedHabits = activeTimeFilter === 'all'
                                                ? allLinkedHabits
                                                : allLinkedHabits.filter(h => getTimeCategory(h.startTime) === activeTimeFilter || getTimeCategory(h.startTime) === 'all');
                                            const isExpanded = expandedGoals[goal.id];

                                            // Progress Calculation - USE STRICT PROGRESS
                                            const progress = goalProgress[goal.id] || 0;

                                            return (
                                                <View key={goal.id} style={{ marginBottom: 16 }}>
                                                    {/* Goal Header / Card */}
                                                    <View style={{ position: 'relative' }}>
                                                        <GoalCard
                                                            goal={{ ...goal, color: accentColor }}
                                                            progress={progress}
                                                            size={cardSize}
                                                            isExpanded={!!isExpanded}
                                                            linkedHabitsCount={linkedHabits.length}
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
                                                                        onPress={() => handleHabitPress(habit)}
                                                                        onEdit={handleEdit}
                                                                        onDelete={handleDelete}
                                                                        onShare={(h) => { setHabitToShare(h); setShareModalVisible(true); }}
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

                                    {(activeFilter === 'all' ? looseHabits : allHabits).map(habit => (
                                        <SwipeableHabitItem
                                            key={habit.id}
                                            habit={habit}
                                            completed={!!completions[habit.id]}
                                            onPress={(h) => {
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
                                            onEdit={(h) => router.push({ pathname: '/create', params: { id: h.id } })}
                                            onDelete={(h) => { handleDelete(h); }}
                                            onShare={(h) => { setHabitToShare(h); setShareModalVisible(true); }}
                                            size={cardSize}
                                        />
                                    ))
                                    }
                                </View>
                            )}

                            {/* Habits section removed - all habits must be linked to goals */}

                        </Animated.ScrollView>
                    </View>

                    <GoalCreationWizard
                        visible={isWizardVisible}
                        onClose={() => setIsWizardVisible(false)}
                        onSuccess={() => {/* refresh */ }}
                    />

                    {/* Filter Modal - Redesigned */}
                    {showFilter && (
                        <Modal
                            visible={true}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setShowFilter(false)}
                            statusBarTranslucent
                        >
                            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                                <TouchableOpacity
                                    style={StyleSheet.absoluteFill}
                                    activeOpacity={1}
                                    onPress={() => setShowFilter(false)}
                                />

                                <Animated.View
                                    entering={SlideInDown.springify().damping(18).stiffness(120)}
                                    exiting={SlideOutDown.duration(200)}
                                    style={{
                                        borderTopLeftRadius: 24,
                                        borderTopRightRadius: 24,
                                        overflow: 'hidden',
                                        backgroundColor: isLight ? '#ffffff' : '#0a0c10',
                                        maxHeight: '75%'
                                    }}>

                                    {/* Handle Bar - Swipe Down to Close */}
                                    <TouchableOpacity
                                        onPress={() => setShowFilter(false)}
                                        style={{ alignItems: 'center', paddingVertical: 16 }}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                                    </TouchableOpacity>

                                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                                        <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>

                                            {/* Section 1: View Type */}
                                            <View style={{ marginBottom: 24 }}>
                                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>VIEW</Text>
                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden' }}>
                                                    {[
                                                        { id: 'all', label: 'All Items', icon: 'layers-outline', desc: 'Goals and habits' },
                                                        { id: 'goals_only', label: 'Goals Only', icon: 'flag-outline', desc: 'Focus on goals' },
                                                        { id: 'habits_only', label: 'Habits Only', icon: 'checkbox-outline', desc: 'Focus on habits' },
                                                    ].map((item, i, arr) => (
                                                        <TouchableOpacity
                                                            key={item.id}
                                                            onPress={() => { selectionFeedback(); setActiveFilter(item.id as FilterType); }}
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                padding: 16,
                                                                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                                                                borderBottomColor: 'rgba(255,255,255,0.05)',
                                                            }}
                                                        >
                                                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: activeFilter === item.id ? accentColor + '20' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                                                <Ionicons name={item.icon as any} size={18} color={activeFilter === item.id ? accentColor : 'rgba(255,255,255,0.5)'} />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>{item.label}</Text>
                                                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{item.desc}</Text>
                                                            </View>
                                                            {activeFilter === item.id && <Ionicons name="checkmark-circle" size={22} color={accentColor} />}
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            {/* Section 2: Sort & Quick Actions */}
                                            <View style={{ marginBottom: 24 }}>
                                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>SORT & ACTIONS</Text>
                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden' }}>
                                                    {[
                                                        { id: 'default', label: 'Default Order', icon: 'list-outline' },
                                                        { id: 'name', label: 'Alphabetical', icon: 'text-outline' },
                                                        { id: 'progress', label: 'By Progress', icon: 'trending-up-outline' },
                                                    ].map((item, i, arr) => (
                                                        <TouchableOpacity
                                                            key={item.id}
                                                            onPress={() => { selectionFeedback(); setActiveSort(item.id as SortType); }}
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                padding: 16,
                                                                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                                                                borderBottomColor: 'rgba(255,255,255,0.05)',
                                                            }}
                                                        >
                                                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: activeSort === item.id ? accentColor + '20' : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                                                <Ionicons name={item.icon as any} size={18} color={activeSort === item.id ? accentColor : 'rgba(255,255,255,0.5)'} />
                                                            </View>
                                                            <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' }}>{item.label}</Text>
                                                            {activeSort === item.id && <Ionicons name="checkmark-circle" size={22} color={accentColor} />}
                                                        </TouchableOpacity>
                                                    ))}
                                                    {/* Divider */}
                                                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 }} />
                                                    {/* Expand/Collapse */}
                                                    <TouchableOpacity
                                                        onPress={() => { selectionFeedback(); const all: Record<string, boolean> = {}; goals.forEach(g => all[g.id] = true); setExpandedGoals(all); }}
                                                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}
                                                    >
                                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                                            <Ionicons name="chevron-down-circle-outline" size={18} color="rgba(255,255,255,0.5)" />
                                                        </View>
                                                        <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' }}>Expand All Goals</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => { selectionFeedback(); setExpandedGoals({}); }}
                                                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
                                                    >
                                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                                            <Ionicons name="chevron-up-circle-outline" size={18} color="rgba(255,255,255,0.5)" />
                                                        </View>
                                                        <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' }}>Collapse All Goals</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Section 3: Time of Day */}
                                            <View style={{ marginBottom: 24 }}>
                                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>TIME OF DAY</Text>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {[
                                                        { id: 'all', label: 'All', icon: 'time-outline' },
                                                        { id: 'morning', label: 'AM', icon: 'sunny-outline' },
                                                        { id: 'afternoon', label: 'PM', icon: 'partly-sunny-outline' },
                                                        { id: 'evening', label: 'Night', icon: 'moon-outline' },
                                                    ].map((time) => (
                                                        <TouchableOpacity
                                                            key={time.id}
                                                            onPress={() => { selectionFeedback(); setActiveTimeFilter(time.id as TimeFilter); }}
                                                            style={{
                                                                flex: 1,
                                                                alignItems: 'center',
                                                                paddingVertical: 12,
                                                                borderRadius: 12,
                                                                backgroundColor: activeTimeFilter === time.id ? accentColor : 'rgba(255,255,255,0.03)',
                                                            }}
                                                        >
                                                            <Ionicons name={time.icon as any} size={20} color={activeTimeFilter === time.id ? 'white' : 'rgba(255,255,255,0.5)'} />
                                                            <Text style={{ color: activeTimeFilter === time.id ? 'white' : 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, fontWeight: '500' }}>{time.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                            {/* Section 4: Filter by Goal (Chips) */}
                                            {goals.length > 0 && (
                                                <View style={{ marginBottom: 24 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginLeft: 4 }}>
                                                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>BY GOAL</Text>
                                                        {selectedGoalFilter && (
                                                            <TouchableOpacity onPress={() => { selectionFeedback(); setSelectedGoalFilter(null); }}>
                                                                <Text style={{ color: accentColor, fontSize: 12, fontWeight: '600' }}>Clear</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                                            <TouchableOpacity
                                                                onPress={() => { selectionFeedback(); setSelectedGoalFilter(null); }}
                                                                style={{
                                                                    paddingHorizontal: 14,
                                                                    paddingVertical: 8,
                                                                    borderRadius: 20,
                                                                    backgroundColor: selectedGoalFilter === null ? accentColor : 'rgba(255,255,255,0.05)',
                                                                }}
                                                            >
                                                                <Text style={{ color: selectedGoalFilter === null ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' }}>All</Text>
                                                            </TouchableOpacity>
                                                            {goals.map((goal) => (
                                                                <TouchableOpacity
                                                                    key={goal.id}
                                                                    onPress={() => { selectionFeedback(); setSelectedGoalFilter(goal.id); }}
                                                                    style={{
                                                                        flexDirection: 'row',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                        paddingHorizontal: 14,
                                                                        paddingVertical: 8,
                                                                        borderRadius: 20,
                                                                        backgroundColor: selectedGoalFilter === goal.id ? (goal.color || accentColor) : 'rgba(255,255,255,0.05)',
                                                                    }}
                                                                >
                                                                    <Ionicons name={(goal.icon as any) || 'flag'} size={14} color={selectedGoalFilter === goal.id ? 'white' : 'rgba(255,255,255,0.5)'} />
                                                                    <Text style={{ color: selectedGoalFilter === goal.id ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{goal.name}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </ScrollView>
                                                </View>
                                            )}

                                            {/* Section 5: Life Pillars (Chips) */}
                                            <View>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginLeft: 4 }}>
                                                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>LIFE AREA</Text>
                                                    {selectedCategoryFilter && (
                                                        <TouchableOpacity onPress={() => { selectionFeedback(); setSelectedCategoryFilter(null); }}>
                                                            <Text style={{ color: accentColor, fontSize: 12, fontWeight: '600' }}>Clear</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                    {[
                                                        { id: null, label: 'All', icon: 'apps-outline', color: accentColor },
                                                        { id: 'body', label: 'Body', icon: 'body-outline', color: '#22C55E' },
                                                        { id: 'wealth', label: 'Wealth', icon: 'wallet-outline', color: '#F59E0B' },
                                                        { id: 'heart', label: 'Heart', icon: 'heart-outline', color: '#EF4444' },
                                                        { id: 'mind', label: 'Mind', icon: 'bulb-outline', color: '#3B82F6' },
                                                        { id: 'soul', label: 'Soul', icon: 'sparkles-outline', color: '#A855F7' },
                                                        { id: 'play', label: 'Play', icon: 'game-controller-outline', color: '#EC4899' },
                                                    ].map((pillar) => (
                                                        <TouchableOpacity
                                                            key={pillar.id || 'all'}
                                                            onPress={() => { selectionFeedback(); setSelectedCategoryFilter(pillar.id); }}
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 8,
                                                                borderRadius: 20,
                                                                backgroundColor: selectedCategoryFilter === pillar.id ? pillar.color : 'rgba(255,255,255,0.05)',
                                                            }}
                                                        >
                                                            <Ionicons name={pillar.icon as any} size={14} color={selectedCategoryFilter === pillar.id ? 'white' : pillar.color} />
                                                            <Text style={{ color: selectedCategoryFilter === pillar.id ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' }}>{pillar.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>

                                        </View>
                                    </ScrollView>
                                </Animated.View>
                            </View>
                        </Modal>
                    )}
                </View>
            </SafeAreaView>

            {/* Share Habit Modal */}
            {habitToShare && (
                <ShareHabitModal
                    visible={shareModalVisible}
                    habitId={habitToShare.id}
                    habitName={habitToShare.name}
                    onClose={() => { setShareModalVisible(false); setHabitToShare(null); }}
                />
            )}
        </VoidShell>
    );
};

const styles = StyleSheet.create({
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
