import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { allowAnyOrientation, applyDefaultOrientation } from '@/lib/orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';
import { FocusClock, FocusDigits, FocusRing } from '@/components/Focus/FocusClock';
import { FocusTopBar } from '@/components/Focus/FocusTopBar';
import { keepFocusCounting, useFocusTime } from '@/context/FocusTimeContext';
import { useFocusPlan } from '@/hooks/useFocusPlan';
import { useFocusDay } from '@/hooks/useFocusDay';
import { on } from '@/lib/appEvents';
import { FocusBlock, FocusDayDone } from '@/components/Focus/FocusBlock';
import { FocusCrew } from '@/components/Focus/FocusCrew';
import { FocusSummary } from '@/components/Focus/FocusSummary';
import { MARKS } from '@/lib/marks';
import { FocusNearby } from '@/components/Focus/FocusNearby';
import { RankScene } from '@/components/Home/RankScene';
import { useFocusBackground } from '@/components/Focus/FocusSheets';
import { useTokens } from '@/hooks/useTokens';
import { FOCUS_ENTRY } from '@/theme/motion';
import { Colors } from '@/theme/colors';
import { announceChange } from '@/lib/livePulse';
import { useFocusCrew } from '@/hooks/useFocusCrew';
import { FeedService } from '@/lib/feedService';
import { MIN_JOIN_SECONDS, hostOf, linkTo, linkedHost, secondsLeft, setFocusWith, togetherId } from '@/lib/focusTogether';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { useTasks } from '@/hooks/useTasks';
import { getHabits, setSkipped, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { lengthLabel } from '@/lib/dayFlow';
import { styles } from '@/styles/screens/focus.styles';

/** Holding the × this long ends a session, its ring filling as you hold. */

/**
 * Focus mode, for any habit or task. It starts the moment it opens, nothing
 * to choose: a timer that ends when the thing's slot on today's timeline
 * ends (a 5:00–5:30 task opened at 5:10 has 20 minutes left), or for its whole
 * length when its slot is already over. Only time spent here counts as focus,
 * from the moment it opens. When the time is up it carries on as a
 * stopwatch only for "Just 5 minutes"; otherwise the day moves on.
 * Full screen and pure black, awake while it runs, with app blocking on
 * (where Screen Time is set up).
 *
 * While it runs there is nothing on screen but the clock and a faint ×. Tap
 * anywhere to pause or carry on, like a video. A long press (or the ×) grows
 * the × into a small window: Finished saves the time and counts the habit or
 * task as done and closes; Exit leaves without saving anything. When its
 * time is up, the next thing on the timeline takes its place.
 *
 * Done · Next is the routine: it counts this one done and the next thing in
 * the day takes its place straight away, its clock already running, no
 * closing, no "done" screen in between.
 */
export default function FocusRoute() {
    // Behind every step of the day: the landscape, the same scene as Home, so stepping in from
    // Home (lib/focusStage.ts) shows no seam; or the default, plain black (Focus settings).
    const t = useTokens();
    const background = useFocusBackground();
    // Sideways, the scene is far taller than the screen: its middle (the moon, the dunes) is what shows.
    const { width, height } = useWindowDimensions();
    return (
        <View style={[styles.screen, { backgroundColor: background === 'landscape' ? t.color.background : Colors.common.black }]}>
            {background === 'landscape' ? <RankScene centred={width > height} /> : null}
            {/* The clock and its buttons appear on the scene. */}
            <Animated.View style={styles.screen} entering={FadeIn.duration(FOCUS_ENTRY.appear).reduceMotion(ReduceMotion.System)}><FocusStep /></Animated.View>
        </View>
    );
}

/** What Focus shows now: the day's step, a block of time, or the clock. */
function FocusStep() {
    const { id, kind, day, end, title, from, until, nextKind } = useLocalSearchParams<{
        id?: string; kind?: string; day?: string; end?: string; title?: string; from?: string; until?: string; nextKind?: string;
    }>();
    // Focusing all day: the first step is whatever the timeline has now.
    if (day === '1' && end === '1') return <FocusDayDone />;
    if (day === '1' && !id) return <FocusDayStart />;
    // A meal, an event, or the free time before something at an exact time.
    if (id && (kind === 'meal' || kind === 'event' || kind === 'wait')) {
        return <FocusBlock key={`${kind}:${id}`} kind={kind} id={id} title={title ?? ''} from={Number(from) || 0} until={Number(until) || 0} nextKind={nextKind} />;
    }
    // A fresh screen for each thing focused on, so chaining starts clean.
    return <FocusScreen key={id ?? 'focus'} />;
}

/** Opens the day's first step. */
function FocusDayStart() {
    const proceed = useFocusDay();
    useEffect(() => { void proceed(); }, [proceed]);
    return <View style={styles.screen} />;
}

function FocusScreen() {
    const { kind, id, title, banked: bankedParam, day: dayParam, minutes: minutesParam } = useLocalSearchParams<{ kind?: string; id?: string; title?: string; banked?: string; start?: string; day?: string; minutes?: string }>();
    // "Just 5 minutes" from Echo's nudge: a short clock that keeps counting if it takes.
    const starter = Number(minutesParam) > 0 ? Number(minutesParam) : null;
    void dayParam;
    const proceed = useFocusDay();
    const insets = useSafeAreaInsets();
    const { primary } = useAccentGradient();
    const { selectionFeedback, successFeedback, mediumFeedback } = useHaptics();
    const clock = useClockStyle();
    const screen = useWindowDimensions();
    // Any way round while Focus is open (its clock goes sideways); portrait again on leaving.
    useFocusEffect(React.useCallback(() => { allowAnyOrientation(); return applyDefaultOrientation; }, []));
    const focus = useFocusTime();
    const tasks = useTasks();
    const [habit, setHabit] = useState<Habit | null>(null);
    const isTask = kind === 'task';
    const task = useMemo(() => (isTask ? tasks.find(item => item.id === id) : undefined), [isTask, tasks, id]);
    // Joining a friend (lib/focusTogether.ts): the clock is theirs, to the
    // second they finish, and the name is what they are working on.
    const host = kind === 'together' ? hostOf(id) : null;
    // Their end as a moment, not a number of seconds read earlier: the clock
    // is started from it, so it is right however long the page took to open.
    const [joinPlan, setJoinPlan] = useState<{ endsAt: number; since: number | null; open: boolean; label: string; first: string } | null>(null);
    useEffect(() => {
        if (!host) return;
        void Promise.all([FeedService.friendStatuses().catch(() => []), FeedService.focusSince(host).catch(() => null)]).then(([friends, since]) => {
            const friend = friends.find(item => item.userId === host);
            // They joined someone else you know: join that session itself.
            const theirHost = friend?.focusWith ? friends.find(item => item.userId === friend.focusWith && secondsLeft(item.focusUntil) > 0) : undefined;
            if (theirHost) { router.setParams({ id: togetherId(theirHost.userId) }); return; }
            const first = friend?.name.split(' ')[0] || 'your friend';
            const endsAt = friend?.focusUntil ? new Date(friend.focusUntil).getTime() : 0;
            setJoinPlan({ endsAt: Number.isFinite(endsAt) ? endsAt : 0, since: since !== null && since < endsAt ? since : null, open: !!friend?.focusOpen && secondsLeft(friend.focusUntil) > 0, label: friend?.focusLabel?.trim() || `Focus with ${first}`, first });
        });
    }, [host]);

    useEffect(() => {
        if (isTask || !id || host) return;
        void getHabits().then(list => setHabit(list.find(item => item.id === id) ?? null));
    }, [isTask, id]);

    // How long, from the one place that decides it (lib/focusLength.ts): a
    // timed habit or a task measured in time runs exactly its length (its cut
    // length if today's timeline cut it short), less what is already done.
    const plan = useFocusPlan(id, { habit, task }, Number(bankedParam) || 0);
    const timesRead = host ? !!joinPlan : plan.ready && (isTask ? !!task : !!habit);

    const mine = focus.activeHabitId === id;
    const active = mine && (focus.isRunning || focus.isPaused);
    // Ended somewhere else (the Live Activity, the watch): nothing left to show here.
    const leaving = useRef(false);
    // Starting over ends this run and begins it again: the page must not close in between.
    const restarting = useRef(false);
    const wasActive = useRef(false);
    useEffect(() => {
        if (wasActive.current && !active && !focus.isRunning && !focus.isPaused && !leaving.current && !restarting.current) router.back();
        wasActive.current = active;
    }, [active, focus.isRunning, focus.isPaused]);
    // Awake while it runs.
    useEffect(() => {
        const keep = require('expo-keep-awake') as typeof import('expo-keep-awake');
        if (focus.isRunning && mine) void keep.activateKeepAwakeAsync('habyss-focus').catch(() => undefined);
        else void keep.deactivateKeepAwake('habyss-focus').catch(() => undefined);
        return () => { void keep.deactivateKeepAwake('habyss-focus').catch(() => undefined); };
    }, [focus.isRunning, mine]);

    // Left alone for a few seconds, the page goes quiet: the corner buttons
    // dim, the player's buttons fade away, and the name and time grow into the
    // room. A tap anywhere brings it all back. Paused, the buttons stay.
    const chrome = useSharedValue(1);
    const calmness = useSharedValue(0);
    const [calm, setCalm] = useState(false);
    const pausedNow = useRef(false);
    pausedNow.current = focus.isPaused;
    const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wake = () => {
        chrome.value = withTiming(1, { duration: 200 });
        calmness.set(withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
        setCalm(false);
        if (idle.current) clearTimeout(idle.current);
        idle.current = setTimeout(() => {
            chrome.value = withTiming(0.15, { duration: 800 });
            if (pausedNow.current) return;
            calmness.set(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System }));
            setCalm(true);
        }, 4000);
    };
    useEffect(() => { if (focus.isRunning && mine) wake(); return () => { if (idle.current) clearTimeout(idle.current); }; }, [focus.isRunning, mine]); // eslint-disable-line react-hooks/exhaustive-deps
    const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
    const headingGrow = useAnimatedStyle(() => ({ transform: [{ scale: 1 + calmness.get() * 0.12 }] }));
    const digitsGrow = useAnimatedStyle(() => ({ transform: [{ scale: 1 + calmness.get() * 0.28 }] }));
    // Paused: the buttons come back and stay.
    useEffect(() => { if (focus.isPaused) wake(); }, [focus.isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Starts straight away: a timer for its length, counted from when it began
     * on the timeline (if it has); already past that, the stopwatch. Nothing
     * to time it by at all: the stopwatch from now.
     */
    const start = () => {
        if (!id) return;
        if ((focus.isRunning || focus.isPaused) && !mine) {
            Alert.alert('Another focus is running', `Finish “${focus.activeHabitName ?? 'it'}” first.`);
            close();
            return;
        }
        if (host && joinPlan?.open) {
            // Their clock counts up with no end: yours counts up beside it, from now.
            mediumFeedback();
            focus.startTimer(id, title ?? joinPlan.label, 3600 * 12, 'flow');
            return;
        }
        if (host && joinPlan) {
            const now = Date.now();
            const seconds = Math.ceil((joinPlan.endsAt - now) / 1000);
            if (seconds < MIN_JOIN_SECONDS) {
                leaving.current = true;
                Alert.alert(`${joinPlan.first} just finished`, 'Their session ended before you got there. Start one of your own and invite them.');
                close();
                return;
            }
            mediumFeedback();
            // Their ring's whole length, from when it began: yours stands where
            // theirs does (half way there, half way round) and ends on their
            // millisecond. Only your own time from now counts as your focus.
            const length = joinPlan.since !== null ? Math.ceil((joinPlan.endsAt - joinPlan.since) / 1000) : seconds;
            focus.startTimer(id, title ?? joinPlan.label, length, 'deep_focus', joinPlan.since ?? joinPlan.endsAt - seconds * 1000);
            return;
        }
        mediumFeedback();
        const name = title ?? habit?.name ?? task?.title ?? 'Focus';
        if (starter) focus.startTimer(id, name, starter * 60, 'deep_focus');
        else if (plan.seconds === null) focus.startTimer(id, name, 3600 * 12, 'flow');
        else { focus.startTimer(id, name, plan.seconds, 'deep_focus', plan.since ?? undefined); countdown.current = true; }
    };
    /** Started as a countdown here, so its turning into a stopwatch means this part's time is up. */
    const countdown = useRef(false);
    const started = useRef(false);
    useEffect(() => {
        // Opened on a session already running (from the bar over the tab bar,
        // say): that is the one this page shows, so ending it must not start
        // a fresh one here as the page closes.
        if (active) started.current = true;
        if (started.current || leaving.current || !id) return;
        if (!timesRead) return; // wait for the item and today's timeline
        started.current = true;
        start();
    });
    const close = () => router.back();
    // Start over: the same thing, its clock from the top, this run not saved.
    const restart = () => {
        if (!active) return;
        mediumFeedback();
        restarting.current = true;
        focus.discardTimer();
    };
    useEffect(() => {
        if (restarting.current && !active && !focus.isRunning && !focus.isPaused) { restarting.current = false; start(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, focus.isRunning, focus.isPaused]);
    // Finishing (Finished, or Done · Next) shows what was done before anything
    // else: how long the focus held and the Marks it earned, the orbs flying
    // while it is up. Then Next takes the day on, or the page closes.
    const [summary, setSummary] = useState<{ title: string; seconds: number; marks: number; next: boolean } | null>(null);
    const finishWith = (next: boolean) => {
        if (!active) return;
        leaving.current = true;
        successFeedback();
        const seconds = focus.activeMode === 'flow' ? focus.timeLeft : Math.max(0, focus.totalDuration - focus.timeLeft);
        setSummary({ title: name, seconds, marks: host ? 0 : isTask ? MARKS.complete.task : MARKS.complete.habit, next });
        focus.finishTimer();
    };
    const finishNow = () => finishWith(false);
    // The checkmark: counted done, the Marks and Shards fly from it (the
    // overlay over the whole app, components/Marks/MarksOrbs), and the next
    // thing in the day starts at once, with no summary in between.
    const nextNow = () => {
        if (!active) return;
        leaving.current = true;
        successFeedback();
        focus.finishTimer();
        void proceed(id);
    };
    // Next from the wrist does the same.
    const nextRef = useRef(nextNow);
    nextRef.current = nextNow;
    useEffect(() => {
        const sub = on('focus_next', ({ id: from }) => { if (!from || from === id) nextRef.current(); });
        return () => sub.remove();
    }, [id]);
    const exitNow = () => { leaving.current = true; focus.discardTimer(); close(); };
    // Its time is up: the day moves on to what comes next on the timeline, not
    // into over time. Its minutes are kept, and it stays open (the Time's up
    // notification asks whether it is done, or needs more time). Split around
    // something fixed (study 30, lunch, study 30), that is what split it, and
    // focus comes back here for the rest after it. "Just 5 minutes" and a
    // friend's session keep counting, as they always did.
    // The session itself ends at its time (context/FocusTimeContext.tsx); here the page moves on with it.
    useEffect(() => {
        keepFocusCounting(!!starter || !!host);
        const sub = on('focus_time_up', ({ id: ended }) => {
            if (ended !== id || leaving.current) return;
            leaving.current = true;
            void proceed(id);
        });
        return () => { sub.remove(); keepFocusCounting(false); };
    }, [id, starter, host, proceed]);
    // Skip: not today. A habit is set aside for today (a skip neither counts
    // nor breaks the run); a task stays open for later. The time already spent
    // focusing is kept. Then the next thing in the day.
    const skipNow = () => {
        if (!active) return;
        leaving.current = true;
        selectionFeedback();
        focus.stopTimer();
        if (!isTask && !host && id) void setSkipped(id, true, localDateKey(new Date())).catch(() => undefined);
        void proceed(id);
    };

    // Who is in it with you, and "Join me?" to every friend who is awake.
    // Focusing at the same time by chance: Together links the two sessions,
    // each keeping its own thing and clock (lib/focusTogether.ts).
    const [linked, setLinked] = useState<string | null>(() => (active ? linkedHost() : null));
    const { crew, nearby } = useFocusCrew(host ?? linked, active);
    const [passed, setPassed] = useState<string[]>([]);
    const suggestion = active && !host && !linked ? nearby.find(friend => !passed.includes(friend.userId)) : undefined;
    const together = (friendId: string) => {
        successFeedback();
        linkTo(friendId);
        setLinked(friendId);
        void setFocusWith(friendId).then(() => announceChange()).catch(() => undefined);
    };
    // Keeping time with the host: whenever their end moves (they paused and
    // carried on, say), this clock moves with it.
    useEffect(() => {
        if (!host || !active) return;
        const row = crew.find(friend => friend.userId === host);
        const endsAt = row?.focusUntil ? new Date(row.focusUntil).getTime() : NaN;
        if (row && !row.focusOpen && Number.isFinite(endsAt) && endsAt > Date.now()) focus.alignEnd(endsAt);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [crew, host, active]);
    // No invite button here: friends join from Community, where they see you focusing.
    const note: string | null = null;

    const name = title ?? joinPlan?.label ?? habit?.name ?? task?.title ?? 'Focus';
    const stopwatch = focus.activeMode === 'flow';
    const progress = stopwatch || !focus.totalDuration ? null : 1 - focus.timeLeft / focus.totalDuration;

    const overTime = stopwatch && focus.totalDuration < 3600 * 12;
    const eyebrow = focus.isPaused ? 'Paused' : overTime ? 'Over time' : stopwatch ? 'Flow' : 'Focus';
    const endsAt = !stopwatch && !focus.isPaused && focus.timeLeft > 0
        ? new Date(Date.now() + focus.timeLeft * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;

    // Sized from the screen, so everything fits on any phone, upright or on its side.
    const landscape = screen.width > screen.height;
    // The room the clock has: the screen, less the top buttons and whatever
    // else is showing (the friend focusing too, who is with you), so nothing
    // ever spills over the buttons, upright or on its side.
    const extras = (suggestion ? 76 : 0) + (crew.length || note ? 40 : 0);
    const usable = screen.height - insets.top - insets.bottom - extras - (landscape ? 56 : 0);
    const ringSize = landscape ? Math.min(usable * 0.62, screen.width * 0.34) : Math.min(screen.width * 0.6, usable * 0.32);
    const digitSize = landscape ? Math.min(usable * 0.2, screen.width * 0.11) : Math.min(screen.width * 0.18, usable * 0.095);
    // Split around something fixed (lunch, an event): this part ends at its end,
    // and the rest comes after it, said so the clock is never a surprise.
    // "Ends at 12:00 · Lunch, then 30 min more": what comes between, and the rest after it.
    const then = !host && plan.then ? `${plan.then.after ? `${plan.then.after}, then` : 'then'} ${lengthLabel(plan.then.minutes)} more` : null;
    const label = focus.isPaused ? undefined : endsAt ? `Ends at ${endsAt}${then ? ` · ${then}` : ''}` : then ?? undefined;
    const controls = calm ? null : (
        <Animated.View entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(400).reduceMotion(ReduceMotion.System)} style={styles.controls}>
            {/* A joined session keeps your friend's clock: no starting over. */}
            {host ? <View style={styles.side} /> : (
                <Pressable onPress={restart} style={styles.side} accessibilityRole="button" accessibilityLabel="Start over" hitSlop={6}>
                    <AppIcon name="refresh" size={22} color="#FFFFFF" />
                </Pressable>
            )}
            {/* Done: count it, then the next thing in the day. */}
            <Pressable onPress={nextNow} style={styles.play} accessibilityRole="button" accessibilityLabel="Done, go to the next thing">
                <AppIcon name="checkmark" size={30} color="#000000" />
            </Pressable>
            {/* Not today: skip it, keep the time spent, go to the next thing. */}
            <Pressable onPress={skipNow} style={styles.side} accessibilityRole="button" accessibilityLabel={isTask ? 'Skip for now, go to the next thing' : 'Skip today, go to the next thing'} hitSlop={6}>
                <AppIcon name="play-skip-forward" filled size={22} color="#FFFFFF" />
            </Pressable>
        </Animated.View>
    );
    const MOVE = LinearTransition.duration(500).easing(Easing.inOut(Easing.cubic));
    const heading = (
        <Animated.View layout={MOVE} style={[styles.heading, headingGrow]}>
            <Text style={[styles.eyebrow, { color: primary }]}>{eyebrow}</Text>
            <Text numberOfLines={landscape ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.75}
                style={[styles.name, landscape && styles.nameSide]} accessibilityRole="header">{name}</Text>
            <FocusCrew crew={crew} accent={primary} note={note} mine={name} />
        </Animated.View>
    );

    return (
        <Pressable style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]} onPress={wake} accessible={false}>
            {/* The same top as a step of the day opened from the + (FocusBlock): hold the × to end, sound, settings. */}
            <FocusTopBar style={chromeStyle} active={active} playing={active && focus.isRunning && !focus.isPaused} onClose={close} onWake={wake}
                endItems={[
                    { label: 'Finished', icon: 'checkmark-circle', onPress: finishNow },
                    { label: 'Exit without saving', icon: 'close-circle', destructive: true, onPress: exitNow },
                ]} />

            {active ? (
                landscape ? (
                    <View style={styles.sideways}>
                        {clock === 'ring' ? <FocusRing size={ringSize} progress={progress} accent={primary} running={!focus.isPaused} /> : null}
                        <View style={styles.sideColumn}>
                            {heading}
                            <Animated.View layout={MOVE} style={digitsGrow}>
                                {clock === 'ring' ? <FocusDigits seconds={focus.timeLeft} size={digitSize} label={label} />
                                    : <FocusClock seconds={focus.timeLeft} progress={progress} style={clock} accent={primary} running={!focus.isPaused} label={label} />}
                            </Animated.View>
                            {controls}
                            {suggestion ? (
                            <FocusNearby key={suggestion.userId} friend={suggestion} accent={primary}
                                onTogether={() => together(suggestion.userId)}
                                onDismiss={() => { selectionFeedback(); setPassed(list => [...list, suggestion.userId]); }} />
                        ) : null}
                        </View>
                    </View>
                ) : (
                    <View style={styles.center}>
                        {heading}
                        {clock === 'ring' ? (
                            <Animated.View layout={MOVE} style={styles.clockStack}>
                                <FocusRing size={ringSize} progress={progress} accent={primary} running={!focus.isPaused} />
                                <Animated.View style={digitsGrow}>
                                    <FocusDigits seconds={focus.timeLeft} size={digitSize} label={label} />
                                </Animated.View>
                            </Animated.View>
                        ) : (
                            <Animated.View layout={MOVE} style={digitsGrow}>
                                <FocusClock seconds={focus.timeLeft} progress={progress} style={clock} accent={primary} running={!focus.isPaused} label={label} />
                            </Animated.View>
                        )}
                        {controls}
                        {suggestion ? (
                            <FocusNearby key={suggestion.userId} friend={suggestion} accent={primary}
                                onTogether={() => together(suggestion.userId)}
                                onDismiss={() => { selectionFeedback(); setPassed(list => [...list, suggestion.userId]); }} />
                        ) : null}
                    </View>
                )
            ) : null}
            {summary ? (
                <FocusSummary title={summary.title} seconds={summary.seconds} marks={summary.marks} accent={primary}
                    onNext={summary.next ? () => { setSummary(null); void proceed(id); } : undefined}
                    onClose={() => { setSummary(null); close(); }} />
            ) : null}
        </Pressable>
    );
}
