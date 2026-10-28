import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { MorphMenu, type MorphMenuHandle } from '@/components/ui/MorphMenu';
import { FocusClock, FocusDigits, FocusRing } from '@/components/Focus/FocusClock';
import { FocusSettingsSheet, FocusSoundSheet, useFocusSoundChoice } from '@/components/Focus/FocusSheets';
import { playFocusSound, stopFocusSound } from '@/lib/focusSounds';
import { AnimatedCircle } from '@/components/ui/Motion';
import { useFocusTime } from '@/context/FocusTimeContext';
import { useFocusPlan } from '@/hooks/useFocusPlan';
import { useFocusDay } from '@/hooks/useFocusDay';
import { on } from '@/lib/appEvents';
import { FocusBlock, FocusDayDone } from '@/components/Focus/FocusBlock';
import { FocusCrew } from '@/components/Focus/FocusCrew';
import { FocusNearby } from '@/components/Focus/FocusNearby';
import { announceChange } from '@/lib/livePulse';
import { useFocusCrew } from '@/hooks/useFocusCrew';
import { FeedService } from '@/lib/feedService';
import { MIN_JOIN_SECONDS, hostOf, inviteFriendsToFocus, linkTo, linkedHost, secondsLeft, setFocusWith, togetherId } from '@/lib/focusTogether';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useClockStyle } from '@/hooks/useClockStyle';
import { useTasks } from '@/hooks/useTasks';
import { getHabits, type Habit } from '@/lib/habitsSQLite';
import { styles } from '@/styles/screens/focus.styles';

/** Holding the × this long ends a session, its ring filling as you hold. */
const HOLD_MS = 700;
const HOLD_SIZE = 44;
const HOLD_R = 20;
const HOLD_C = 2 * Math.PI * HOLD_R;

/**
 * Focus mode, for any habit or task. It starts the moment it opens, nothing
 * to choose: a timer for as long as the thing lasts, counted from when it
 * begins on today's timeline (a 5:00–5:30 task opened at 5:10 has 20 minutes
 * left). When the time is up it carries on as a stopwatch, counting the whole
 * time since it began (at 6:00 that task shows 1:00:00), until it is done.
 * Full screen and pure black, awake while it runs, with app blocking on
 * (where Screen Time is set up).
 *
 * While it runs there is nothing on screen but the clock and a faint ×. Tap
 * anywhere to pause or carry on, like a video. A long press (or the ×) grows
 * the × into a small window: Finished saves the time and counts the habit or
 * task as done and closes; Exit leaves without saving anything. Nothing
 * moves on by itself: focus is chosen.
 *
 * Done · Next is the routine: it counts this one done and the next thing in
 * the day takes its place straight away, its clock already running, no
 * closing, no "done" screen in between.
 */
export default function FocusRoute() {
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
    const { kind, id, title, banked: bankedParam, day: dayParam } = useLocalSearchParams<{ kind?: string; id?: string; title?: string; banked?: string; start?: string; day?: string }>();
    void dayParam;
    const proceed = useFocusDay();
    const insets = useSafeAreaInsets();
    const { primary } = useAccentGradient();
    const { selectionFeedback, successFeedback, mediumFeedback } = useHaptics();
    const clock = useClockStyle();
    const screen = useWindowDimensions();
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
    const [joinPlan, setJoinPlan] = useState<{ endsAt: number; open: boolean; label: string; first: string } | null>(null);
    useEffect(() => {
        if (!host) return;
        void FeedService.friendStatuses().catch(() => []).then(friends => {
            const friend = friends.find(item => item.userId === host);
            // They joined someone else you know: join that session itself.
            const theirHost = friend?.focusWith ? friends.find(item => item.userId === friend.focusWith && secondsLeft(item.focusUntil) > 0) : undefined;
            if (theirHost) { router.setParams({ id: togetherId(theirHost.userId) }); return; }
            const first = friend?.name.split(' ')[0] || 'your friend';
            const endsAt = friend?.focusUntil ? new Date(friend.focusUntil).getTime() : 0;
            setJoinPlan({ endsAt: Number.isFinite(endsAt) ? endsAt : 0, open: !!friend?.focusOpen && secondsLeft(friend.focusUntil) > 0, label: friend?.focusLabel?.trim() || `Focus with ${first}`, first });
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
            // Begun a hair before now, so the countdown ends on their exact millisecond.
            focus.startTimer(id, title ?? joinPlan.label, seconds, 'deep_focus', joinPlan.endsAt - seconds * 1000);
            return;
        }
        mediumFeedback();
        const name = title ?? habit?.name ?? task?.title ?? 'Focus';
        if (plan.seconds === null) focus.startTimer(id, name, 3600 * 12, 'flow');
        else focus.startTimer(id, name, plan.seconds, 'deep_focus', plan.since ?? undefined);
    };
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
    // Only the pause button pauses; a tap anywhere else just brings the controls back.
    const toggle = () => {
        wake();
        if (!active) return;
        selectionFeedback();
        if (focus.isPaused) focus.resumeTimer();
        else focus.pauseTimer();
    };
    // Ending takes a hold on the ×, so a stray touch never ends a session: the
    // ring round it fills, then the × grows into the app's own small window —
    // Finished keeps the session and counts it done; Exit throws it away.
    const endMenu = useRef<MorphMenuHandle>(null);
    const askEnd = () => {
        if (!active) { close(); return; }
        mediumFeedback();
        endMenu.current?.open();
    };
    const [holdHint, setHoldHint] = useState(false);
    const hold = useSharedValue(0);
    const holdRing = useAnimatedProps(() => ({ strokeDashoffset: HOLD_C * (1 - hold.get()) }));
    const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tappedEnd = () => {
        wake();
        selectionFeedback();
        setHoldHint(true);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHoldHint(false), 1800);
    };
    // Sounds to focus to, and the page's own settings, from the top corner.
    const sound = useFocusSoundChoice();
    const [sheet, setSheet] = useState<'settings' | 'sound' | null>(null);
    useEffect(() => { void playFocusSound(sound, active && focus.isRunning && !focus.isPaused); }, [sound, active, focus.isRunning, focus.isPaused]);
    useEffect(() => () => stopFocusSound(), []);
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
    // Finished: saved, counted done, and the page closes. The timeline shows what is next.
    const finishNow = () => { leaving.current = true; successFeedback(); focus.finishTimer(); close(); };
    // Done · Next: counted done, and the next thing in the day takes over right here.
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
    const [canInvite, setCanInvite] = useState(false);
    useEffect(() => { void FeedService.me().then(me => setCanInvite(!!me)).catch(() => undefined); }, []);
    const [note, setNote] = useState<string | null>(null);
    const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
    const invite = async () => {
        wake();
        selectionFeedback();
        const result = await inviteFriendsToFocus();
        if ('sent' in result) successFeedback();
        setNote('sent' in result ? `Invited ${result.sent} ${result.sent === 1 ? 'friend' : 'friends'}`
            : result.error === 'too_soon' ? 'Already invited. Try again in a bit'
            : result.error === 'nobody' ? 'No friends around right now'
            : result.error === 'not_focusing' ? 'Carry on first, then invite'
            : 'Could not invite. Check your connection');
        if (noteTimer.current) clearTimeout(noteTimer.current);
        noteTimer.current = setTimeout(() => setNote(null), 4000);
    };

    const name = title ?? joinPlan?.label ?? habit?.name ?? task?.title ?? 'Focus';
    const stopwatch = focus.activeMode === 'flow';
    const progress = stopwatch || !focus.totalDuration ? null : 1 - focus.timeLeft / focus.totalDuration;

    const overTime = stopwatch && focus.totalDuration < 3600 * 12;
    const eyebrow = focus.isPaused ? 'Paused' : overTime ? 'Over time' : stopwatch ? 'Flow' : 'Focus';
    const endsAt = !stopwatch && !focus.isPaused && focus.timeLeft > 0
        ? new Date(Date.now() + focus.timeLeft * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;

    // Sized from the screen, so everything fits on any phone, upright or on its side.
    const landscape = screen.width > screen.height;
    const usable = screen.height - insets.top - insets.bottom;
    const ringSize = landscape ? Math.min(usable * 0.62, screen.width * 0.34) : Math.min(screen.width * 0.6, usable * 0.32);
    const digitSize = landscape ? Math.min(usable * 0.2, screen.width * 0.11) : Math.min(screen.width * 0.18, usable * 0.095);
    const label = focus.isPaused ? undefined : endsAt ? `Ends at ${endsAt}` : undefined;
    const controls = calm ? null : (
        <Animated.View entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(400).reduceMotion(ReduceMotion.System)} style={styles.controls}>
            {/* A joined session keeps your friend's clock: no starting over. */}
            {host ? <View style={styles.side} /> : (
                <Pressable onPress={restart} style={styles.side} accessibilityRole="button" accessibilityLabel="Start over" hitSlop={6}>
                    <AppIcon name="refresh" size={22} color="#FFFFFF" />
                </Pressable>
            )}
            <Pressable onPress={toggle} style={styles.play} accessibilityRole="button" accessibilityLabel={focus.isPaused ? 'Carry on' : 'Pause'}>
                <AppIcon name={focus.isPaused ? 'play' : 'pause'} filled size={28} color="#000000" />
            </Pressable>
            {/* Done with it: count it and go to the next thing in the day. */}
            <Pressable onPress={nextNow} style={styles.side} accessibilityRole="button" accessibilityLabel="Done, go to the next thing" hitSlop={6}>
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
            {/* A glow of your colour at the top, settling into black: the
                screen stays mostly black, which an OLED screen spends nothing on. */}
            <LinearGradient pointerEvents="none" colors={[`${primary}38`, `${primary}0F`, '#00000000']} locations={[0, 0.35, 0.7]} style={styles.glow} />
            <Animated.View style={[styles.top, chromeStyle]}>
                {active ? (
                    <View>
                        <MorphMenu menuRef={endMenu} icon="close" iconColor="#FFFFFF" label="End focus" title="End focus?" titleIcon="timer" items={[
                            { label: 'Finished', icon: 'checkmark-circle', onPress: finishNow },
                            { label: 'Exit without saving', icon: 'close-circle', destructive: true, onPress: exitNow },
                        ]} />
                        {/* Over the ×: a tap says to hold; holding fills the ring, then opens the menu. */}
                        <Pressable style={styles.holdLayer} onPress={tappedEnd} delayLongPress={HOLD_MS} onLongPress={() => { hold.set(0); askEnd(); }}
                            onPressIn={() => { hold.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear })); }}
                            onPressOut={() => { hold.set(withTiming(0, { duration: 150 })); }}
                            accessibilityRole="button" accessibilityLabel="End focus" accessibilityHint="Touch and hold to finish or exit"
                            onAccessibilityTap={askEnd}>
                            <Svg width={HOLD_SIZE} height={HOLD_SIZE} pointerEvents="none">
                                <AnimatedCircle cx={HOLD_SIZE / 2} cy={HOLD_SIZE / 2} r={HOLD_R} stroke="#FFFFFF" strokeWidth={2.5} fill="none" strokeLinecap="round"
                                    strokeDasharray={`${HOLD_C} ${HOLD_C}`} animatedProps={holdRing} rotation={-90} origin={`${HOLD_SIZE / 2}, ${HOLD_SIZE / 2}`} />
                            </Svg>
                        </Pressable>
                        {holdHint ? <Text style={styles.holdHint}>Hold to end</Text> : null}
                    </View>
                ) : (
                    <IconButton icon="close" label="Close" onPress={close} size={18} color="#FFFFFF" />
                )}
                <View style={styles.topRight}>
                    {active && canInvite ? (
                        <IconButton icon="person-add" label="Invite friends to focus with you" onPress={() => { void invite(); }} size={18} color="#FFFFFF" />
                    ) : null}
                    <IconButton icon={sound === 'off' ? 'musical-notes-outline' : 'musical-notes'} label="Focus sound" onPress={() => { wake(); setSheet('sound'); }} size={18} color="#FFFFFF" />
                    <IconButton icon="settings-outline" label="Focus settings" onPress={() => { wake(); setSheet('settings'); }} size={18} color="#FFFFFF" />
                </View>
            </Animated.View>

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
            <FocusSettingsSheet visible={sheet === 'settings'} onClose={() => setSheet(null)} />
            <FocusSoundSheet visible={sheet === 'sound'} onClose={() => setSheet(null)} />
        </Pressable>
    );
}
