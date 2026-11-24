import { useEndedEarly } from '@/hooks/useEndedEarly';
import { toggleEndedEarly } from '@/lib/endedEarly';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue, useLayoutEffect, memo } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager, AppState, useWindowDimensions } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Overlay } from '@/components/ui/Overlay';
import { ListItem } from '@/components/ui/Motion';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    useAnimatedStyle, runOnJS, withSpring, withTiming, interpolate, Extrapolation, LayoutAnimationConfig,
} from 'react-native-reanimated';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { oopsTitle } from '@/lib/voice';

/** The pull-to-filter icon snapping to full size as the pull arms: quick, no bounce. */
const ARM = timingFor(DURATION.quick, EASE.enter);
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { CalendarStrip, type DayMarks } from '@/components/Home/CalendarStrip';
import { useMilestoneDays } from '@/hooks/useMilestones';
import { SwipeableHabitItem } from '@/components/Home/SwipeableHabitItem';
import { useSharedItems } from '@/hooks/useSharedItems';
import { GoalTile } from '@/components/Roadmap/GoalTile';
import { TaskItem, TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { getTasks, setTaskStatus, updateTask, tasksForDay, todayKey, type Task } from '@/lib/tasks';

import { setSkipped as setSkippedHabit, subscribeToHabits, toggleCompletion, removeHabitEverywhere, isHabitScheduledForDate, addHabit, updateHabit, Habit as StoreHabit } from '@/lib/habitsSQLite';
import { proveTick } from '@/lib/challengeProof';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { useRemoveTask } from '@/hooks/useRemoveTask';
import { useLatestCallback } from '@/hooks/useLatestCallback';
import { useRemoveHabit } from '@/hooks/useRemoveHabit';
import { useHistory } from '@/hooks/useHistory';
import { useData } from '@/hooks/useData';
import { habitStatus, isLive } from '@/lib/habitStatus';
import { localDateKey } from '@/lib/habitSchedule';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useFocusSession } from '@/context/FocusTimeContext';
import { GOALS_ENABLED } from '@/constants/features';
import { RoadmapFilters, type FilterAnchor } from '@/components/Home/RoadmapFilters';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { VoidShell } from '@/components/ui/VoidShell';
import { VoidCard } from '@/components/ui/VoidCard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';
import { registerTarget } from '@/lib/coachMarks';
import { DayPlanCard } from '@/components/Roadmap/DayPlanCard';
import { flowDay, flowInputs, isTravel, type FlowInput } from '@/lib/dayFlow';
import { DayTimeline, type TimelineDrop } from '@/components/Roadmap/DayTimeline';
import { PinSheet } from '@/components/Roadmap/PinSheet';
import { CalendarPrompt } from '@/components/Roadmap/CalendarPrompt';
import { useMeals, useMealsFlexible } from '@/hooks/useMeals';
import { useDayMemory } from '@/hooks/useDayMemory';
import { useDoneTimes } from '@/hooks/useDoneTimes';
import { markSeen, memoryReady, rememberFlow } from '@/lib/dayMemory';
import { planAlert, schedulePlanAlert } from '@/lib/planAlerts';
import { setTodayFlow } from '@/lib/scheduledActivities';
import { burstMarks, habitDone, taskEarned } from '@/lib/marksOrbs';
import { speedForTask, speedLabel } from '@/lib/taskSpeed';
import { counts as countsShared } from '@/lib/sharedGate';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { openInCalendar } from '@/lib/calendarEvents';
import { useEventTravel } from '@/hooks/useEventTravel';
import { EventSheet } from '@/components/Roadmap/EventSheet';
import { useEchoPatterns } from '@/hooks/useEchoPatterns';
import { peakWindow } from '@/lib/echoPatterns';
import { energyCurve } from '@/lib/energyCurve';
import { useCheckIns } from '@/hooks/useCheckIns';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { useFocusCrew } from '@/hooks/useFocusCrew';
import { useReschedules } from '@/hooks/useReschedules';
import { hostOf, linkedHost } from '@/lib/focusTogether';
import { mealSlots } from '@/lib/meals';
import { DEFAULT_ROADMAP_FILTER, cachedRoadmapFilter, compareBySort, isFiltered, loadRoadmapFilter, saveRoadmapFilter, toggleShown, type RoadmapSort, type RoadmapView, type ShownKind } from '@/lib/roadmapFilter';
import { tallyDay } from '@/lib/dayComplete';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { buildDayPlan, clockOf, toMinutes as toMinutesOf } from '@/lib/dayPlan';
import { DEFAULT_DAY, getDayWindow, minutesOf, type DayWindow, cachedDayWindow } from '@/lib/echo';
import { getRemoveDrag, isOverOrb, setRemoveDrag } from '@/lib/dragBridge';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { styles } from '@/styles/screens/tabs/roadmap.styles';

/** Days of history read for the calendar strip's day circles. */
const HISTORY_DAYS = 90;

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface Habit extends StoreHabit {
    streak?: number;
    completed?: boolean;
}

type SortType = RoadmapSort;
type TimeFilter = 'all' | 'morning' | 'afternoon' | 'evening';

// Helper to categorize habits by their start time
const getTimeCategory = (startTime?: string): TimeFilter => {
    if (!startTime) return 'all';
    const hour = parseInt(startTime.split(':')[0], 10);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
};

/** Its children as they last were while `live`: a page out of view skips every render until it is live again. */
const Frozen = memo(function Frozen({ children }: { live: boolean; children: React.ReactNode }) {
    return <>{children}</>;
}, (_previous, next) => !next.live);

const CalendarScreen = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();
    const { lightFeedback, selectionFeedback, successFeedback, mediumFeedback } = useHaptics();
    const { cardSize, autoReschedule } = useAppSettings();
    const { activeHabitId, isRunning: isFocusRunning, isPaused: isFocusPaused, totalDuration } = useFocusSession();
    // Friends focusing with you show on the card of what you are focusing on.
    const focusingNow = isFocusRunning || isFocusPaused;
    const { crew: focusCrew } = useFocusCrew(hostOf(activeHabitId) ?? linkedHost(), focusingNow);
    const focusCompany = useMemo(() => (focusingNow && activeHabitId && focusCrew.length
        ? { id: activeHabitId, faces: focusCrew.map(friend => ({ userId: friend.userId, name: friend.name, avatarUrl: friend.avatarUrl })) } : undefined),
        [focusingNow, activeHabitId, focusCrew]);
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
        // "Now" is this moment, so the next thing is Now at once: in the same
        // render as the tick, not a second full render after it.
        setClock(new Date());
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
    // The day picked on the strip moves at once; the day's content follows a
    // beat behind (useDeferredValue), so a tap never waits for the whole day to
    // be laid out, and tapping through several days skips the ones in between.
    const [pickedDate, setPickedDate] = useState(new Date());
    const selectedDate = useDeferredValue(pickedDate);
    const selectedKey = localDateKey(selectedDate);
    // Switched to another day at least once: from then on a day appears at once, without the
    // opening's rise (components/Roadmap/DayTimeline.tsx appear). Worked out while rendering,
    // so the very first switch is already instant.
    const [seenDay, setSeenDay] = useState(selectedKey);
    const [daySwitched, setDaySwitched] = useState(false);
    if (selectedKey !== seenDay) { setSeenDay(selectedKey); setDaySwitched(true); }
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
    // The Shared filter: one friend (only what you share with them), or everything shared.
    const [sharedWith, setSharedWith] = useState<string | null>(null);
    const sharedFriends = useMemo(() => {
        const found = new Map<string, string>();
        for (const id of habitIds) for (const person of sharedFor(id)?.people ?? []) if (!person.isYou) found.set(person.userId, person.username);
        for (const id of taskIds) for (const person of sharedTaskFor(id)?.people ?? []) if (!person.isYou) found.set(person.userId, person.username);
        return [...found].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [habitIds, taskIds, sharedFor, sharedTaskFor]);

    // UI State
    const [showFilter, setShowFilter] = useState(false);
    // Goals, habits and tasks each on or off, so "tasks and habits, no goals"
    // is one tap. The whole filter is remembered between launches.
    const [shown, setShown] = useState(DEFAULT_ROADMAP_FILTER.shown);
    /** Show only what somebody else is on too. */
    const [sharedOnly, setSharedOnly] = useState(false);
    const [activeSort, setActiveSort] = useState<SortType>('default');
    const [sortDirection, setSortDirection] = useState<1 | -1>(-1);
    const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('all');
    // Timeline (the day in time order, as one flow) or the lists; remembered.
    const [viewChoice, setRoadmapView] = useState<RoadmapView>(() => cachedRoadmapFilter()?.view ?? DEFAULT_ROADMAP_FILTER.view);
    // Timeline or List: two pages of one pager, both built, side by side.
    const roadmapView = viewChoice;
    const filterLoaded = useRef(false);
    // Until the saved view is known nothing is drawn, so one view never flashes before the other.
    const [filterReady, setFilterReady] = useState(() => !!cachedRoadmapFilter());
    useEffect(() => {
        void loadRoadmapFilter().then(saved => {
            setFilterReady(true);
            setShown(saved.shown); setSharedOnly(saved.sharedOnly); setActiveSort(saved.sort);
            // The time of day filter is gone (the timeline shows when): never restored.
            setSortDirection(saved.direction); setActiveTimeFilter('all'); setRoadmapView(saved.view);
            filterLoaded.current = true;
        });
    }, []);
    useEffect(() => {
        if (filterLoaded.current) void saveRoadmapFilter({ shown, sharedOnly, sort: activeSort, direction: sortDirection, time: activeTimeFilter, view: viewChoice });
    }, [shown, sharedOnly, activeSort, sortDirection, activeTimeFilter, viewChoice]);
    const toggleKind = useCallback((kind: ShownKind) => setShown(current => toggleShown(current, kind)), []);
    // Dragging along the day strip: only what is set for that moment is listed,
    // as its real card; nothing set there leaves the list empty.
    // The cards follow a beat behind the finger (useDeferredValue): a fast drag
    // skips the moments it passed through instead of laying out each one in turn.
    const [scrubNow, setScrubIds] = useState<Set<string> | null>(null);
    const scrubIds = useDeferredValue(scrubNow);
    const [selectedGoalFilter, setSelectedGoalFilter] = useState<string | null>(null); // Filter by specific goal ID
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null); // Filter by life pillar
    const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
    // Loaded once here, and re-read whenever a habit is ticked anywhere —
    // this screen used to fetch on mount only and then quietly go stale.
    const { history: pastDone, skips: pastSkips } = useHistory(HISTORY_DAYS);
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
    // On iOS the pill is drawn over the whole window (above the dock and the bar over it, on
    // its way to the bin), so it is placed in window terms; elsewhere, inside the list area.
    const { width: windowWidth } = useWindowDimensions();
    // A goal card's side in the carousel: about two and a bit across (fewer when cards are big), so the next one peeks in.
    const goalTileWidth = Math.floor((windowWidth - 2 * horizontalPadding - Spacing.md) / (cardSize === 'small' ? 2.6 : cardSize === 'big' ? 1.7 : 2.2));
    const dragPreviewStyle = useAnimatedStyle(() => ({
        transform: [
            // Centred on the finger, a little above it so the thumb does not hide it.
            { translateX: WHOLE_WINDOW ? dragX.get() - windowWidth / 2 : dragX.get() - areaX.get() - areaWidth.get() / 2 },
            { translateY: WHOLE_WINDOW ? dragY.get() - 64 : dragY.get() - areaY.get() - 64 },
            { scale: 0.86 + dragLift.get() * 0.14 },
            { rotateZ: `${dragLift.get() * 2}deg` },
        ],
        opacity: dragLift.get(),
    }));
    // "Remove from goal": while something in a goal is dragged, the plus button
    // in the dock becomes the drop target (lib/dragBridge).
    const isOverRemove = useCallback((x: number, y: number, inGoal: boolean) => (inGoal || roadmapView === 'timeline') && isOverOrb(x, y), [roadmapView]);
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
        // Always from the same place: just under the calendar strip, whether
        // it was opened by pulling down or from the filter pill (which moves
        // with the list, and so made the menu open somewhere different each time).
        const area = listAreaRef.current;
        if (!area) { setShowFilter(true); return; }
        area.measureInWindow((x: number, y: number, width: number) => {
            setFilterAnchor({ x, y: y - 4, width, height: 0 });
            setShowFilter(true);
        });
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
    // 1 while armed: the icon snaps to its full size the moment the tap is felt.
    const armedIcon = useSharedValue(0);
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
                armedIcon.value = withTiming(armed ? 1 : 0, ARM);
                if (armed) runOnJS(lightFeedback)();
            }
        },
        onEndDrag: () => {
            if (wasAtTop.value && filterTriggered.value) runOnJS(openFilterModal)();
            // Released: whatever momentum does next is not a pull.
            wasAtTop.value = false;
            filterTriggered.value = false;
            armedIcon.value = 0;
            pull.value = 0;
        },
    });
    // The filter icon that rises out of the pull, the way Transit shows it.
    // Pulling, it grows only part of the way and stays dim; past the line, the
    // moment the tap is felt, it snaps to full size and full strength: let go
    // now and the filter opens. Back above the line, it shrinks again.
    const pullIcon = useAnimatedStyle(() => {
        const growing = interpolate(pull.value, [12, PULL_TO_OPEN], [0.45, 0.7], Extrapolation.CLAMP);
        const faint = interpolate(pull.value, [12, PULL_TO_OPEN], [0, 0.55], Extrapolation.CLAMP);
        const armed = armedIcon.value;
        return {
            opacity: faint + (1 - faint) * armed,
            transform: [
                { translateY: Math.min(pull.value, PULL_TO_OPEN + 20) / 2 - 18 },
                { scale: growing + (1 - growing) * armed },
            ],
        };
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
        return () => { taskSub.remove(); unsubPromise.then(unsub => unsub()); };
    }, []);




    // Each goal's progress: the same number the goal shows on its own page,
    // Home and the goals overview, from the one shared calculation.
    const { insightsById, goals: activeGoals } = useGoalsInsights();
    const goalProgress = useMemo(() => {
        const map: Record<string, number> = {};
        for (const id of Object.keys(insightsById)) map[id] = insightsById[id].progress;
        return map;
    }, [insightsById]);

    // Map habits with completion status - OPTIMIZED: only on data changes
    // Map habits effect removed - redundant O(N) state update

    // Weekly Calcs - OPTIMIZED: only run on mount to prevent JS thread hammering

    const { playComplete } = useSoundEffects();

    const handleDateSelect = useCallback((date: Date) => {
        lightFeedback();
        setPickedDate(date);
    }, [lightFeedback]);

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

        // Habits are ticked on their own day; the rows already refuse the tap on any other.
        if (dateStr !== todayStr) {
            isNavigating.current = false;
            return;
        }

        // A tap ticks anything, timed or not, and a second tap takes it back.
        // In a challenge or a bet, a tick needs proof first (lib/challengeProof.ts).
        const isCompleted = !completions[habit.id];
        if (isCompleted && !(await proveTick({ kind: 'habit', habit }, dateStr))) { isNavigating.current = false; return; }

        // 1. Optimistic Update
        markDone(habit.id, isCompleted, dateStr);

        // 2. Feedback. The Marks orbs leave from your finger now, not once
        // the save comes back (by then the row has often moved on).
        if (isCompleted) {
            const earned = habitDone(habit.id, dateStr, true);
            if (earned && countsShared(habit.id, dateStr)) burstMarks(earned);
            playComplete();
            selectionFeedback(); // Stronger feedback for complete
        } else {
            lightFeedback();
        }

        // 3. Persist - Fire and forget (no await) for instant response
        toggleCompletion(habit.id, dateStr).catch(e => {
            // Revert on error
            markDone(habit.id, !isCompleted, dateStr);
            Alert.alert(oopsTitle(), 'Your check-in was not saved. Please try again.');
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
            Alert.alert(oopsTitle(), 'This skip was not saved. Please try again.');
        }
    }, [skipped, selectedDate, selectionFeedback, markSkipped]);

    const handleTaskToggle = useCallback(async (task: Task) => {
        if (task.status !== 'done' && !(await proveTick({ kind: 'task', task }, todayKey()))) return;
        if (task.status !== 'done') {
            const day = todayKey();
            // Done early pays more (lib/taskSpeed.ts); the same reckoning setTaskStatus keeps.
            const speed = speedForTask(task);
            const earned = taskEarned(task.id, day, true, speed);
            if (earned && countsShared(task.id, day)) burstMarks(earned, null, speedLabel(speed));
        }
        // Shown at once, with the tap felt at once; put back if the save fails.
        const next = task.status === 'done' ? 'open' : 'done';
        const completedAt = next === 'done' ? new Date().toISOString() : undefined;
        setTasks(current => current.map(item => (item.id === task.id ? { ...item, status: next, completedAt } : item)));
        setClock(new Date());
        // The sound comes from the task_completed event (hooks/useAppSounds), so it plays once.
        if (next === 'done') successFeedback(); else lightFeedback();
        try {
            await setTaskStatus(task.id, next, completedAt);
            emit('tasks_changed');
        } catch {
            setTasks(current => current.map(item => (item.id === task.id ? task : item)));
            Alert.alert(oopsTitle(), 'Please try again.');
        }
    }, [successFeedback, lightFeedback]);

    // Deleting asks first, everywhere (hooks/useRemoveTask.ts); the row is back in place if you cancel.
    const askRemoveTask = useRemoveTask();
    const handleTaskDelete = useCallback((task: Task) => { askRemoveTask(task); }, [askRemoveTask]);

    const openTask = useCallback((task: Task) => {
        emit('show_task_form', { task });
    }, []);

    const askRemoveHabit = useRemoveHabit();
    const handleDelete = async (habit: Habit) => {
        // A goal takes its whole plan with it, which is more than one swipe
        // should be allowed to decide.
        if (habit.isGoal) {
            Alert.alert('Delete goal', 'This removes the goal and everything planned under it.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void removeHabitEverywhere(habit.id) },
            ]);
            return;
        }
        // It repeats, so the swipe asks which: today, from today, or all of it.
        askRemoveHabit(habit);
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
    /** The row being dragged right now ("habit:<id>", "task:<id>"); a drop for anything else is ignored. */
    const dragOwner = useRef<string | null>(null);
    /** Where the hold began: let go without dragging, and it was a hold (pin it), not a drag. */
    const dragFrom = useRef({ x: 0, y: 0 });
    /** Pins what was held still on the timeline (set once the timeline is worked out, below). */
    const pinOnHold = useRef<(id: string) => void>(() => undefined);
    // Timeline view: where a held habit or task would land (components/Roadmap/DayTimeline.tsx).
    const timelineDrop = useRef<TimelineDrop | null>(null);
    const dropMinute = useRef<number | null>(null);
    /** On the line, the drag goes to a time: a light tap each time the landing spot changes. */
    const trackDropTime = useCallback((id: string, y: number) => {
        const minute = timelineDrop.current?.timeAt(y, id) ?? null;
        if (minute !== dropMinute.current) { dropMinute.current = minute; if (minute !== null) selectionFeedback(); }
    }, [selectionFeedback]);
    const EDGE = 96;
    /** Points the finger may move and still count as held, not dragged. */
    const HOLD_STILL = 12;
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
        dragOwner.current = `habit:${habit.id}`;
        dragFrom.current = { x, y };
        selectionFeedback();
        setDraggingHabit(habit);
        dropMinute.current = null;
        if (roadmapView === 'timeline') void timelineDrop.current?.measure();
        setRemoveDrag({ active: !!habit.goalId || roadmapView === 'timeline', kind: roadmapView === 'timeline' ? 'delete' : 'unlink', label: roadmapView === 'timeline' ? 'Delete habit' : 'Remove from goal' });
        measureArea();
        measureViewport();
        dragY.set(y);
        dragX.set(x);
        dragLift.set(withSpring(1, { damping: 18, stiffness: 260 }));
        const currentGoals = habitsStore.filter((item) => item.isGoal) as Habit[];
        await measureGoalDropTargets(currentGoals);
        if (dragOwner.current !== `habit:${habit.id}`) return;
        const initial = getHoveredGoalAtPoint(x, y);
        hoveredGoalRef.current = initial;
        setHoveredGoalId(initial);
    }, [measureGoalDropTargets, getHoveredGoalAtPoint, selectionFeedback, habitsStore, dragX, dragY, dragLift, measureArea, measureViewport, roadmapView]);

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
    }, [getHoveredGoalAtPoint, selectionFeedback, dragX, dragY, isOverRemove, trackRemove, followFinger, roadmapView, trackDropTime]);

    const handleHabitDragEnd = useCallback(async (habit: Habit, x: number, y: number) => {
        // Only the drag that is under way ends in a drop; anything else is ignored.
        if (dragOwner.current !== `habit:${habit.id}`) return;
        dragOwner.current = null;
        stopFollowing();
        const removing = isOverRemove(x, y, !!habit.goalId);
        // Where the goals are now, not where they were when the drag began.
        if (!removing) await measureGoalDropTargets(habitsStore.filter(item => item.isGoal) as Habit[]);
        const targetGoalId = removing ? null : getHoveredGoalAtPoint(x, y);

        // The card settles back into the list instead of vanishing mid-air.
        dragLift.set(withTiming(0, { duration: 170 }));
        setDraggingHabit(null);
        hoveredGoalRef.current = null;
        setHoveredGoalId(null);
        setRemoveDrag({ active: false });

        // Dropped on the bin: the same question as a swipe (skip today, stop, or delete).
        if (removing && roadmapView === 'timeline') {
            lightFeedback();
            askRemoveHabit(habit);
            return;
        }
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

        // On the line, nothing moves by dragging (the day places everything itself): a drag
        // is only for the bin. Held and let go where it was: it was a hold, so pin it at a time.
        if (roadmapView === 'timeline') {
            if (Math.hypot(x - dragFrom.current.x, y - dragFrom.current.y) < HOLD_STILL) pinOnHold.current(habit.id);
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
    }, [getHoveredGoalAtPoint, lightFeedback, dragLift, isOverRemove, trackRemove, stopFollowing, measureGoalDropTargets, habitsStore, roadmapView, askRemoveHabit, autoReschedule, mediumFeedback]);

    /**
     * Tasks move between goals exactly like habits: hold one, drag it onto a
     * goal, let go. The drop targets and the floating preview are shared, so
     * both kinds of row behave the same.
     */
    const handleTaskDragStart = useCallback(async (task: Task, x: number, y: number) => {
        dragOwner.current = `task:${task.id}`;
        dragFrom.current = { x, y };
        selectionFeedback();
        setDraggingTask(task);
        dropMinute.current = null;
        if (roadmapView === 'timeline') void timelineDrop.current?.measure();
        setRemoveDrag({ active: !!task.goalId || roadmapView === 'timeline', kind: roadmapView === 'timeline' ? 'delete' : 'unlink', label: roadmapView === 'timeline' ? 'Delete task' : 'Remove from goal' });
        measureArea();
        measureViewport();
        dragY.set(y);
        dragX.set(x);
        dragLift.set(withSpring(1, { damping: 18, stiffness: 260 }));
        await measureGoalDropTargets(habitsStore.filter(item => item.isGoal) as Habit[]);
        if (dragOwner.current !== `task:${task.id}`) return;
        const initial = getHoveredGoalAtPoint(x, y);
        hoveredGoalRef.current = initial;
        setHoveredGoalId(initial);
    }, [measureGoalDropTargets, getHoveredGoalAtPoint, selectionFeedback, habitsStore, dragX, dragY, dragLift, measureArea, measureViewport, roadmapView]);

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
    }, [getHoveredGoalAtPoint, selectionFeedback, dragX, dragY, isOverRemove, trackRemove, followFinger, roadmapView, trackDropTime]);

    const handleTaskDragEnd = useCallback(async (task: Task, x: number, y: number) => {
        if (dragOwner.current !== `task:${task.id}`) return;
        dragOwner.current = null;
        stopFollowing();
        const removing = isOverRemove(x, y, !!task.goalId);
        if (!removing) await measureGoalDropTargets(habitsStore.filter(item => item.isGoal) as Habit[]);
        const targetGoalId = removing ? null : getHoveredGoalAtPoint(x, y);
        dragLift.set(withTiming(0, { duration: 170 }));
        setDraggingTask(null);
        hoveredGoalRef.current = null;
        setHoveredGoalId(null);
        setRemoveDrag({ active: false });

        if (removing && roadmapView === 'timeline') {
            lightFeedback();
            askRemoveTask(task);
            return;
        }
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

        // On the line, nothing moves by dragging (the day places everything itself): a drag
        // is only for the bin. Held and let go where it was: it was a hold, so pin it at a time.
        if (roadmapView === 'timeline') {
            if (Math.hypot(x - dragFrom.current.x, y - dragFrom.current.y) < HOLD_STILL) pinOnHold.current(task.id);
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
    }, [getHoveredGoalAtPoint, lightFeedback, dragLift, isOverRemove, trackRemove, stopFollowing, measureGoalDropTargets, habitsStore, roadmapView, askRemoveTask, autoReschedule, mediumFeedback]);

    const toggleGoalExpansion = (goalId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        // One goal's plan open at a time, under the carousel.
        setExpandedGoals(prev => (prev[goalId] ? {} : { [goalId]: true }));
        selectionFeedback();
    };

    // --- Grouping Logic ---
    // Goals still under way: a goal reached (or archived) has no card.
    const goals = activeGoals;
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
            filtered = filtered.filter(h => { const state = sharedFor(h.id); return !!state && (!sharedWith || state.people.some(p => p.userId === sharedWith)); });
        }

        const order = compareBySort(activeSort, sortDirection);
        filtered.sort((a, b) => order({ ...a, done: !!completions[a.id] }, { ...b, done: !!completions[b.id] }));
        const byGoal: Record<string, Habit[]> = {};

        filtered.forEach(h => {
            if (h.goalId) {
                if (!byGoal[h.goalId]) byGoal[h.goalId] = [];
                byGoal[h.goalId].push(h);
            }
        });

        return { allHabits: filtered, habitsByGoal: byGoal };
    }, [habitsStore, selectedDate, selectedGoalFilter, selectedCategoryFilter, activeTimeFilter, activeSort, sortDirection, completions, sharedOnly, sharedFor, sharedWith]);

    // Habits are already filtered to the day being looked at; tasks were not,
    // so everything ever written sat in every day's list. A task belongs to the
    // day it was given, plus today for anything late or undated.
    const dayTasks = useMemo(() => {
        const day = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const planned = tasksForDay(tasks, day, todayKey());
        // Open tasks due by this day but planned for another are listed too, like any task (their row says Due today).
        const listed = new Set(planned.map(task => task.id));
        const due = [...planned, ...tasks.filter(task => task.status === 'open' && task.deadline === day && !listed.has(task.id))];
        // "Shared only" means the whole plan, not only its rhythms: a filter
        // that hid shared habits' neighbours but left every private task in
        // place would not be showing what is shared.
        const shownTasks = sharedOnly ? due.filter(task => { const state = sharedTaskFor(task.id); return !!state && (!sharedWith || state.people.some(p => p.userId === sharedWith)); }) : due;
        // Created keeps the day's own order (by when it is due); the others sort as habits and goals do.
        if (activeSort === 'default') return shownTasks;
        const order = compareBySort(activeSort, sortDirection);
        return [...shownTasks].sort((a, b) => order({ ...a, name: a.title, done: a.status === 'done' }, { ...b, name: b.title, done: b.status === 'done' }));
    }, [tasks, selectedDate, sharedOnly, sharedTaskFor, activeSort, sortDirection, sharedWith]);

    // The waking day, as set in Notifications; re-read whenever the tab shows.
    const [dayWindow, setDayWindow] = useState<DayWindow>(() => cachedDayWindow() ?? DEFAULT_DAY);
    // Until the real waking day is read, the default (7:00) must not shape the saved layout.
    const [dayWindowReady, setDayWindowReady] = useState(() => !!cachedDayWindow());
    useFocusEffect(useCallback(() => {
        // The same hours keep the same object: a new one re-laid the whole day
        // out (and redrew the timeline) on every visit to the tab.
        getDayWindow().then(window => {
            setDayWindow(was => (was.wake === window.wake && was.sleep === window.sleep ? was : window));
            setDayWindowReady(true);
        }).catch(() => setDayWindowReady(true));
    }, []));
    // A minute is fine enough for "time left", and keeps the card still.
    const [clock, setClock] = useState(() => new Date());
    useEffect(() => {
        // On the minute, so the line moves on the moment something's time is up (as the bar over the tab bar does).
        let timer: ReturnType<typeof setInterval> | undefined;
        const align = setTimeout(() => { setClock(new Date()); timer = setInterval(() => setClock(new Date()), 60_000); }, 60_000 - (Date.now() % 60_000) + 50);
        // Back from the background: the time now, not when it was left.
        const sub = AppState.addEventListener('change', state => { if (state === 'active') setClock(new Date()); });
        return () => { clearTimeout(align); if (timer) clearInterval(timer); sub.remove(); };
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
        // Every day the history covers, so going back weeks on the strip still
        // shows how each day went, not only this week and last.
        for (let offset = -HISTORY_DAYS; offset <= 7; offset++) {
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
    const scrubbing = scrubIds !== null;
    // The day as one flow (lib/dayFlow.ts): everything with a time in order,
    // the one you are on first, the rest moved up or back as the day goes.
    const meals = useMeals();
    const flexibleMeals = useMealsFlexible();
    // Where each thing was placed today, so done things stay put and moves get a dot.
    const memory = useDayMemory();
    const calendarEvents = useCalendarEvents(localDateKey(selectedDate));
    // Travel to and from events (tap an event to set it): kept free of work.
    const eventTravel = useEventTravel();
    const [eventSheet, setEventSheet] = useState<{ id: string; title: string; start: number; end: number } | null>(null);
    // Held on the timeline: pin it at an exact time (components/Roadmap/PinSheet.tsx).
    const [pinning, setPinning] = useState<(FlowInput & { start: number }) | null>(null);
    // Your best hours: learnt hour by hour from energy answers and focus
    // sessions (lib/energyCurve.ts); until that is clear, Echo's patterns.
    // Hard things are fitted in there.
    const patterns = useEchoPatterns();
    const checkIns = useCheckIns();
    const focusRecords = useFocusRecords();
    const peak = useMemo(() => energyCurve({
        checkIns: checkIns.entries, focus: focusRecords, now: new Date(), wake: minutesOf(dayWindow.wake), sleep: minutesOf(dayWindow.sleep),
    }).peak ?? peakWindow(patterns), [patterns, checkIns, focusRecords, dayWindow]);
    const flowNow = dayPlan.isToday ? clock.getHours() * 60 + clock.getMinutes() : null;
    const flowWindow = useMemo(() => ({ wake: minutesOf(dayWindow.wake), sleep: minutesOf(dayWindow.sleep), peak, active: activeHabitId }), [dayWindow, peak, activeHabitId]);
    // When each habit was ticked on the day shown, so a done one sits where it was really done.
    const { times: doneTimes, ready: doneTimesReady } = useDoneTimes(localDateKey(selectedDate), completions);
    // Swiped to reschedule today (rule 5, lib/dayFlow.ts).
    const rescheduled = useReschedules(localDateKey(selectedDate));
    const ended = useEndedEarly(localDateKey(selectedDate));
    const flowItems = useMemo(() => {
        const day = localDateKey(selectedDate);
        const habits = habitsStore.filter(h => !h.isGoal && !h.isArchived && isHabitScheduledForDate(h, selectedDate)) as StoreHabit[];
        // Meals and calendar events are fixed; the rest flows, and whatever has
        // no time is given a slot by urgency between waking and bedtime.
        return flowInputs({
            habits, tasks: tasksForDay(tasks, day, todayKey(clock)), done: completions, doneTimes, day, meals: mealSlots(meals), events: calendarEvents, travel: eventTravel,
            today: todayKey(clock), flexibleMeals, kept: memory.day === day ? memory.slots : undefined, planned: memory.day === day ? memory.planned : undefined,
            lapsed: memory.day === day ? memory.lapsed : undefined, wasDone: memory.day === day ? memory.done : undefined, again: memory.day === day ? memory.again : undefined,
            rescheduled, ended,
        });
    }, [habitsStore, tasks, completions, selectedDate, clock, meals, calendarEvents, eventTravel, flexibleMeals, memory, doneTimes, rescheduled, ended]);
    const flow = useMemo(() => flowDay(flowItems, flowNow, flowWindow, { auto: autoReschedule }), [flowItems, flowNow, flowWindow, autoReschedule]);
    // Whether this flow was built from everything it needs: the stored layout,
    // the tick times and the waking day. Saving one built before they arrived
    // is what once moved every ticked thing to the morning after a reload.
    // (Read during this render, so a save never uses a flow built a moment before they loaded.)
    const flowComplete = memoryReady() && doneTimesReady && dayWindowReady;
    // Today's timeline as shown, for everything worked out off this screen
    // (Focus from the + button, reminders, the Live Activity), so they agree with it.
    useEffect(() => {
        if (!dayPlan.isToday || !flowComplete) return;
        (require('@/lib/todayFlow') as typeof import('@/lib/todayFlow')).rememberTodayFlow(localDateKey(selectedDate), flow, flowWindow.peak ?? null);
    }, [dayPlan.isToday, flowComplete, flow, flowWindow.peak, selectedDate]);
    // Once shown it stays: switching days must not blank it while the next day's tick times are read.
    const timelineShown = useRef(false);
    if (flowComplete) timelineShown.current = true;
    // Open tasks whose "due by" is this day but which are planned for another:
    // named at the top of the day so the deadline is seen.
    const dueToday = useMemo(() => {
        const day = localDateKey(selectedDate);
        const shown = new Set(flowItems.map(item => item.id));
        return flowInputs({ habits: [], tasks: tasks.filter(task => task.status === 'open' && task.deadline === day && !shown.has(task.id)), done: {} });
    }, [tasks, selectedDate, flowItems]);
    // Today's flow is remembered as it changes, and Echo is told when the
    // thing you are on would run out, so it can say where it went.
    useEffect(() => {
        if (flowNow === null || !flowComplete) return;
        // Nothing is moved to another day: a full day is fitted by cutting the
        // biggest things short (lib/dayFlow.ts), and a task not done stays open.
        rememberFlow(localDateKey(selectedDate), flow, flowNow);
        void schedulePlanAlert(planAlert(flowItems, flow, flowNow, flowWindow));
        // The Lock Screen card follows this timeline, the one truth.
        setTodayFlow(localDateKey(selectedDate), flow);
    }, [flow, flowItems, flowNow, flowWindow, selectedDate, flowComplete]);
    // The strip at the top shows the same day as the timeline: placed things included.
    const stripPlan = useMemo(() => ({
        ...dayPlan.plan,
        // Everything on the line: habits, tasks, meals and the calendar (events, reminders, the travel
        // either side of an event). Meals too, so a break shows as a break, not as a gap.
        blocks: flow.timeline.map(item => ({
            id: item.part ? `${item.id}#${item.part.index}` : item.id, kind: item.kind, title: item.title, start: item.start, end: item.end, done: item.done, color: item.color,
            ...(item.kind === 'event' && isTravel(item.id) ? { travel: true } : null),
        })),
    }), [dayPlan.plan, flow]);
    // Dragging along the strip in the timeline: only what is on then.
    const shownFlow = useMemo(() => scrubIds === null ? flow
        : { ...flow, timeline: flow.timeline.filter(item => scrubIds.has(`${item.kind}:${item.part ? `${item.id}#${item.part.index}` : item.id}`)) }, [flow, scrubIds]);
    const toggleFlowItem = useCallback((item: FlowInput) => {
        // A meal or event that finished early (class let out, supper done): it ends now, or that is taken back.
        if (item.kind === 'meal' || item.kind === 'event') {
            const now = new Date();
            void toggleEndedEarly(localDateKey(now), item.id, now.getHours() * 60 + now.getMinutes());
            return;
        }
        if (item.kind === 'habit') { const habit = habitsStore.find(h => h.id === item.id); if (habit) void handleHabitPress(habit as Habit); }
        else { const task = tasks.find(t => t.id === item.id); if (task) void handleTaskToggle(task); }
    }, [habitsStore, tasks, handleHabitPress, handleTaskToggle]);
    // Pinned: at that exact time, held there like a meal (lib/dayFlow.ts rule 3). A habit with an
    // end time keeps its length. Unpinned: back into the flow, keeping its time as a hint.
    const pinFlowItem = useCallback(async (item: FlowInput, minute: number | null) => {
        const flexible = minute === null;
        if (item.kind === 'habit') {
            const habit = habitsStore.find(h => h.id === item.id);
            if (!habit) return;
            const length = Math.max(1, item.minutes || 30);
            const patch = flexible ? { flexible: true } : { startTime: clockOf(minute), ...(habit.endTime ? { endTime: clockOf(Math.min(minute + length, 24 * 60 - 1)) } : null), flexible: false };
            setHabitsStore(items => items.map(entry => entry.id === habit.id ? { ...entry, ...patch } : entry));
            mediumFeedback();
            try { await updateHabit({ id: habit.id, ...patch }); }
            catch {
                setHabitsStore(items => items.map(entry => entry.id === habit.id ? { ...entry, startTime: habit.startTime, endTime: habit.endTime, flexible: habit.flexible } : entry));
                Alert.alert('Could not change its time', 'It is still where it was. Please try again.');
            }
        } else if (item.kind === 'task') {
            const task = tasks.find(entry => entry.id === item.id);
            if (!task) return;
            const patch = flexible ? { flexible: true } : { dueTime: clockOf(minute), flexible: false };
            setTasks(items => items.map(entry => entry.id === task.id ? { ...entry, ...patch } : entry));
            mediumFeedback();
            try { await updateTask(task.id, patch); emit('tasks_changed'); }
            catch {
                setTasks(items => items.map(entry => entry.id === task.id ? task : entry));
                Alert.alert('Could not change its time', 'It is still where it was. Please try again.');
            }
        }
    }, [habitsStore, tasks, setHabitsStore, setTasks, mediumFeedback]);
    const holdFlowItem = useCallback((item: FlowInput) => {
        const row = flow.timeline.find(entry => entry.id === item.id);
        selectionFeedback();
        setPinning({ ...item, start: row?.start ?? flowNow ?? 9 * 60 });
    }, [flow, flowNow, selectionFeedback]);
    useEffect(() => { pinOnHold.current = (id: string) => { const row = flow.timeline.find(entry => entry.id === id); if (row) holdFlowItem(row); }; }, [flow, holdFlowItem]);
    const openFlowItem = useCallback((item: FlowInput) => {
        lightFeedback();
        markSeen(item.id);
        // A calendar event (or the travel either side of it): how long it takes
        // to get there and back, with Calendar one tap further.
        if (item.kind === 'event') {
            const eventId = item.id.replace(/:(to|back)$/, '').replace(/^event:/, '');
            const event = calendarEvents.find(slot => slot.id === eventId);
            if (event) setEventSheet({ id: event.id, title: event.title, start: event.start, end: event.start + event.minutes });
            else openInCalendar(localDateKey(selectedDate), item.start ?? 0);
        }
        else if (item.kind === 'meal') router.push('/(root)/meals' as never);
        else if (item.kind === 'habit') router.push({ pathname: '/habit-detail', params: { habitId: item.id } });
        else { const task = tasks.find(t => t.id === item.id); if (task) openTask(task); }
    }, [tasks, openTask, lightFeedback, router, selectedDate, calendarEvents]);
    const focusFlowItem = useCallback((item: FlowInput) => {
        mediumFeedback();
        void (require('@/lib/openFocus') as typeof import('@/lib/openFocus')).openFocus({ kind: item.kind, id: item.id, title: item.title });
    }, [mediumFeedback, router]);
    // The list's rows are memoised (React.memo): they get handlers that never
    // change identity but always run the latest code, so a tick re-renders the
    // row that changed, not every row on the page.
    const rowHabitToggle = useLatestCallback((habit: Habit) => { void handleHabitPress(habit); });
    const rowHabitOpen = useLatestCallback((habit: Habit) => router.push({ pathname: '/habit-detail', params: { habitId: habit.id } }));
    const rowHabitSkip = useLatestCallback((habit: Habit) => handleHabitSkip(habit as StoreHabit));
    const rowHabitEdit = useLatestCallback((habit: Habit) => handleEdit(habit));
    const rowHabitDelete = useLatestCallback((habit: Habit) => { void handleDelete(habit); });
    const rowHabitDragStart = useLatestCallback((habit: Habit, x: number, y: number) => { void handleHabitDragStart(habit, x, y); });
    const rowHabitDragMove = useLatestCallback((habit: Habit, x: number, y: number) => handleHabitDragMove(habit, x, y));
    const rowHabitDragEnd = useLatestCallback((habit: Habit, x: number, y: number) => { void handleHabitDragEnd(habit, x, y); });
    const rowTaskToggle = useLatestCallback((task: Task) => { void handleTaskToggle(task); });
    const rowTaskOpen = useLatestCallback((task: Task) => openTask(task));
    const rowTaskDelete = useLatestCallback((task: Task) => handleTaskDelete(task));
    const rowTaskDragStart = useLatestCallback((task: Task, x: number, y: number) => { void handleTaskDragStart(task, x, y); });
    const rowTaskDragMove = useLatestCallback((task: Task, x: number, y: number) => handleTaskDragMove(task, x, y));
    const rowTaskDragEnd = useLatestCallback((task: Task, x: number, y: number) => { void handleTaskDragEnd(task, x, y); });
    const timelineView = roadmapView === 'timeline';
    // The two views as two pages side by side, in the order the filter shows them: Timeline
    // on the left, List on the right. A native pager, like the week strip: iOS moves the
    // pages under the finger (nothing in JavaScript per frame), the next one revealed as you
    // drag, and lets go onto a page. The pager is only as tall as the page shown, so the
    // shorter one never leaves an empty scroll below it; while dragging it is as tall as both.
    const pageAt = timelineView ? 0 : 1;
    const pagerRef = useRef<GHScrollView>(null);
    const [pageHeights, setPageHeights] = useState<[number, number]>([0, 0]);
    const [paging, setPaging] = useState(false);
    const pagerAt = useRef(pageAt);
    const gliding = useRef(false);
    // Only the page you are on keeps up with every change (a new day, a tick); the other stays
    // on screen as it was (Frozen, above the screen) and catches up the moment a drag starts, so
    // changing day costs one view, not two. Not React's Activity: hiding and showing a page on
    // every swipe, under animations still running in it, crashed the app (a Fabric mount on the
    // UI thread touching a view that had just been hidden).
    const pageLive = (index: 0 | 1) => paging || pageAt === index;
    const measurePage = useCallback((index: 0 | 1, height: number) => {
        setPageHeights(previous => Math.abs(previous[index] - height) < 1 ? previous : (index === 0 ? [height, previous[1]] : [previous[0], height]));
    }, []);
    // Chosen in the filter: the pager glides there.
    useEffect(() => {
        if (pagerAt.current === pageAt) return;
        pagerAt.current = pageAt;
        // Both pages drawn for the glide; its end (onMomentumScrollEnd) hides the one left behind.
        gliding.current = true;
        setPaging(true);
        pagerRef.current?.scrollTo({ x: pageAt * windowWidth, animated: true });
        // In case the glide's end is never reported: settle anyway.
        const settle = setTimeout(() => { gliding.current = false; onPageSettledRef.current(pageAt * windowWidth); }, 700);
        return () => clearTimeout(settle);
    }, [pageAt, windowWidth]);
    const onPageSettled = useCallback((x: number) => {
        setPaging(false);
        const index = Math.round(x / Math.max(1, windowWidth)) === 0 ? 0 : 1;
        if (index === pagerAt.current) return;
        pagerAt.current = index;
        (require('@/components/ui/SwipeRow') as typeof import('@/components/ui/SwipeRow')).closeOpenRow();
        selectionFeedback();
        setRoadmapView(index === 0 ? 'timeline' : 'list');
    }, [windowWidth, selectionFeedback]);
    const onPageSettledRef = useRef(onPageSettled);
    useLayoutEffect(() => { onPageSettledRef.current = onPageSettled; });
    const pagerHeight = paging ? Math.max(pageHeights[0], pageHeights[1]) : pageHeights[pageAt];

    // Goals are off for now (constants/features.ts): their section never shows.
    const showGoals = GOALS_ENABLED && shown.goals && !scrubbing;
    const showHabits = shown.habits || scrubbing;
    const showTasks = shown.tasks || scrubbing;
    /** Habits and tasks under a goal sit inside its card; with goals hidden they are listed on their own. */
    const looseOnly = showGoals;
    // What the finger is over, by whole item: a split one is named by its parts (`id#2`) on the bar.
    const scrubbed = scrubbing ? new Set([...scrubIds].map(key => key.split('#')[0])) : null;
    const listedTasks = scrubbed ? dayTasks.filter(task => scrubbed.has(`task:${task.id}`))
        : dayTasks.filter(task => !looseOnly || !task.goalId);
    const listedHabits = scrubbed ? allHabits.filter(habit => scrubbed.has(`habit:${habit.id}`))
        : looseOnly ? looseHabits : allHabits;
    const filtered = isFiltered({ shown, sharedOnly, sort: activeSort, direction: sortDirection, time: activeTimeFilter, view: roadmapView });
    const hasActiveFilters = selectedGoalFilter !== null || selectedCategoryFilter !== null || sharedOnly;

    const activeGoalName = selectedGoalFilter ? goals.find(g => g.id === selectedGoalFilter)?.name : null;
    const visibleHabitCount = showGoals
        ? looseHabits.length + Object.values(habitsByGoal).flat().length
        : allHabits.length;
    const visibleGoalCount = !showGoals
        ? 0
        : goals.filter(goal => activeTimeFilter === 'all' || (habitsByGoal[goal.id] || []).length > 0).length;
    const activeFilterCount = [
        !shown.goals || !shown.habits || !shown.tasks,
        activeSort !== 'default',
        activeTimeFilter !== 'all',
        !!selectedGoalFilter,
        !!selectedCategoryFilter,
    ].filter(Boolean).length;

    const resetFilters = useCallback(() => {
        selectionFeedback();
        setShown(DEFAULT_ROADMAP_FILTER.shown);
        setActiveSort('default');
        setSortDirection(-1);
        setSelectedGoalFilter(null);
        setSelectedCategoryFilter(null);
        setActiveTimeFilter('all');
        setSharedOnly(false);
    }, [selectionFeedback]);

    // A yellow dot under each day a task must be done by, a white one under
    // each day a milestone is due (components/Home/CalendarStrip.tsx).
    const milestoneDays = useMilestoneDays();
    const dayMarks = useMemo(() => {
        const marks: Record<string, DayMarks> = {};
        for (const task of tasks) {
            if (task.deadline && task.status === 'open') marks[task.deadline] = { ...marks[task.deadline], deadline: true };
        }
        for (const day of milestoneDays) marks[day] = { ...marks[day], milestone: true };
        return marks;
    }, [tasks, milestoneDays]);
    const sortedGoals = useMemo(() => goals
        .filter(goal => (!selectedGoalFilter || goal.id === selectedGoalFilter) && (activeTimeFilter === 'all' || (habitsByGoal[goal.id] || []).length > 0))
        .sort((a, b) => {
            if (activeSort === 'progress') return sortDirection * ((goalProgress[a.id] || 0) - (goalProgress[b.id] || 0));
            return compareBySort(activeSort, sortDirection)(a, b);
        }), [goals, activeSort, sortDirection, goalProgress, selectedGoalFilter, activeTimeFilter, habitsByGoal]);

    // The tour's "Plan inside your goal": Roadmap shows its list, where goals
    // hold their habits and tasks, and goes back to how it was when the tour ends.
    useEffect(() => registerTarget('roadmap-goal', () => new Promise(resolve => {
        const first = sortedGoals[0];
        const view = first ? goalRefs.current[first.id] : null;
        if (!view) { resolve(null); return; }
        view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
    })), [sortedGoals]);
    const viewBeforeTour = useRef<RoadmapView | null>(null);
    useEffect(() => {
        const show = on('tour_roadmap_list', () => {
            setRoadmapView(view => { viewBeforeTour.current ??= view; return 'list'; });
            setExpandedGoals(open => sortedGoals[0] ? { ...open, [sortedGoals[0].id]: true } : open);
        });
        const end = on('tour_end', () => {
            if (viewBeforeTour.current) setRoadmapView(viewBeforeTour.current);
            viewBeforeTour.current = null;
        });
        return () => { show.remove(); end.remove(); };
    }, [sortedGoals]);

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={{ flex: 1, position: 'relative' }}>

                    {/* Layer 1: Calendar Strip */}
                    <View style={{ zIndex: 10 }}>
                        <CalendarStrip
                            selectedDate={pickedDate}
                            onSelectDate={handleDateSelect}
                            completionData={weeklyCompletions}
                            goalDeadlines={useMemo(() => {
                                // Every goal due on a day, so two finishing together both show.
                                const map: Record<string, { color: string; icon?: string; name: string }[]> = {};
                                for (const g of goals) {
                                    if (!g.targetDate) continue;
                                    (map[g.targetDate] ??= []).push({ color: g.color || accentColor, icon: g.icon, name: g.name });
                                }
                                return map;
                            }, [goals, accentColor])}
                            dayMarks={dayMarks}
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
                            scrollEnabled={!draggingHabit && !draggingTask}
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
                                plan={stripPlan}
                                isToday={dayPlan.isToday}
                                accent={accentColor}
                                onScrub={setScrubIds}
                            />



                            {/* The "shared with you" carousel is gone. An
                                offer waits in the inbox to be accepted or
                                turned down, and once accepted the thing is
                                simply in the list with the faces of whoever
                                else is on it — which is where somebody looks
                                for their own habits anyway. */}

                            {/* Both views are pages of one pager (Timeline, then List), swiped like the week strip. */}
                            {!filterReady ? null : (<>
                            <GHScrollView
                                ref={pagerRef}
                                horizontal
                                pagingEnabled
                                bounces={false}
                                directionalLockEnabled
                                showsHorizontalScrollIndicator={false}
                                scrollEnabled={!scrubbing && !draggingHabit && !draggingTask}
                                contentOffset={{ x: pageAt * windowWidth, y: 0 }}
                                onScrollBeginDrag={() => { gliding.current = false; setPaging(true); }}
                                onMomentumScrollBegin={() => { gliding.current = true; }}
                                // Let go with no glide (slowly, right on a page): settle here, as a glide's end would.
                                onScrollEndDrag={event => { const x = event.nativeEvent.contentOffset.x; setTimeout(() => { if (!gliding.current) onPageSettled(x); }, 120); }}
                                onMomentumScrollEnd={event => { gliding.current = false; onPageSettled(event.nativeEvent.contentOffset.x); }}
                                style={[styles.pager, { marginHorizontal: -horizontalPadding, width: windowWidth }, pagerHeight > 0 ? { height: pagerHeight } : null]}
                                contentContainerStyle={styles.pagerRow}
                            >
                            <View style={{ width: windowWidth, paddingHorizontal: horizontalPadding }} onLayout={event => measurePage(0, event.nativeEvent.layout.height)}>
                            <Frozen live={pageLive(0)}>
                                {/* Drawn once it has all it needs (the kept layout, the tick
                                    times, the waking day): drawn before, it laid the day out
                                    twice and the rows jumped into place in front of you. */}
                                {/* Not remounted per day: rows on both days stay and update in place, a new
                                    one fades in at once, so switching days mid-scroll never waits on rows
                                    rising in from the top of the day. */}
                                {!flowComplete && !timelineShown.current ? <View style={styles.timelineWait} /> : <LayoutAnimationConfig key={localDateKey(selectedDate)} skipExiting>
                                <CalendarPrompt />
                                {/* One timeline per day, keyed on the wrapper above so its skipExiting holds: the old day's rows
                                    go at once instead of fading out over the new ones (two days on top of each other, flickering).
                                    One timeline per day: another day replaces this one at once, with nothing fading or gliding
                                    (rows of two days animating together read as broken). Only the first day the page opens on rises in. */}
                                <DayTimeline appear={daySwitched ? 'instant' : 'rise'} flow={shownFlow} day={localDateKey(selectedDate)} now={flowNow} moved={flowNow !== null ? memory.moved : undefined} scrubbing={scrubbing}
                                    wake={flowWindow.wake} sleep={flowWindow.sleep} dueToday={dueToday}
                                    onToggle={toggleFlowItem} onOpen={openFlowItem} onFocus={focusFlowItem}
                                    onPin={dayPlan.isToday ? holdFlowItem : undefined} why={flowNow !== null ? memory.why : undefined}
                                    // Held and dragged: only to the bin (the + turns into it) to delete. Held still: pin it.
                                    onDrag={(phase, item, x, y) => {
                                        if (item.kind === 'habit') {
                                            const habit = habitsStore.find(h => h.id === item.id);
                                            if (habit) void ({ start: handleHabitDragStart, move: handleHabitDragMove, end: handleHabitDragEnd }[phase])(habit, x, y);
                                        } else if (item.kind === 'task') {
                                            const task = tasks.find(t => t.id === item.id);
                                            if (task) void ({ start: handleTaskDragStart, move: handleTaskDragMove, end: handleTaskDragEnd }[phase])(task, x, y);
                                        }
                                    }}
                                    onDragCancel={() => {
                                        dragOwner.current = null; stopFollowing(); dragLift.set(0);
                                        setDraggingTask(null); setDraggingHabit(null); setRemoveDrag({ active: false });
                                    }}
                                    dropRef={timelineDrop}
                                    company={focusCompany}
                                    sharedFor={item => (item.kind === 'habit' ? sharedFor(item.id) : item.kind === 'task' ? sharedTaskFor(item.id) : null)} />
                                </LayoutAnimationConfig>}
                            </Frozen>
                            </View>
                            <View style={{ width: windowWidth, paddingHorizontal: horizontalPadding }} onLayout={event => measurePage(1, event.nativeEvent.layout.height)}>
                            <Frozen live={pageLive(1)}>
                            {/* What the List is filtered by: on the List's own page, so it slides with it and nothing shifts. */}
                            {!scrubbing && (filtered || hasActiveFilters) && (
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
                                        <Text style={{ color: accentColor, fontSize: 11, fontFamily: FontFamily.semibold, letterSpacing: 0.5 }}>
                                            {[
                                                (!shown.goals || !shown.habits || !shown.tasks) && (['goals', 'habits', 'tasks'] as const).filter(kind => shown[kind]).map(kind => kind.charAt(0).toUpperCase() + kind.slice(1)).join(' + '),
                                                selectedGoalFilter && goals.find(g => g.id === selectedGoalFilter)?.name?.slice(0, 12),
                                                selectedCategoryFilter && selectedCategoryFilter.charAt(0).toUpperCase() + selectedCategoryFilter.slice(1),
                                                activeTimeFilter !== 'all' && activeTimeFilter.charAt(0).toUpperCase() + activeTimeFilter.slice(1),
                                                activeSort !== 'default' && ({ name: 'A-Z', progress: 'Progress', priority: 'Priority' } as const)[activeSort],
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
                            {/* GOALS SECTION */}
                            {showGoals && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    <SectionTitle first right={
                                        <View style={styles.headerLinks}>
                                        {/* Every goal there is: in progress, then archived. */}
                                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="All goals" onPress={() => router.push({ pathname: '/(root)/all-habits', params: { kind: 'goals' } })} style={styles.headerLink}>
                                            <Text style={[styles.headerLinkText, { color: colors.textTertiary }]}>See all</Text>
                                        </TouchableOpacity>
                                        </View>
                                    }>Goals</SectionTitle>

                                    {sortedGoals.length > 0 ? (
                                        <>
                                        {/* The goals as a carousel of near-square cards, the next one peeking in. */}
                                        <GHScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast"
                                            snapToInterval={goalTileWidth + Spacing.md} snapToAlignment="start"
                                            style={[styles.goalRail, { marginHorizontal: -horizontalPadding }]}
                                            contentContainerStyle={[styles.goalRailRow, { paddingHorizontal: horizontalPadding }]}>
                                            {sortedGoals.map(goal => (
                                                <ListItem key={goal.id}>
                                                    <View ref={(ref) => { goalRefs.current[goal.id] = ref; }}>
                                                        <GoalTile
                                                            goal={{ ...goal, color: goal.color || accentColor }}
                                                            progress={goalProgress[goal.id] || 0}
                                                            width={goalTileWidth}
                                                            isExpanded={!!expandedGoals[goal.id]}
                                                            linkedHabitsCount={(habitsByGoal[goal.id] || []).length}
                                                            shared={sharedGoalFor(goal.id)}
                                                            isDropTarget={hoveredGoalId === goal.id}
                                                            onToggleExpand={() => toggleGoalExpansion(goal.id)}
                                                            onPress={() => router.push({ pathname: '/goal-detail', params: { goalId: goal.id } })}
                                                        />
                                                    </View>
                                                </ListItem>
                                            ))}
                                        </GHScrollView>
                                        {/* The open goal's plan, under the carousel: one goal at a time. */}
                                        {sortedGoals.filter(goal => expandedGoals[goal.id]).map(goal => {
                                            const linkedHabits = habitsByGoal[goal.id] || [];
                                            return (
                                                        <ListItem key={goal.id} style={[styles.goalPlan, { borderLeftColor: colors.border }]}>
                                                            {linkedHabits.length > 0 ? (
                                                                linkedHabits.map(habit => (
                                                                    <ListItem key={habit.id}><SwipeableHabitItem
                                                                        key={habit.id}
                                                                        habit={habit}
                                                                        locked={selectedKey !== localDateKey(new Date())}
                                                                        size={cardSize}
                                                                        completed={!!completions[habit.id]}
                                                                        shared={sharedFor(habit.id)}
                                                                        isDragging={draggingHabit?.id === habit.id}
                                                                        skipped={!!skipped[habit.id]}
                                                                        onSkip={rowHabitSkip}
                                                                        isActive={isLive(statusOf(habit))}
                                                                        followFocus={isLive(statusOf(habit))}
                                                                        totalDuration={isLive(statusOf(habit)) ? totalDuration : undefined}
                                                                        onDragStart={rowHabitDragStart}
                                                                        onDragMove={rowHabitDragMove}
                                                                        onDragEnd={rowHabitDragEnd}
                                                                        onPress={rowHabitOpen}
                                                                        onToggle={rowHabitToggle}
                                                                        onEdit={rowHabitEdit}
                                                                        onDelete={rowHabitDelete}
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
                                                                    onDragStart={rowTaskDragStart}
                                                                    onDragMove={rowTaskDragMove}
                                                                    onDragEnd={rowTaskDragEnd}
                                                                    onToggle={rowTaskToggle}
                                                                    onPress={rowTaskOpen}
                                                                    onEdit={rowTaskOpen}
                                                                    onDelete={rowTaskDelete}
                                                                    shared={sharedTaskFor(task.id)}
                                                                /></ListItem>
                                                            ))}

                                                        </ListItem>
                                            );
                                        })}
                                        </>
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
                            {showTasks && listedTasks.length > 0 && (
                                <View style={{ marginBottom: 16 }}>
                                    {scrubbing ? null : <SectionTitle first right={
                                        // Every task there is: to do, then done and stopped.
                                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="All tasks" onPress={() => router.push({ pathname: '/(root)/all-habits', params: { kind: 'tasks' } })} style={styles.headerLink}>
                                            <Text style={[styles.headerLinkText, { color: colors.textTertiary }]}>See all</Text>
                                        </TouchableOpacity>
                                    }>Tasks</SectionTitle>}
                                    {listedTasks
                                        .map(task => (
                                            <ListItem key={task.id} still={scrubbing}><TaskItem
                                                key={task.id}
                                                task={task}
                                                size={cardSize}
                                                today={todayKey()}
                                                isDragging={draggingTask?.id === task.id}
                                                onDragStart={rowTaskDragStart}
                                                onDragMove={rowTaskDragMove}
                                                onDragEnd={rowTaskDragEnd}
                                                onToggle={rowTaskToggle}
                                                onPress={rowTaskOpen}
                                                onEdit={rowTaskOpen}
                                                onDelete={rowTaskDelete}
                                                shared={sharedTaskFor(task.id)}
                                            /></ListItem>
                                        ))}
                                </View>
                            )}

                            {/* HABITS SECTION */}
                            {showHabits && listedHabits.length > 0 && (
                                <View style={{ marginTop: 0, marginBottom: 16 }}>
                                    {scrubbing ? null : <SectionTitle first right={
                                        // Every habit there is, archived included: was in Settings.
                                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="All habits" onPress={() => router.push('/(root)/all-habits')} style={styles.headerLink}>
                                            <Text style={[styles.headerLinkText, { color: colors.textTertiary }]}>See all</Text>
                                        </TouchableOpacity>
                                    }>Habits</SectionTitle>}

                                    {listedHabits.map(habit => {
                                        // Find associated goal name for habit
                                        const associatedGoal = goals.find(g => g.id === habit.goalId);
                                        return (
                                            <ListItem key={habit.id} still={scrubbing}><SwipeableHabitItem
                                                key={habit.id}
                                                habit={habit}
                                                locked={selectedKey !== localDateKey(new Date())}
                                                completed={!!completions[habit.id]}
                                                shared={sharedFor(habit.id)}
                                                isDragging={draggingHabit?.id === habit.id}
                                                isActive={isLive(statusOf(habit))}
                                                followFocus={isLive(statusOf(habit))}
                                                totalDuration={isLive(statusOf(habit)) ? totalDuration : undefined}
                                                goalName={!looseOnly && associatedGoal ? associatedGoal.name : undefined}
                                                onDragStart={rowHabitDragStart}
                                                onDragMove={rowHabitDragMove}
                                                onDragEnd={rowHabitDragEnd}
                                                onPress={rowHabitOpen}
                                                // The same tick as everywhere (today only, shown at once, put back if the save fails).
                                                onToggle={rowHabitToggle}
                                                onEdit={rowHabitEdit}
                                                onDelete={rowHabitDelete}
                                                size={cardSize}
                                            /></ListItem>
                                        );
                                    })
                                    }
                                </View>
                            )}

                            </Frozen>
                            </View>
                            </GHScrollView>
                            </>)}

                            {/* Habits section removed - all habits must be linked to goals */}

                        </Animated.ScrollView>

                        {draggingHabit || draggingTask ? (
                            <Overlay>
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
                            </Overlay>
                        ) : null}
                    </View>

                    <RoadmapFilters visible={showFilter} onClose={closeFilterModal} goals={goals} anchor={filterAnchor}
                        view={viewChoice} onView={setRoadmapView}
                        shown={shown} onToggleShown={toggleKind} focus={activeTimeFilter} onFocus={setActiveTimeFilter}
                        goal={selectedGoalFilter} onGoal={setSelectedGoalFilter}
                        sharedOnly={sharedOnly} onSharedOnly={setSharedOnly}
                        friends={sharedFriends} sharedWith={sharedWith} onSharedWith={setSharedWith}
                        order={activeSort} direction={sortDirection}
                        onOrder={value => { if (value === activeSort) setSortDirection(direction => direction === 1 ? -1 : 1); else { setActiveSort(value); setSortDirection(1); } }}
                        onReset={resetFilters} />

                </View>
            </SafeAreaView>

            <PinSheet item={pinning} onClose={() => setPinning(null)}
                onPin={(item, minute) => void pinFlowItem(item, minute)} onUnpin={item => void pinFlowItem(item, null)} />
            <EventSheet event={eventSheet} day={localDateKey(selectedDate)} onClose={() => setEventSheet(null)}
                onOpenCalendar={() => { if (eventSheet) openInCalendar(localDateKey(selectedDate), eventSheet.start); setEventSheet(null); }} />
        </VoidShell>
    );
};


/** The dragged pill draws over the whole window (components/ui/Overlay is a window layer on iOS). */
const WHOLE_WINDOW = Platform.OS === 'ios';

export default CalendarScreen;
