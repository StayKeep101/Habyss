import { FontFamily } from '@/theme/designSystem';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { ListItem } from '@/components/ui/Motion';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle, runOnJS, withSpring, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { CalendarStrip } from '@/components/Home/CalendarStrip';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { useSharedItems } from '@/hooks/useSharedItems';
import { GoalCard } from '@/components/Home/GoalCard';
import { TaskItem, TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { getTasks, setTaskStatus, updateTask, deleteTask as removeTask, tasksForDay, todayKey, type Task } from '@/lib/tasks';

import { setSkipped as setSkippedHabit, subscribeToHabits, toggleCompletion, isTimedHabit, removeHabitEverywhere, isHabitScheduledForDate, addHabit, updateHabit, Habit as StoreHabit } from '@/lib/habitsSQLite';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useHistory } from '@/hooks/useHistory';
import { useData } from '@/hooks/useData';
import { habitStatus, isLive } from '@/lib/habitStatus';
import { localDateKey } from '@/lib/habitSchedule';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useFocusTime } from '@/context/FocusTimeContext';
import { RoadmapFilters, type FilterAnchor } from '@/components/Home/RoadmapFilters';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { VoidShell } from '@/components/ui/VoidShell';
import { VoidCard } from '@/components/ui/VoidCard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';
import { DayPlanCard } from '@/components/Roadmap/DayPlanCard';
import { tallyDay } from '@/lib/dayComplete';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { buildDayPlan } from '@/lib/dayPlan';
import { DEFAULT_DAY, getDayWindow, type DayWindow } from '@/lib/echo';
import { getRemoveDrag, isOverOrb, setRemoveDrag } from '@/lib/dragBridge';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { styles } from '@/styles/screens/tabs/roadmap.styles';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface Habit extends StoreHabit {
    streak?: number;
    completed?: boolean;
}

type FilterType = 'all' | 'goals_only' | 'habits_only' | 'tasks_only';
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
    const { activeHabitId, activeHabitName, isRunning: isFocusRunning, isPaused: isFocusPaused, startTimer, timeLeft, totalDuration } = useFocusTime();
    // Check-ins and skips come from the one shared copy (lib/dataStore.ts), the
    // same one the habit's page and every stat read. This screen used to keep
    // its own, loaded once and patched by events, and it could drift from it.
    // Taps show at once through `pending`, which steps aside as soon as the
    // shared copy agrees.
    const shared = useData();
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [pendingSkips, setPendingSkips] = useState<Record<string, boolean>>({});
    // When the shared copy changes, drop the taps it now agrees with; what is
    // left is still being saved.
    const [seen, setSeen] = useState({ history: shared.history, skips: shared.skips });
    if (seen.history !== shared.history || seen.skips !== shared.skips) {
        const unsettled = (map: Record<string, string[]>, overlay: Record<string, boolean>) => Object.fromEntries(
            Object.entries(overlay).filter(([key, value]) => {
                const [date, id] = key.split('|');
                return (map[date] ?? []).includes(id) !== value;
            }),
        );
        setSeen({ history: shared.history, skips: shared.skips });
        setPending(unsettled(shared.history, pending));
        setPendingSkips(unsettled(shared.skips, pendingSkips));
    }
    const markDone = useCallback((habitId: string, value: boolean, date: string) => {
        setPending(prev => ({ ...prev, [`${date}|${habitId}`]: value }));
    }, []);
    const markSkipped = useCallback((habitId: string, value: boolean, date: string) => {
        setPendingSkips(prev => ({ ...prev, [`${date}|${habitId}`]: value }));
    }, []);
    const dayMap = useCallback((map: Record<string, string[]>, overlay: Record<string, boolean>, date: string) => {
        const result: Record<string, boolean> = {};
        for (const id of map[date] ?? []) result[id] = true;
        for (const [key, value] of Object.entries(overlay)) {
            const [day, id] = key.split('|');
            if (day === date) result[id] = value;
        }
        return result;
    }, []);
    const { horizontalPadding, tabBarClearance, isCompactHeight } = useResponsiveLayout();

    // Data State
    const [habitsStore, setHabitsStore] = useState<StoreHabit[]>([]);
    // habits state removed - usage replaced by memoized derivation

    /**
     * Who else is on each habit on screen, in one query for the whole list.
     *
     * A shared habit is not done until everyone on it is done, so every row
     * needs to know — but thirty rows asking separately is thirty requests and
     * thirty re-renders while somebody is trying to scroll.
     */
    const [selectedDate, setSelectedDate] = useState(new Date());
    const selectedKey = localDateKey(selectedDate);
    const todayKeyNow = localDateKey(new Date());
    const completions = useMemo(() => dayMap(shared.history, pending, selectedKey), [dayMap, shared.history, pending, selectedKey]);
    const todayCompletions = useMemo(() => dayMap(shared.history, pending, todayKeyNow), [dayMap, shared.history, pending, todayKeyNow]);
    const skipped = useMemo(() => dayMap(shared.skips, pendingSkips, selectedKey), [dayMap, shared.skips, pendingSkips, selectedKey]);
    const habitIds = useMemo(
        () => habitsStore.filter(habit => !habit.isGoal && !habit.isArchived).map(habit => habit.id),
        [habitsStore],
    );
    const { stateFor: sharedFor } = useSharedItems(habitIds, completions);
    // Tasks live here too, so the roadmap is the whole plan rather than only rhythms.
    const [tasks, setTasks] = useState<Task[]>([]);
    /**
     * The same question for tasks, asked separately.
     *
     * A task id and a habit id are both uuids and live in different tables, so
     * one call cannot answer for both — asking `shared_habits` about a task
     * returns nobody, which reads as "not shared" rather than as a wrong
     * question, and a shared task would silently complete on one tick.
     */
    const taskIds = useMemo(() => tasks.filter(task => task.status !== 'cancelled').map(task => task.id), [tasks]);
    const taskDone = useMemo(
        () => Object.fromEntries(tasks.map(task => [task.id, task.status === 'done'])),
        [tasks],
    );
    const { stateFor: sharedTaskFor } = useSharedItems(taskIds, taskDone, 'task');

    // UI State
    const [showFilter, setShowFilter] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    /** Show only what somebody else is on too. */
    const [sharedOnly, setSharedOnly] = useState(false);
    const [activeSort, setActiveSort] = useState<SortType>('default');
    const [sortDirection, setSortDirection] = useState<1 | -1>(-1);
    const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('all');
    const [selectedGoalFilter, setSelectedGoalFilter] = useState<string | null>(null); // Filter by specific goal ID
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null); // Filter by life pillar
    const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
    // Loaded once here, and re-read whenever a habit is ticked anywhere —
    // this screen used to fetch on mount only and then quietly go stale.
    const { history: pastDone, skips: pastSkips } = useHistory(90);
    const stripTarget = useDailyTarget();
    const [draggingHabit, setDraggingHabit] = useState<Habit | null>(null);
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const dragY = useSharedValue(0);
    const dragX = useSharedValue(0);
    // 0 while resting, 1 once picked up: lifts, tilts and shrinks the card so it
    // reads as held above the list, the way a dragged file does.
    const dragLift = useSharedValue(0);
    // Where the list area sits on screen, so the dragged pill lands exactly
    // under the finger rather than offset by the header above it.
    const areaX = useSharedValue(0);
    const areaY = useSharedValue(0);
    const areaWidth = useSharedValue(0);
    const listAreaRef = useRef<View>(null);
    const measureArea = useCallback(() => {
        listAreaRef.current?.measureInWindow((x, y, width) => { areaX.set(x); areaY.set(y); areaWidth.set(width); });
    }, [areaX, areaY, areaWidth]);
    const dragPreviewStyle = useAnimatedStyle(() => ({
        transform: [
            // Centred on the finger, a little above it so the thumb does not hide it.
            { translateX: dragX.get() - areaX.get() - areaWidth.get() / 2 },
            { translateY: dragY.get() - areaY.get() - 64 },
            { scale: 0.86 + dragLift.get() * 0.14 },
            { rotateZ: `${dragLift.get() * 2}deg` },
        ],
        opacity: dragLift.get(),
    }));
    // "Remove from goal": while something in a goal is dragged, the plus button
    // in the dock becomes the drop target (lib/dragBridge).
    const isOverRemove = useCallback((x: number, y: number, inGoal: boolean) => inGoal && isOverOrb(x, y), []);
    const trackRemove = useCallback((value: boolean) => {
        if (value === getRemoveDrag().over) return;
        setRemoveDrag({ over: value });
        if (value) selectionFeedback();
    }, [selectionFeedback]);
    // Never leave the button changed if the page goes away mid-drag.
    useEffect(() => () => setRemoveDrag({ active: false }), []);
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

    /**
     * Pulling the filter down has to be meant, the way Transit does it.
     *
     * It used to open whenever the list went far enough past the top, and a
     * hard fling up from lower down carries its momentum past the top and
     * bounces into exactly that zone. Now it only arms when a drag *starts*
     * with the list already at the top, and only counts while the finger is
     * still down — a bounce on its own never opens anything.
     */
    // How far past the top the finger has pulled, while it is down.
    const pull = useSharedValue(0);
    const PULL_TO_OPEN = 80;
    const scrollHandler = useAnimatedScrollHandler({
        onBeginDrag: (event) => {
            wasAtTop.value = event.contentOffset.y <= 2;
            filterTriggered.value = false;
        },
        onScroll: (event) => {
            const currentY = event.contentOffset.y;
            scrollY.value = currentY;
            pull.value = wasAtTop.value ? Math.max(0, -currentY) : 0;
            // Armed past the line: a tick you can feel. Letting go opens it;
            // easing back under the line before letting go does not.
            const armed = pull.value > PULL_TO_OPEN;
            if (armed !== filterTriggered.value) {
                filterTriggered.value = armed;
                if (armed) runOnJS(lightFeedback)();
            }
        },
        onEndDrag: () => {
            if (wasAtTop.value && filterTriggered.value) runOnJS(openFilterModal)();
            // Released: whatever momentum does next is not a pull.
            wasAtTop.value = false;
            filterTriggered.value = false;
            pull.value = 0;
        },
    });
    // The filter icon that rises out of the pull, the way Transit shows it.
    const pullIcon = useAnimatedStyle(() => ({
        opacity: interpolate(pull.value, [12, PULL_TO_OPEN], [0, 1], Extrapolation.CLAMP),
        transform: [
            { translateY: Math.min(pull.value, PULL_TO_OPEN + 20) / 2 - 18 },
            { scale: interpolate(pull.value, [12, PULL_TO_OPEN, PULL_TO_OPEN + 24], [0.6, 1, 1.12], Extrapolation.CLAMP) },
        ],
    }));

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
        return () => { taskSub.remove(); unsubPromise.then(unsub => unsub()); };
    }, []);




    // Each goal's progress: the same number the goal shows on its own page,
    // Home and the goals overview, from the one shared calculation.
    const { insightsById } = useGoalsInsights();
    const goalProgress = useMemo(() => {
        const map: Record<string, number> = {};
        for (const id of Object.keys(insightsById)) map[id] = insightsById[id].progress;
        return map;
    }, [insightsById]);

    // Map habits with completion status - OPTIMIZED: only on data changes
    // Map habits effect removed - redundant O(N) state update

    // Weekly Calcs - OPTIMIZED: only run on mount to prevent JS thread hammering

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

        // A timed habit is done by running its timer: open it instead.
        if (!completions[habit.id] && isTimedHabit(habit)) {
            isNavigating.current = false;
            lightFeedback();
            router.push({ pathname: '/habit-detail', params: { habitId: habit.id } });
            return;
        }

        // 1. Optimistic Update
        const isCompleted = !completions[habit.id];
        markDone(habit.id, isCompleted, dateStr);

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
            markDone(habit.id, !isCompleted, dateStr);
            Alert.alert('Could not save progress', 'Your check-in was not saved. Please try again.');
            console.error(e);
        });

        setTimeout(() => { isNavigating.current = false; }, 300);
    }, [selectedDate, completions, playComplete, selectionFeedback, lightFeedback, markDone]);

    // Standing down for today: recorded, so it is never counted as a miss.
    const handleHabitSkip = useCallback(async (habit: StoreHabit) => {
        const already = !!skipped[habit.id];
        selectionFeedback();
        const date = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        markSkipped(habit.id, !already, date);
        try { await setSkippedHabit(habit.id, !already, date); }
        catch {
            markSkipped(habit.id, already, date);
            Alert.alert('Could not save progress', 'This skip was not saved. Please try again.');
        }
    }, [skipped, selectedDate, selectionFeedback, markSkipped]);

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

    // What each card shows, from the one rule the habit's page uses too.
    const statusOf = useCallback((habit: Habit) => habitStatus({
        habitId: habit.id,
        done: !!completions[habit.id],
        skipped: !!skipped[habit.id],
        focus: { activeHabitId, isRunning: isFocusRunning, isPaused: isFocusPaused },
        focusWindowOpen: isHabitFocusableNow(habit),
    }), [completions, skipped, activeHabitId, isFocusRunning, isFocusPaused, isHabitFocusableNow]);

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

        measuredAt.current = scrollY.get();
        goalDropLayouts.current = Object.fromEntries(entries.filter((entry): entry is [string, { x: number; y: number; width: number; height: number }] => !!entry[1]));
    }, []);

    const getHoveredGoalAtPoint = useCallback((x: number, y: number) => {
        // The targets were measured before any auto-scroll; move them with it.
        const shift = measuredAt.current - scrollY.get();
        for (const [goalId, layout] of Object.entries(goalDropLayouts.current)) {
            const top = layout.y + shift;
            if (x >= layout.x && x <= layout.x + layout.width && y >= top && y <= top + layout.height) {
                return goalId;
            }
        }
        return null;
    }, [scrollY]);

    /**
     * Holding something near the top or bottom edge scrolls the list, so a
     * habit far down can reach a goal far up. The speed depends only on how
     * deep into the edge the finger is — gentle at its border, steady at most
     * ~9 points a frame — and never builds up the longer you hold.
     */
    const listRef = useRef<any>(null);
    const viewport = useRef({ top: 0, height: 0 });
    const contentHeight = useRef(0);
    const finger = useRef<{ x: number; y: number } | null>(null);
    const autoFrame = useRef<number | null>(null);
    const measuredAt = useRef(0);
    const EDGE = 96;
    const MAX_STEP = 9;
    const autoScrollStep = useCallback(() => {
        const point = finger.current;
        if (!point) { autoFrame.current = null; return; }
        const { top, height } = viewport.current;
        const bottom = top + height - tabBarClearance;
        const depth = point.y < top + EDGE ? -(top + EDGE - point.y) / EDGE
            : point.y > bottom - EDGE ? (point.y - (bottom - EDGE)) / EDGE : 0;
        if (depth !== 0 && height > 0) {
            const clamped = Math.max(-1, Math.min(1, depth));
            // Eased: the first part of the edge creeps, the far end moves.
            const step = Math.sign(clamped) * clamped * clamped * MAX_STEP;
            const max = Math.max(0, contentHeight.current - height);
            const now = scrollY.get();
            const next = Math.max(0, Math.min(max, now + step));
            if (Math.abs(next - now) > 0.1) {
                listRef.current?.scrollTo({ y: next, animated: false });
                scrollY.set(next);
                const hovered = getHoveredGoalAtPoint(point.x, point.y);
                if (hovered !== hoveredGoalRef.current) {
                    hoveredGoalRef.current = hovered;
                    setHoveredGoalId(hovered);
                    if (hovered) selectionFeedback();
                }
            }
        }
        autoFrame.current = requestAnimationFrame(autoScrollStep);
    }, [getHoveredGoalAtPoint, scrollY, selectionFeedback, tabBarClearance]);
    const followFinger = useCallback((x: number, y: number) => {
        finger.current = { x, y };
        if (autoFrame.current === null) autoFrame.current = requestAnimationFrame(autoScrollStep);
    }, [autoScrollStep]);
    const stopFollowing = useCallback(() => {
        finger.current = null;
        if (autoFrame.current !== null) cancelAnimationFrame(autoFrame.current);
        autoFrame.current = null;
    }, []);
    const measureViewport = useCallback(() => {
        listRef.current?.measureInWindow?.((_x: number, y: number, _w: number, height: number) => { viewport.current = { top: y, height }; });
    }, []);
    useEffect(() => stopFollowing, [stopFollowing]);

    const handleHabitDragStart = useCallback(async (habit: Habit, x: number, y: number) => {
        selectionFeedback();
        setDraggingHabit(habit);
        setRemoveDrag({ active: !!habit.goalId });
        measureArea();
        measureViewport();
        dragY.set(y);
        dragX.set(x);
        dragLift.set(withSpring(1, { damping: 18, stiffness: 260 }));
        const currentGoals = habitsStore.filter((item) => item.isGoal) as Habit[];
        await measureGoalDropTargets(currentGoals);
        const initial = getHoveredGoalAtPoint(x, y);
        hoveredGoalRef.current = initial;
        setHoveredGoalId(initial);
    }, [measureGoalDropTargets, getHoveredGoalAtPoint, selectionFeedback, habitsStore, dragX, dragY, dragLift, measureArea, measureViewport]);

    const handleHabitDragMove = useCallback((habit: Habit, x: number, y: number) => {
        // dragY is a shared value, so the floating card follows the finger on the UI
        // thread. Only publish the hovered goal to React state when it actually
        // changes; setting it on every pointer move re-rendered every goal and habit
        // row for each frame of the drag.
        dragY.set(y);
        dragX.set(x);
        followFinger(x, y);
        const removing = isOverRemove(x, y, !!habit.goalId);
        trackRemove(removing);
        const next = removing ? null : getHoveredGoalAtPoint(x, y);
        if (next !== hoveredGoalRef.current) {
            hoveredGoalRef.current = next;
            setHoveredGoalId(next);
            // A tap of feedback the moment it is over a goal, so the drop is
            // felt rather than guessed at.
            if (next) selectionFeedback();
        }
    }, [getHoveredGoalAtPoint, selectionFeedback, dragX, dragY, isOverRemove, trackRemove, followFinger]);

    const handleHabitDragEnd = useCallback(async (habit: Habit, x: number, y: number) => {
        stopFollowing();
        const removing = isOverRemove(x, y, !!habit.goalId);
        const targetGoalId = removing ? null : getHoveredGoalAtPoint(x, y);

        // The card settles back into the list instead of vanishing mid-air.
        dragLift.set(withTiming(0, { duration: 170 }));
        setDraggingHabit(null);
        hoveredGoalRef.current = null;
        setHoveredGoalId(null);
        setRemoveDrag({ active: false });

        if (removing) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setHabitsStore(items => items.map(item => item.id === habit.id ? { ...item, goalId: undefined } : item));
            lightFeedback();
            try { await updateHabit({ id: habit.id, goalId: null as unknown as undefined }); }
            catch {
                setHabitsStore(items => items.map(item => item.id === habit.id ? { ...item, goalId: habit.goalId } : item));
                Alert.alert('Could not remove it', 'Your habit is still in its goal. Please try again.');
            }
            return;
        }

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
    }, [getHoveredGoalAtPoint, lightFeedback, dragLift, isOverRemove, trackRemove, stopFollowing]);

    /**
     * Tasks move between goals exactly like habits: hold one, drag it onto a
     * goal, let go. The drop targets and the floating preview are shared, so
     * both kinds of row behave the same.
     */
    const handleTaskDragStart = useCallback(async (task: Task, x: number, y: number) => {
        selectionFeedback();
        setDraggingTask(task);
        setRemoveDrag({ active: !!task.goalId });
        measureArea();
        measureViewport();
        dragY.set(y);
        dragX.set(x);
        dragLift.set(withSpring(1, { damping: 18, stiffness: 260 }));
        await measureGoalDropTargets(habitsStore.filter(item => item.isGoal) as Habit[]);
        const initial = getHoveredGoalAtPoint(x, y);
        hoveredGoalRef.current = initial;
        setHoveredGoalId(initial);
    }, [measureGoalDropTargets, getHoveredGoalAtPoint, selectionFeedback, habitsStore, dragX, dragY, dragLift, measureArea, measureViewport]);

    const handleTaskDragMove = useCallback((task: Task, x: number, y: number) => {
        dragY.set(y);
        dragX.set(x);
        followFinger(x, y);
        const removing = isOverRemove(x, y, !!task.goalId);
        trackRemove(removing);
        const next = removing ? null : getHoveredGoalAtPoint(x, y);
        if (next !== hoveredGoalRef.current) {
            hoveredGoalRef.current = next;
            setHoveredGoalId(next);
            if (next) selectionFeedback();
        }
    }, [getHoveredGoalAtPoint, selectionFeedback, dragX, dragY, isOverRemove, trackRemove, followFinger]);

    const handleTaskDragEnd = useCallback(async (task: Task, x: number, y: number) => {
        stopFollowing();
        const removing = isOverRemove(x, y, !!task.goalId);
        const targetGoalId = removing ? null : getHoveredGoalAtPoint(x, y);
        dragLift.set(withTiming(0, { duration: 170 }));
        setDraggingTask(null);
        hoveredGoalRef.current = null;
        setHoveredGoalId(null);
        setRemoveDrag({ active: false });

        if (removing) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setTasks(items => items.map(item => item.id === task.id ? { ...item, goalId: undefined } : item));
            lightFeedback();
            try { await updateTask(task.id, { goalId: null }); emit('tasks_changed'); }
            catch {
                setTasks(items => items.map(item => item.id === task.id ? { ...item, goalId: task.goalId } : item));
                Alert.alert('Could not remove it', 'Your task is still in its goal. Please try again.');
            }
            return;
        }

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
    }, [getHoveredGoalAtPoint, lightFeedback, dragLift, isOverRemove, trackRemove, stopFollowing]);

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
    // Goals are shared through their own table, so they get their own question.
    const goalIds = useMemo(() => goals.map(goal => goal.id), [goals]);
    const noGoalTicks = useMemo(() => ({}), []);
    const { stateFor: sharedGoalFor } = useSharedItems(goalIds, noGoalTicks, 'goal');

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

        // Only what somebody else is on too. Read from the same shared state
        // the rows draw their faces from, so the filter and the faces can never
        // disagree about what "shared" means.
        if (sharedOnly) {
            filtered = filtered.filter(h => !!sharedFor(h.id));
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
    }, [habitsStore, selectedDate, selectedGoalFilter, selectedCategoryFilter, activeTimeFilter, activeSort, sortDirection, completions, sharedOnly, sharedFor]);

    // Habits are already filtered to the day being looked at; tasks were not,
    // so everything ever written sat in every day's list. A task belongs to the
    // day it was given, plus today for anything late or undated.
    const dayTasks = useMemo(() => {
        const day = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const due = tasksForDay(tasks, day, todayKey());
        // "Shared only" means the whole plan, not only its rhythms: a filter
        // that hid shared habits' neighbours but left every private task in
        // place would not be showing what is shared.
        return sharedOnly ? due.filter(task => !!sharedTaskFor(task.id)) : due;
    }, [tasks, selectedDate, sharedOnly, sharedTaskFor]);

    // The waking day, as set in Notifications; re-read whenever the tab shows.
    const [dayWindow, setDayWindow] = useState<DayWindow>(DEFAULT_DAY);
    useFocusEffect(useCallback(() => {
        getDayWindow().then(setDayWindow).catch(() => undefined);
    }, []));
    // A minute is fine enough for "time left", and keeps the card still.
    const [clock, setClock] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);
    const dayPlan = useMemo(() => {
        const day = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const isToday = day === todayKey(clock);
        // The whole day, whatever the filters show: time is time.
        const habits = habitsStore.filter(h => !h.isGoal && !h.isArchived && isHabitScheduledForDate(h, selectedDate)) as StoreHabit[];
        return {
            isToday,
            plan: buildDayPlan({
                habits, tasks: tasksForDay(tasks, day, todayKey(clock)), completions,
                wake: dayWindow.wake, sleep: dayWindow.sleep,
                now: isToday ? clock.getHours() * 60 + clock.getMinutes() : null,
            }),
        };
    }, [habitsStore, tasks, completions, selectedDate, dayWindow, clock]);

    /**
     * Each day's ring on the strip, counted exactly as the ring around your
     * picture on Home: that day's scheduled habits and its tasks. Recomputed
     * whenever anything is ticked, so it moves the moment you finish something
     * — it used to be worked out once, from habits only, against every habit
     * you own.
     */
    const weeklyCompletions = useMemo(() => {
        const today = todayKey();
        const result: Record<string, { completed: number; total: number }> = {};
        for (let offset = -7; offset <= 7; offset++) {
            const date = new Date();
            date.setDate(date.getDate() + offset);
            const key = todayKey(date);
            const done: Record<string, boolean> = {};
            if (key === today) Object.assign(done, todayCompletions);
            else for (const id of pastDone[key] ?? []) done[id] = true;
            const skipped: Record<string, boolean> = {};
            for (const id of (key === today ? [] : pastSkips[key] ?? [])) skipped[id] = true;
            const tally = tallyDay(habitsStore as StoreHabit[], done, skipped, tasks, key, stripTarget);
            result[key] = { completed: tally.done, total: tally.total };
        }
        return result;
    }, [habitsStore, todayCompletions, pastDone, pastSkips, tasks, stripTarget]);

    // Loose habits are those not linked to any goal, or linked to a non-existent goal
    const looseHabits = useMemo(() => {
        return allHabits.filter(h => !h.goalId || !goals.some(g => g.id === h.goalId));
    }, [allHabits, goals]);

    // Stated as what each section shows rather than as what two of them are
    // not: `!isGoalFilter` quietly meant "and also not tasks_only" the moment a
    // fourth value existed, which is how a filter starts showing the wrong
    // things.
    const showGoals = activeFilter === 'all' || activeFilter === 'goals_only';
    const showHabits = activeFilter === 'all' || activeFilter === 'habits_only';
    const showTasks = activeFilter === 'all' || activeFilter === 'tasks_only';
    const hasActiveFilters = selectedGoalFilter !== null || selectedCategoryFilter !== null || sharedOnly;

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
        setSharedOnly(false);
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

                    <View ref={listAreaRef} onLayout={measureArea} style={{ flex: 1, backgroundColor: 'transparent' }}>
                        <Animated.View pointerEvents="none" style={[styles.pullIcon, pullIcon]}>
                            <MatteSurface radius={18} level="control" style={styles.pullDisc}>
                                <Ionicons name="filter" size={16} color={colors.textPrimary} />
                            </MatteSurface>
                        </Animated.View>
                        <Animated.ScrollView
                            ref={listRef}
                            onContentSizeChange={(_w, height) => { contentHeight.current = height; }}
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: tabBarClearance, paddingTop: isCompactHeight ? 4 : 8 }}
                            showsVerticalScrollIndicator={false}
                            bounces={true}
                            alwaysBounceVertical={true}
                            style={{ backgroundColor: 'transparent' }}
                        >

                            <DayPlanCard
                                plan={dayPlan.plan}
                                isToday={dayPlan.isToday}
                                accent={accentColor}
                                onEditDay={() => { lightFeedback(); router.push('/(root)/notifications'); }}
                            />

                            {/* Filter Indicator - Subtle compact pill */}
                            {(activeFilter !== 'all' || hasActiveFilters || activeTimeFilter !== 'all' || activeSort !== 'default') && (
                                <View style={{
                                    alignSelf: 'flex-start',
                                    backgroundColor: accentColor + '25', // ui-allow: decorative
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
                                                activeFilter !== 'all' && (activeFilter === 'goals_only' ? 'Goals' : activeFilter === 'tasks_only' ? 'Tasks' : 'Habits'),
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

                            {/* The "shared with you" carousel is gone. An
                                offer waits in the inbox to be accepted or
                                turned down, and once accepted the thing is
                                simply in the list with the faces of whoever
                                else is on it — which is where somebody looks
                                for their own habits anyway. */}

                            {/* GOALS SECTION */}
                            {showGoals && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <SectionTitle first right={
                                        <TouchableOpacity onPress={() => {
                                            const allExpanded = sortedGoals.every(goal => expandedGoals[goal.id]);
                                            setExpandedGoals(allExpanded ? {} : Object.fromEntries(sortedGoals.map(goal => [goal.id, true])));
                                        }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}>
                                            <Ionicons name={sortedGoals.every(goal => expandedGoals[goal.id]) ? 'contract-outline' : 'expand-outline'} size={14} color={colors.textSecondary} />
                                            <Text style={{ color: colors.textTertiary, fontSize: 13, fontFamily: FontFamily.medium }}>{sortedGoals.every(goal => expandedGoals[goal.id]) ? 'Collapse all' : 'Expand all'}</Text>
                                        </TouchableOpacity>
                                    }>Goals</SectionTitle>

                                    {sortedGoals.length > 0 ? (
                                        sortedGoals.map(goal => {
                                            const linkedHabits = habitsByGoal[goal.id] || [];
                                            const isExpanded = expandedGoals[goal.id];

                                            // Progress Calculation - USE STRICT PROGRESS
                                            const progress = goalProgress[goal.id] || 0;

                                            return (
                                                    <ListItem key={goal.id} style={{ marginBottom: 16 }}>
                                                    <View ref={(ref) => { goalRefs.current[goal.id] = ref; }}>
                                                    {/* Goal Header / Card */}
                                                    <View style={{ position: 'relative' }}>
                                                        <GoalCard
                                                            goal={{ ...goal, color: goal.color || accentColor }}
                                                            progress={progress}
                                                            size={cardSize}
                                                            isExpanded={!!isExpanded}
                                                            linkedHabitsCount={linkedHabits.length}
                                                            shared={sharedGoalFor(goal.id)}
                                                            isDropTarget={hoveredGoalId === goal.id}
                                                            onToggleExpand={() => toggleGoalExpansion(goal.id)}
                                                            onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                                                        />
                                                    </View>

                                                    {/* Linked Habits Accordion */}
                                                    {isExpanded && (
                                                        <ListItem style={{
                                                            marginTop: 8,
                                                            marginLeft: 16,
                                                            paddingLeft: 16,
                                                            borderLeftWidth: 2,
                                                            borderLeftColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
                                                        }}>
                                                            {linkedHabits.length > 0 ? (
                                                                linkedHabits.map(habit => (
                                                                    <ListItem key={habit.id}><SwipeableHabitItem
                                                                        key={habit.id}
                                                                        habit={habit}
                                                                        size={cardSize}
                                                                        completed={!!completions[habit.id]}
                                                                        shared={sharedFor(habit.id)}
                                                                        isDragging={draggingHabit?.id === habit.id}
                                                                        skipped={!!skipped[habit.id]}
                                                                        onSkip={handleHabitSkip}
                                                                        isActive={isLive(statusOf(habit))}
                                                                        timeLeft={isLive(statusOf(habit)) ? timeLeft : undefined}
                                                                        totalDuration={isLive(statusOf(habit)) ? totalDuration : undefined}
                                                                        canFocusNow={statusOf(habit) === 'focus-now'}
                                                                        onFocusPress={handleFocusHabit}
                                                                        onDragStart={handleHabitDragStart}
                                                                        onDragMove={handleHabitDragMove}
                                                                        onDragEnd={handleHabitDragEnd}
                                                                        onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } })}
                                                                        onToggle={() => handleHabitPress(habit)}
                                                                        onEdit={handleEdit}
                                                                        onDelete={handleDelete}
                                                                    /></ListItem>
                                                                ))
                                                            ) : null}

                                                            {/* A goal is reached through rhythms and one-off work alike. */}
                                                            {dayTasks.filter(task => task.goalId === goal.id).map(task => (
                                                                <ListItem key={task.id}><TaskItem
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
                                                                    shared={sharedTaskFor(task.id)}
                                                                /></ListItem>
                                                            ))}

                                                        </ListItem>
                                                    )}
                                                    </View>
                                                </ListItem>
                                            );
                                        })
                                    ) : (
                                        <VoidCard style={{ alignItems: 'center', justifyContent: 'center', padding: 24, borderStyle: 'dashed' }}>
                                            <Text style={{ color: colors.textTertiary, fontFamily: FontFamily.regular }}>No goals yet</Text>
                                        </VoidCard>
                                    )}
                                </View>
                            )}

                            {/* TASKS SECTION — one-off work, kept apart from the rhythms. */}
                            {/* When tasks are the only thing asked for, the ones
                                under a goal belong here too — otherwise the
                                filter hides exactly what it was set to show. */}
                            {showTasks && dayTasks.some(task => activeFilter === 'tasks_only' || !task.goalId) && (
                                <View style={{ marginBottom: 16 }}>
                                    <SectionTitle first>Tasks</SectionTitle>
                                    {dayTasks
                                        .filter(task => activeFilter === 'tasks_only' || !task.goalId)
                                        .map(task => (
                                            <ListItem key={task.id}><TaskItem
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
                                                shared={sharedTaskFor(task.id)}
                                            /></ListItem>
                                        ))}
                                </View>
                            )}

                            {/* HABITS SECTION */}
                            {showHabits && (activeFilter === 'all' ? looseHabits : allHabits).length > 0 && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <SectionTitle first>{activeFilter === 'all' ? 'Other habits' : 'Habits'}</SectionTitle>

                                    {(activeFilter === 'all' ? looseHabits : allHabits).map(habit => {
                                        // Find associated goal name for habit
                                        const associatedGoal = goals.find(g => g.id === habit.goalId);
                                        return (
                                            <ListItem key={habit.id}><SwipeableHabitItem
                                                key={habit.id}
                                                habit={habit}
                                                completed={!!completions[habit.id]}
                                                shared={sharedFor(habit.id)}
                                                isDragging={draggingHabit?.id === habit.id}
                                                isActive={isLive(statusOf(habit))}
                                                timeLeft={isLive(statusOf(habit)) ? timeLeft : undefined}
                                                totalDuration={isLive(statusOf(habit)) ? totalDuration : undefined}
                                                canFocusNow={statusOf(habit) === 'focus-now'}
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

                                                    const wasDone = !!completions[h.id];
                                                    if (!wasDone && isTimedHabit(h)) {
                                                        router.push({ pathname: '/habit-detail', params: { habitId: h.id } });
                                                        return;
                                                    }
                                                    selectionFeedback();
                                                    toggleCompletion(h.id, todayStr).catch(() => {
                                                        markDone(h.id, wasDone, todayStr);
                                                        Alert.alert('Could not save progress', 'Your check-in was not saved. Please try again.');
                                                    });
                                                    markDone(h.id, !wasDone, todayStr);
                                                }}
                                                onEdit={handleEdit}
                                                onDelete={(h) => { handleDelete(h); }}
                                                size={cardSize}
                                            /></ListItem>
                                        );
                                    })
                                    }
                                </View>
                            )}

                            {/* Habits section removed - all habits must be linked to goals */}

                        </Animated.ScrollView>

                        {draggingHabit || draggingTask ? (
                            <View pointerEvents="none" style={styles.dragOverlay}>
                                {/* The thing being moved: a small matte pill under the finger. */}
                                <Animated.View style={[styles.dragFloat, dragPreviewStyle]}>
                                    <MatteSurface radius={999} elevation="floating" style={styles.dragPill}>
                                        <IconTile icon={draggingTask ? 'flash' : ((draggingHabit?.icon as any) || 'ellipse')}
                                            color={draggingTask ? TASK_COLOR : (draggingHabit?.color || accentColor)} size={26} />
                                        <Text style={[styles.dragPreviewText, { color: colors.textPrimary }]} numberOfLines={1}>
                                            {draggingTask?.title ?? draggingHabit?.name ?? ''}
                                        </Text>
                                    </MatteSurface>
                                    {hoveredGoalId ? (
                                        <Text style={[styles.dragHint, { color: colors.textSecondary }]} numberOfLines={1}>
                                            Into {goals.find(goal => goal.id === hoveredGoalId)?.name ?? 'goal'}
                                        </Text>
                                    ) : null}
                                </Animated.View>

                            </View>
                        ) : null}
                    </View>

                    <RoadmapFilters visible={showFilter} onClose={closeFilterModal} goals={goals} anchor={filterAnchor}
                        show={activeFilter} onShow={setActiveFilter} focus={activeTimeFilter} onFocus={setActiveTimeFilter}
                        goal={selectedGoalFilter} onGoal={setSelectedGoalFilter}
                        sharedOnly={sharedOnly} onSharedOnly={setSharedOnly}
                        order={activeSort} direction={sortDirection}
                        onOrder={value => { if (value === activeSort) setSortDirection(direction => direction === 1 ? -1 : 1); else { setActiveSort(value); setSortDirection(1); } }}
                        onReset={resetFilters} />

                </View>
            </SafeAreaView>

        </VoidShell>
    );
};


export default CalendarScreen;
