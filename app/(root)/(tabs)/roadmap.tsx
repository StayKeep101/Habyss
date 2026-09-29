import { FontFamily } from '@/constants/DesignSystem';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager, DeviceEventEmitter, ScrollView, Image } from 'react-native';
import { afterPaint } from '@/lib/afterPaint';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle, runOnJS, withSpring, withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { useSharedItems } from '@/hooks/useSharedItems';
import { GoalCard } from '@/components/Home/GoalCard';
import { TaskItem, TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { getTasks, setTaskStatus, updateTask, deleteTask as removeTask, tasksForDay, todayKey, type Task } from '@/lib/tasks';

import { getSkipped, setSkipped as setSkippedHabit, subscribeToHabits, getCompletions, toggleCompletion, removeHabitEverywhere, calculateGoalProgressInstant, isHabitScheduledForDate, addHabit, updateHabit, Habit as StoreHabit } from '@/lib/habitsSQLite';
import { FriendsService } from '@/lib/friendsService';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useHistory } from '@/hooks/useHistory';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useFocusTime } from '@/constants/FocusTimeContext';
import { RoadmapFilters, type FilterAnchor } from '@/components/Home/RoadmapFilters';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';

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
    const { lightFeedback, selectionFeedback, successFeedback } = useHaptics();
    const { cardSize } = useAppSettings();
    const { activeHabitId, activeHabitName, isRunning: isFocusRunning, startTimer, timeLeft, totalDuration } = useFocusTime();
    const { horizontalPadding, tabBarClearance, isCompactHeight } = useResponsiveLayout();

    // Data State
    const [habitsStore, setHabitsStore] = useState<StoreHabit[]>([]);
    // habits state removed - usage replaced by memoized derivation
    const [completions, setCompletions] = useState<Record<string, boolean>>({});

    /**
     * Who else is on each habit on screen, in one query for the whole list.
     *
     * A shared habit is not done until everyone on it is done, so every row
     * needs to know — but thirty rows asking separately is thirty requests and
     * thirty re-renders while somebody is trying to scroll.
     */
    const habitIds = useMemo(
        () => habitsStore.filter(habit => !habit.isGoal && !habit.isArchived).map(habit => habit.id),
        [habitsStore],
    );
    const { stateFor: sharedFor } = useSharedItems(habitIds, completions);
    // Tasks live here too, so the roadmap is the whole plan rather than only rhythms.
    const [tasks, setTasks] = useState<Task[]>([]);
    const [todayCompletions, setTodayCompletions] = useState<Record<string, boolean>>({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [goalProgress, setGoalProgress] = useState<Record<string, number>>({});
    const [skipped, setSkipped] = useState<Record<string, boolean>>({});
    const [sharedHabits, setSharedHabits] = useState<any[]>([]);
    const [sharedGoals, setSharedGoals] = useState<any[]>([]);

    // UI State
    const [showFilter, setShowFilter] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [activeSort, setActiveSort] = useState<SortType>('default');
    const [sortDirection, setSortDirection] = useState<1 | -1>(-1);
    const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('all');
    const [selectedGoalFilter, setSelectedGoalFilter] = useState<string | null>(null); // Filter by specific goal ID
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null); // Filter by life pillar
    const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
    const [weeklyCompletions, setWeeklyCompletions] = useState<Record<string, { completed: number; total: number }>>({});
    // Loaded once here, and re-read whenever a habit is ticked anywhere —
    // this screen used to fetch on mount only and then quietly go stale.
    const { rows: historyData } = useHistory(90);
    const [draggingHabit, setDraggingHabit] = useState<Habit | null>(null);
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const dragY = useSharedValue(0);
    const dragX = useSharedValue(0);
    // 0 while resting, 1 once picked up: lifts, tilts and shrinks the card so it
    // reads as held above the list, the way a dragged file does.
    const dragLift = useSharedValue(0);
    const dragPreviewStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: dragY.get() - 34 },
            { translateX: (dragX.get() - 24) * 0.12 },
            { scale: 0.92 + dragLift.get() * 0.08 },
            { rotateZ: `${dragLift.get() * 1.6}deg` },
        ],
        opacity: dragLift.get(),
        shadowOpacity: 0.35 * dragLift.get(),
    }));
    const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
    // Mirrors hoveredGoalId so a drag can compare without re-subscribing to state.
    const hoveredGoalRef = useRef<string | null>(null);
    const goalRefs = useRef<Record<string, View | null>>({});
    const goalDropLayouts = useRef<Record<string, { x: number; y: number; width: number; height: number }>>({});

    // Pull-to-Filter Logic
    const scrollY = useSharedValue(0);
    const filterTriggered = useSharedValue(false);
    const wasAtTop = useSharedValue(true); // Track if user was at top before pulling

    const closeFilterModal = useCallback(() => setShowFilter(false), []);
    // The menu drops out of the button, so the button measures itself first.
    const filterButtonRef = useRef<any>(null);
    const [filterAnchor, setFilterAnchor] = useState<FilterAnchor | null>(null);
    const openFilterModal = useCallback(() => {
        filterButtonRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
            setFilterAnchor({ x, y, width, height });
            setShowFilter(true);
        });
        // Opened from a gesture with nothing to measure: still open, centred.
        if (!filterButtonRef.current) setShowFilter(true);
    }, []);

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
        const loadTasks = () => {
            getTasks({ includeDone: true }).then(setTasks).catch(() => setTasks([]));
        };
        loadTasks();
        const taskSub = on('tasks_changed', loadTasks);

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
            const [c, s] = await Promise.all([getCompletions(dateStr), getSkipped(dateStr)]);
            setCompletions(c);
            setSkipped(s);
        };
        loadCompletions();

        // Listen for updates from other screens (Home, Detail)
        const sub = on('habit_completion_updated', ({ habitId, date, completed }) => {
            const now = selectedDate;
            const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Nothing to patch when the change was a bulk one.
            if (!habitId || !date) return;

            // Update viewed completions if date matches
            if (date === currentDateStr) {
                setCompletions(prev => ({
                    ...prev,
                    [habitId]: completed === true
                }));
            }

            // Update todayCompletions if date matches today
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (date === todayStr) {
                setTodayCompletions(prev => ({
                    ...prev,
                    [habitId]: completed === true
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
        const goals = habitsStore.filter(h => h.isGoal && !h.isArchived);
        if (goals.length === 0) return;

        // Defer heavy calculation to after navigation animation
        const task = afterPaint(() => {
            const progressMap: Record<string, number> = {};
            goals.forEach(g => {
                // IMPORTANT: Pass todayCompletions, NOT current view completions
                progressMap[g.id] = calculateGoalProgressInstant(g, habitsStore, todayCompletions, historyMap, tasks);
            });
            setGoalProgress(progressMap);
        });
        return () => task.cancel();
    }, [habitsStore, todayCompletions, historyMap, tasks]);

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
            const task = afterPaint(() => {
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
            setTodayCompletions(prev => ({ ...prev, [habit.id]: !isCompleted }));
            Alert.alert('Could not save progress', 'Your check-in was not saved. Please try again.');
            console.error(e);
        });

        setTimeout(() => { isNavigating.current = false; }, 300);
    }, [selectedDate, completions, playComplete, selectionFeedback, lightFeedback]);

    // Standing down for today: recorded, so it is never counted as a miss.
    const handleHabitSkip = useCallback(async (habit: StoreHabit) => {
        const already = !!skipped[habit.id];
        selectionFeedback();
        setSkipped(prev => {
            const next = { ...prev };
            if (already) delete next[habit.id]; else next[habit.id] = true;
            return next;
        });
        const date = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        try { await setSkippedHabit(habit.id, !already, date); }
        catch {
            setSkipped(prev => ({ ...prev, [habit.id]: already }));
            Alert.alert('Could not save progress', 'This skip was not saved. Please try again.');
        }
    }, [skipped, selectedDate, selectionFeedback]);

    const handleTaskToggle = useCallback(async (task: Task) => {
        try {
            await setTaskStatus(task.id, task.status === 'done' ? 'open' : 'done');
            successFeedback();
            emit('tasks_changed');
        } catch { Alert.alert('Could not save task', 'Please try again.'); }
    }, [successFeedback]);

    // Pulling the row all the way across is already a deliberate act — asking
    // again afterwards only makes the gesture feel untrusted.
    const handleTaskDelete = useCallback(async (task: Task) => {
        try { await removeTask(task.id); emit('tasks_changed'); }
        catch { Alert.alert('Could not delete task', 'Your task is still saved. Please try again.'); }
    }, []);

    const openTask = useCallback((task: Task) => {
        emit('show_task_form', { task });
    }, []);

    const handleDelete = async (habit: Habit) => {
        // A habit goes on the gesture alone. A goal takes its whole plan with
        // it, which is more than one swipe should be allowed to decide.
        if (habit.isGoal) {
            Alert.alert('Delete goal', 'This removes the goal and everything planned under it.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void removeHabitEverywhere(habit.id) },
            ]);
            return;
        }
        try { await removeHabitEverywhere(habit.id); }
        catch { Alert.alert('Could not delete', 'Your habit is still saved. Please try again.'); }
    };

    const handleEdit = (habit: Habit) => {
        // Use global modal via DeviceEventEmitter
        emit('show_habit_modal', {
            goalId: habit.goalId,
            initialHabit: habit
        });
    };

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
        dragY.set(y);
        dragX.set(x);
        dragLift.set(withSpring(1, { damping: 16, stiffness: 220 }));
        const currentGoals = habitsStore.filter((item) => item.isGoal) as Habit[];
        await measureGoalDropTargets(currentGoals);
        const initial = getHoveredGoalAtPoint(x, y);
        hoveredGoalRef.current = initial;
        setHoveredGoalId(initial);
    }, [measureGoalDropTargets, getHoveredGoalAtPoint, selectionFeedback, habitsStore, dragX, dragY, dragLift]);

    const handleHabitDragMove = useCallback((habit: Habit, x: number, y: number) => {
        // dragY is a shared value, so the floating card follows the finger on the UI
        // thread. Only publish the hovered goal to React state when it actually
        // changes; setting it on every pointer move re-rendered every goal and habit
        // row for each frame of the drag.
        dragY.set(y);
        dragX.set(x);
        const next = getHoveredGoalAtPoint(x, y);
        if (next !== hoveredGoalRef.current) {
            hoveredGoalRef.current = next;
            setHoveredGoalId(next);
            // A tap of feedback the moment it is over a goal, so the drop is
            // felt rather than guessed at.
            if (next) selectionFeedback();
        }
    }, [getHoveredGoalAtPoint, selectionFeedback, dragX, dragY]);

    const handleHabitDragEnd = useCallback(async (habit: Habit, x: number, y: number) => {
        const targetGoalId = getHoveredGoalAtPoint(x, y);

        // The card settles back into the list instead of vanishing mid-air.
        dragLift.set(withTiming(0, { duration: 170 }));
        setDraggingHabit(null);
        hoveredGoalRef.current = null;
        setHoveredGoalId(null);

        if (!targetGoalId || targetGoalId === habit.goalId) {
            return;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setHabitsStore(items => items.map(item => item.id === habit.id ? { ...item, goalId: targetGoalId } : item));
        setExpandedGoals(prev => ({ ...prev, [targetGoalId]: true }));
        lightFeedback();
        try {
            await updateHabit({ id: habit.id, goalId: targetGoalId });
        } catch {
            setHabitsStore(items => items.map(item => item.id === habit.id ? { ...item, goalId: habit.goalId } : item));
            Alert.alert('Could not move habit', 'Your habit is still in its original goal. Please try again.');
        }
    }, [getHoveredGoalAtPoint, lightFeedback, dragLift]);

    /**
     * Tasks move between goals exactly like habits: hold one, drag it onto a
     * goal, let go. The drop targets and the floating preview are shared, so
     * both kinds of row behave the same.
     */
    const handleTaskDragStart = useCallback(async (task: Task, x: number, y: number) => {
        selectionFeedback();
        setDraggingTask(task);
        dragY.set(y);
        dragX.set(x);
        dragLift.set(withSpring(1, { damping: 16, stiffness: 220 }));
        await measureGoalDropTargets(habitsStore.filter(item => item.isGoal) as Habit[]);
        const initial = getHoveredGoalAtPoint(x, y);
        hoveredGoalRef.current = initial;
        setHoveredGoalId(initial);
    }, [measureGoalDropTargets, getHoveredGoalAtPoint, selectionFeedback, habitsStore, dragX, dragY, dragLift]);

    const handleTaskDragMove = useCallback((_task: Task, x: number, y: number) => {
        dragY.set(y);
        dragX.set(x);
        const next = getHoveredGoalAtPoint(x, y);
        if (next !== hoveredGoalRef.current) {
            hoveredGoalRef.current = next;
            setHoveredGoalId(next);
            if (next) selectionFeedback();
        }
    }, [getHoveredGoalAtPoint, selectionFeedback, dragX, dragY]);

    const handleTaskDragEnd = useCallback(async (task: Task, x: number, y: number) => {
        const targetGoalId = getHoveredGoalAtPoint(x, y);
        dragLift.set(withTiming(0, { duration: 170 }));
        setDraggingTask(null);
        hoveredGoalRef.current = null;
        setHoveredGoalId(null);

        if (!targetGoalId || targetGoalId === task.goalId) return;

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setTasks(items => items.map(item => item.id === task.id ? { ...item, goalId: targetGoalId } : item));
        setExpandedGoals(prev => ({ ...prev, [targetGoalId]: true }));
        lightFeedback();
        try {
            await updateTask(task.id, { goalId: targetGoalId });
            emit('tasks_changed');
        } catch {
            setTasks(items => items.map(item => item.id === task.id ? { ...item, goalId: task.goalId } : item));
            Alert.alert('Could not move task', 'Your task is still in its original goal. Please try again.');
        }
    }, [getHoveredGoalAtPoint, lightFeedback, dragLift]);

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

        filtered.sort((a, b) => {
            if (activeSort === 'name') return sortDirection * a.name.localeCompare(b.name);
            if (activeSort === 'progress') return sortDirection * (Number(!!completions[a.id]) - Number(!!completions[b.id]));
            return sortDirection * a.createdAt.localeCompare(b.createdAt);
        });
        const byGoal: Record<string, Habit[]> = {};

        filtered.forEach(h => {
            if (h.goalId) {
                if (!byGoal[h.goalId]) byGoal[h.goalId] = [];
                byGoal[h.goalId].push(h);
            }
        });

        return { allHabits: filtered, habitsByGoal: byGoal };
    }, [habitsStore, selectedDate, selectedGoalFilter, selectedCategoryFilter, activeTimeFilter, activeSort, sortDirection, completions]);

    // Habits are already filtered to the day being looked at; tasks were not,
    // so everything ever written sat in every day's list. A task belongs to the
    // day it was given, plus today for anything late or undated.
    const dayTasks = useMemo(() => {
        const day = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        return tasksForDay(tasks, day, todayKey());
    }, [tasks, selectedDate]);

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
        setSortDirection(-1);
        setSelectedGoalFilter(null);
        setSelectedCategoryFilter(null);
        setActiveTimeFilter('all');
    }, [selectionFeedback]);

    const sortedGoals = useMemo(() => goals
        .filter(goal => (!selectedGoalFilter || goal.id === selectedGoalFilter) && (activeTimeFilter === 'all' || (habitsByGoal[goal.id] || []).length > 0))
        .sort((a, b) => {
            if (activeSort === 'name') return sortDirection * a.name.localeCompare(b.name);
            if (activeSort === 'progress') return sortDirection * ((goalProgress[a.id] || 0) - (goalProgress[b.id] || 0));
            return sortDirection * a.createdAt.localeCompare(b.createdAt);
        }), [goals, activeSort, sortDirection, goalProgress, selectedGoalFilter, activeTimeFilter, habitsByGoal]);

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
                            contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: tabBarClearance, paddingTop: isCompactHeight ? 4 : 8 }}
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
                                        ref={filterButtonRef}
                                        accessibilityRole="button"
                                        accessibilityLabel="Filter the roadmap"
                                        onPress={() => {
                                            lightFeedback();
                                            openFilterModal();
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    >
                                        <Ionicons name="filter" size={10} color={accentColor} />
                                        <Text style={{ color: accentColor, fontSize: 9, fontFamily: FontFamily.semibold, letterSpacing: 0.5 }}>
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
                                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: FontFamily.regular, letterSpacing: 2 }}>
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
                                                            <Ionicons name={item.habit.icon || 'checkbox-outline'} size={18} color={colors.textPrimary} />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: colors.text, fontSize: 13, fontFamily: FontFamily.semibold }} numberOfLines={1}>{item.habit.name}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                                {item.owner.avatarUrl ? (
                                                                    <Image source={{ uri: item.owner.avatarUrl }} style={{ width: 14, height: 14, borderRadius: 7, marginRight: 4 }} />
                                                                ) : (
                                                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, marginRight: 4, alignItems: 'center', justifyContent: 'center' }}>
                                                                        <Text style={{ color: '#fff', fontSize: 8, fontFamily: FontFamily.bold }}>{item.owner.username.charAt(0).toUpperCase()}</Text>
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
                                                        <Text style={{ color: '#fff', fontSize: 11, fontFamily: FontFamily.semibold }}>Add to list</Text>
                                                    </TouchableOpacity>
                                                </VoidCard>
                                            ))}

                                            {/* Shared Goals */}
                                            {sharedGoals.map((item, index) => (
                                                <VoidCard key={`sg-${index}`} glass={!theme.includes('trueDark')} intensity={30} style={{ width: 220, padding: 12, marginRight: 0 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                                            <Ionicons name={item.goal.icon || 'flag-outline'} size={18} color={colors.textPrimary} />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: colors.text, fontSize: 13, fontFamily: FontFamily.semibold }} numberOfLines={1}>{item.goal.name}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                                {item.owner.avatarUrl ? (
                                                                    <Image source={{ uri: item.owner.avatarUrl }} style={{ width: 14, height: 14, borderRadius: 7, marginRight: 4 }} />
                                                                ) : (
                                                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, marginRight: 4, alignItems: 'center', justifyContent: 'center' }}>
                                                                        <Text style={{ color: '#fff', fontSize: 8, fontFamily: FontFamily.bold }}>{item.owner.username.charAt(0).toUpperCase()}</Text>
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
                                                        <Text style={{ color: colors.text, fontSize: 11, fontFamily: FontFamily.semibold }}>View Goal</Text>
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: FontFamily.regular, letterSpacing: 2 }}>GOALS</Text>
                                        <TouchableOpacity onPress={() => {
                                            const allExpanded = sortedGoals.every(goal => expandedGoals[goal.id]);
                                            setExpandedGoals(allExpanded ? {} : Object.fromEntries(sortedGoals.map(goal => [goal.id, true])));
                                        }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}>
                                            <Ionicons name={sortedGoals.every(goal => expandedGoals[goal.id]) ? 'contract-outline' : 'expand-outline'} size={14} color={colors.textSecondary} />
                                            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{sortedGoals.every(goal => expandedGoals[goal.id]) ? 'Collapse all' : 'Expand all'}</Text>
                                        </TouchableOpacity>
                                    </View>

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
                                                                        shared={sharedFor(habit.id)}
                                                                        isDragging={draggingHabit?.id === habit.id}
                                                                        skipped={!!skipped[habit.id]}
                                                                        onSkip={handleHabitSkip}
                                                                        isActive={habit.id === activeHabitId}
                                                                        timeLeft={habit.id === activeHabitId ? timeLeft : undefined}
                                                                        totalDuration={habit.id === activeHabitId ? totalDuration : undefined}
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
                                                            ) : null}

                                                            {/* A goal is reached through rhythms and one-off work alike. */}
                                                            {dayTasks.filter(task => task.goalId === goal.id).map(task => (
                                                                <TaskItem
                                                                    key={task.id}
                                                                    task={task}
                                                                    size={cardSize}
                                                                    today={todayKey()}
                                                                    isDragging={draggingTask?.id === task.id}
                                                                    onDragStart={handleTaskDragStart}
                                                                    onDragMove={handleTaskDragMove}
                                                                    onDragEnd={handleTaskDragEnd}
                                                                    onToggle={handleTaskToggle}
                                                                    onPress={openTask}
                                                                    onEdit={openTask}
                                                                    onDelete={handleTaskDelete}
                                                                />
                                                            ))}

                                                            {linkedHabits.length === 0 && !dayTasks.some(task => task.goalId === goal.id) ? (
                                                                <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', paddingVertical: 8 }}>
                                                                    Nothing linked yet.
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                    )}
                                                    </View>
                                                </View>
                                            );
                                        })
                                    ) : (
                                        <VoidCard style={{ alignItems: 'center', justifyContent: 'center', padding: 24, borderStyle: 'dashed' }}>
                                            <Text style={{ color: colors.textTertiary, fontFamily: FontFamily.regular }}>NO ACTIVE GOALS</Text>
                                        </VoidCard>
                                    )}
                                </View>
                            )}

                            {/* TASKS SECTION — one-off work, kept apart from the rhythms. */}
                            {!isGoalFilter && dayTasks.some(task => !task.goalId) && (
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: FontFamily.regular, letterSpacing: 2, marginBottom: 10 }}>
                                        TASKS
                                    </Text>
                                    {dayTasks
                                        .filter(task => !task.goalId)
                                        .map(task => (
                                            <TaskItem
                                                key={task.id}
                                                task={task}
                                                size={cardSize}
                                                today={todayKey()}
                                                isDragging={draggingTask?.id === task.id}
                                                onDragStart={handleTaskDragStart}
                                                onDragMove={handleTaskDragMove}
                                                onDragEnd={handleTaskDragEnd}
                                                onToggle={handleTaskToggle}
                                                onPress={openTask}
                                                onEdit={openTask}
                                                onDelete={handleTaskDelete}
                                            />
                                        ))}
                                </View>
                            )}

                            {/* HABITS SECTION */}
                            {!isGoalFilter && (activeFilter === 'all' ? looseHabits : allHabits).length > 0 && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontFamily: FontFamily.regular, letterSpacing: 2, marginBottom: 10 }}>
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
                                                shared={sharedFor(habit.id)}
                                                isDragging={draggingHabit?.id === habit.id}
                                                isActive={habit.id === activeHabitId}
                                                timeLeft={habit.id === activeHabitId ? timeLeft : undefined}
                                                totalDuration={habit.id === activeHabitId ? totalDuration : undefined}
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
                                                    const wasDone = !!completions[h.id];
                                                    toggleCompletion(h.id, todayStr).catch(() => {
                                                        setCompletions(prev => ({ ...prev, [h.id]: wasDone }));
                                                        Alert.alert('Could not save progress', 'Your check-in was not saved. Please try again.');
                                                    });
                                                    setCompletions(prev => ({ ...prev, [h.id]: !wasDone }));
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

                        {draggingHabit || draggingTask ? (
                            <View pointerEvents="none" style={styles.dragOverlay}>
                                <Animated.View
                                    style={[
                                        styles.dragPreview,
                                        dragPreviewStyle,
                                        {
                                            top: 0,
                                            left: 20,
                                            right: 20,
                                            borderColor: hoveredGoalId ? accentColor : colors.border,
                                            backgroundColor: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(10,12,16,0.96)',
                                        },
                                    ]}
                                >
                                    {/* The same preview for both kinds of row. */}
                                    <Ionicons
                                        name={draggingTask ? 'flash' : ((draggingHabit?.icon as any) || 'ellipse-outline')}
                                        size={16}
                                        color={draggingTask ? TASK_COLOR : (draggingHabit?.color || accentColor)}
                                    />
                                    <Text style={[styles.dragPreviewText, { color: colors.text }]} numberOfLines={1}>
                                        {`Move "${draggingTask?.title ?? draggingHabit?.name ?? ''}" into ${hoveredGoalId ? goals.find((goal) => goal.id === hoveredGoalId)?.name || 'goal' : 'a goal'}`}
                                    </Text>
                                </Animated.View>
                            </View>
                        ) : null}
                    </View>

                    <RoadmapFilters visible={showFilter} onClose={closeFilterModal} goals={goals} anchor={filterAnchor}
                        show={activeFilter} onShow={setActiveFilter} focus={activeTimeFilter} onFocus={setActiveTimeFilter}
                        goal={selectedGoalFilter} onGoal={setSelectedGoalFilter} order={activeSort} direction={sortDirection}
                        onOrder={value => { if (value === activeSort) setSortDirection(direction => direction === 1 ? -1 : 1); else { setActiveSort(value); setSortDirection(1); } }}
                        onReset={resetFilters} />

                </View>
            </SafeAreaView>

        </VoidShell>
    );
};

const styles = StyleSheet.create({
    dragOverlay: {
        ...StyleSheet.absoluteFill,
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
        fontFamily: FontFamily.medium,
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
        fontFamily: FontFamily.semibold
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
        color: 'rgba(128,128,128,0.7)',
        fontFamily: FontFamily.semibold
    }
});

export default CalendarScreen;
