import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { textOn } from '@/theme/tokens';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { habitStatus, isLive } from '@/lib/habitStatus';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppIcon } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { Control, FontFamily, Radius, Typography, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useFocusTime } from '@/context/FocusTimeContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Habit } from '@/lib/habitsSQLite';
import { describeAmount, formatDuration, formatMeasurement, localHabitDate, measurementFor, parseMeasurement } from '@/lib/habitMeasurement';
import { FocusDial } from '@/components/Habit/FocusDial';
import { healthLabel, mergeHealth, metricFits, readHealth } from '@/lib/healthMetrics';
import { readableAccent } from '@/lib/colorContrast';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// Timing, not a spring: this card resizes as you log, and a spring
// overshoots every time, which reads as the whole page bouncing.
const morph = LinearTransition.duration(200).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const enter = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const exit = FadeOut.duration(120).reduceMotion(ReduceMotion.System);
const RING = 68;
const CIRCUMFERENCE = 2 * Math.PI * RING;

interface Props {
    habit: Habit;
    date: string;
    value: number;
    saving: boolean;
    ready: boolean;
    error: string | null;
    canUndo: boolean;
    onChange: (value: number) => void;
    onAdd: (amount: number) => void;
    onUndo: () => void;
    onToday: () => void;
}

/** The same progress surface becomes a counter, a focus timer or a daily check-in. */
export function HabitProgressCard({ habit, date, value, saving, ready, error, canUndo, onChange, onAdd, onUndo, onToday }: Props) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const accent = habit.color || colors.primary;
    const ink = readableAccent(accent, colors.surfaceSecondary);
    const { kind, target, unit, step, quickAmounts, secondsPerUnit } = measurementFor(habit);
    // One step above the card, for the things that sit on it: the dial's well,
    // the chips, the amount field. Reading these off the surface tones rather
    // than tinting the accent keeps the accent meaning "this is the progress".
    const tone = surfaceFor(theme);
    const raised = tone.raised;
    const track = theme === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
    const focus = useFocusTime();
    const { selectionFeedback, mediumFeedback } = useHaptics();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [inputError, setInputError] = useState<string | null>(null);
    const isToday = date === localHabitDate();
    /**
     * The third way to know a habit is done: Health already knows.
     *
     * Only for a habit whose unit still measures what its metric measures — a
     * link outlives an edit, and a step count answering for pages would look
     * like an answer.
     */
    const health = habit.healthKitMetric && metricFits(habit.unit, habit.healthKitMetric)
        ? habit.healthKitMetric : null;
    const [asking, setAsking] = useState(false);
    /** A ref, not state: asking once per day shown must not cause a render. */
    const asked = React.useRef<string | null>(null);
    // The same rule the Roadmap card uses (lib/habitStatus.ts), so the two
    // never disagree about whether a session is live.
    const active = isLive(habitStatus({ habitId: habit.id, done: false, focus }));
    const live = active && isToday && kind === 'timer';
    const elapsed = live ? (focus.activeMode === 'flow' ? focus.timeLeft : Math.max(0, focus.totalDuration - focus.timeLeft)) : 0;
    const displayValue = value + (secondsPerUnit ? elapsed / secondsPerUnit : 0);
    const complete = ready && value >= target;
    const progress = ready ? Math.min(1, Math.max(0, displayValue / target)) : 0;
    const editable = ready && isToday && !live;
    const ring = useSharedValue(progress);
    const done = useSharedValue(complete ? 1 : 0);
    const press = useSharedValue(1);
    useEffect(() => {
        ring.value = withTiming(progress, { duration: live ? 900 : 420, reduceMotion: ReduceMotion.System });
        done.value = withSpring(complete ? 1 : 0, { damping: 18, stiffness: 150, reduceMotion: ReduceMotion.System });
    }, [progress, complete, live, ring, done]);
    const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - ring.value) }));
    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
    const iconStyle = useAnimatedStyle(() => ({ borderRadius: 11 + done.value * 7, transform: [{ rotate: `${done.value * 360}deg` }] }));
    // Only worth a line when something is happening, or cannot: "progress
    // saves as you go" on every visit is furniture, not information.
    const note = saving ? 'Saving your progress…' : !ready ? 'Loading your progress…'
        : live ? 'Keeps running when you leave this screen'
        : kind === 'timer' && isToday && !complete ? 'Completes when the time has actually been run'
        : !isToday ? 'Past days are read-only' : null;

    /**
     * Ask Health for this day's number.
     *
     * Health is a floor, never a ceiling: someone who walked on a second phone
     * has a number Health cannot see, and replacing it with a smaller one would
     * be taking work away from them.
     */
    const askHealth = React.useCallback(async (byHand: boolean) => {
        if (!health || asking) return;
        setAsking(true);
        try {
            const fromHealth = await readHealth(health, new Date(`${date}T12:00:00`));
            const merged = mergeHealth(value, fromHealth);
            if (merged !== value) onChange(merged);
            else if (byHand) selectionFeedback();
        } finally {
            setAsking(false);
        }
    }, [health, asking, date, value, onChange, selectionFeedback]);

    // Once per day shown, and only when the day is still open: a habit Health
    // answers for should be answered before you are asked to tick it.
    useEffect(() => {
        const key = `${habit.id}:${date}`;
        if (!health || !ready || !isToday || asked.current === key) return;
        asked.current = key;
        void askHealth(false);
    }, [health, ready, isToday, habit.id, date, askHealth]);

    const beginEditing = () => {
        selectionFeedback();
        setDraft(String(value));
        setInputError(null);
        setEditing(true);
    };
    const saveDraft = () => {
        const amount = parseMeasurement(draft);
        if (amount === null) { setInputError('Enter a number from 0 to 100,000,000.'); return; }
        onChange(amount);
        Keyboard.dismiss();
        setEditing(false);
    };
    const start = () => {
        if (focus.activeHabitId && focus.activeHabitId !== habit.id && (focus.isRunning || focus.isPaused)) {
            Alert.alert('Another session is active', `Finish or pause your work with “${focus.activeHabitName || 'another habit'}” and end that session before starting this one.`);
            return;
        }
        mediumFeedback();
        const duration = Math.max(1, Math.ceil((target - value) * secondsPerUnit));
        focus.startTimer(habit.id, habit.name, duration, 'pomodoro');
    };
    const finishSession = () => {
        selectionFeedback();
        focus.stopTimer();
    };
    const primary = () => {
        if (live) { selectionFeedback(); focus.isPaused ? focus.resumeTimer() : focus.pauseTimer(); }
        else if (complete) onChange(0);
        else if (kind === 'timer') start();
        else if (kind === 'boolean') onChange(target);
        else onAdd(step);
    };
    const mainLabel = live ? (focus.isPaused ? 'Resume' : 'Pause') : complete ? 'Completed'
        : kind === 'timer' ? (value > 0 ? 'Continue' : 'Start') : kind === 'boolean' ? (habit.type === 'quit' ? 'I stayed on track' : 'Mark as done') : `Add ${formatMeasurement(step)} ${unit}`;
    // Timed habits: what is left of the day's target, in seconds, ticking live.
    const remaining = secondsPerUnit ? Math.max(0, (target - displayValue) * secondsPerUnit) : 0;
    const targetLabel = describeAmount(habit, target);
    const banked = secondsPerUnit && displayValue > 0 && !complete ? `${formatDuration(displayValue * secondsPerUnit, true)} done` : null;

    return (
        <Animated.View layout={morph}>
            <VoidCard matte style={styles.card}>
                {!isToday ? (
                    <View style={styles.cardTop}>
                        <View style={[styles.datePill, { backgroundColor: raised }]}>
                            <Text style={[Typography.caption, { color: colors.textPrimary }]}>{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                        </View>
                    </View>
                ) : null}
                {kind === 'timer' ? (
                    <FocusDial
                        progress={progress}
                        remaining={remaining}
                        targetLabel={targetLabel}
                        doneLabel={banked}
                        running={live}
                        paused={live && focus.isPaused}
                        complete={complete}
                        color={accent}
                        success={colors.success}
                    />
                ) : (
                <View style={styles.dial} accessible accessibilityRole="progressbar" accessibilityLabel={`${habit.name} progress`} accessibilityValue={{ min: 0, max: target, now: Math.min(displayValue, target), text: `${formatMeasurement(displayValue)} of ${formatMeasurement(target)} ${unit}` }}>
                    <Svg width={156} height={156} style={StyleSheet.absoluteFill}>
                        {/* A filled well, not a hoop drawn on the background:
                            the track needs something behind it or the ring is
                            a line floating in space. */}
                        <Circle cx={78} cy={78} r={RING} stroke={track} strokeWidth={7} fill="none" />
                        <AnimatedCircle cx={78} cy={78} r={RING} stroke={complete ? colors.success : accent} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} animatedProps={ringProps} rotation={-90} origin="78,78" opacity={progress > 0 ? 1 : 0} />
                    </Svg>
                    <Animated.View style={[styles.dialIcon, { backgroundColor: complete ? colors.success : (habit.color || accent) }, iconStyle]}>
                        <AppIcon filled name={complete ? 'checkmark' : habit.icon || 'sparkles-outline'} size={17} color={textOn(complete ? colors.success : (habit.color || accent))} />
                    </Animated.View>
                    <Animated.Text key={kind === 'boolean' ? String(complete) : String(value)} entering={enter} style={[styles.value, { color: colors.textPrimary, fontSize: kind === 'boolean' ? 27 : 34 }]} numberOfLines={1} adjustsFontSizeToFit>
                        {!ready ? '—' : kind === 'boolean' ? (complete ? 'Done' : 'Ready') : formatMeasurement(value)}
                    </Animated.Text>
                    {kind !== 'boolean' ? (
                        <Text style={[Typography.caption, { color: colors.textTertiary }]}>of {formatMeasurement(target)} {unit}</Text>
                    ) : null}
                </View>
                )}
                <View style={styles.gap} />

                {!isToday ? (
                    <Pressable onPress={onToday} accessibilityRole="button" style={[styles.secondary, { backgroundColor: raised }]}>
                        <AppIcon name="arrow-forward-outline" color={ink} size={18} />
                        <Text style={[Typography.button, { color: ink }]}>Back to today</Text>
                    </Pressable>
                ) : editing ? (
                    <Animated.View entering={enter} exiting={exit} layout={morph} style={styles.editor}>
                        <Text style={[Typography.caption, { color: colors.textSecondary }]}>Total for today · {unit}</Text>
                        <View style={styles.entryRow}>
                            <MatteInput autoFocus value={draft} onChangeText={text => { setDraft(text); setInputError(null); }} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={saveDraft} selectTextOnFocus accessibilityLabel={`Total ${unit} for today`} style={[styles.input, { color: colors.textPrimary, backgroundColor: raised, borderColor: inputError ? colors.error : tone.line }]} />
                            <IconButton icon="checkmark" label="Save total" onPress={saveDraft} diameter={44} color={accent} />
                        </View>
                        {inputError && <Text accessibilityRole="alert" style={[Typography.caption, { color: colors.error }]}>{inputError}</Text>}
                        <Pressable onPress={() => { setEditing(false); Keyboard.dismiss(); }} accessibilityRole="button" style={styles.textButton}><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Cancel</Text></Pressable>
                    </Animated.View>
                ) : (
                    <Animated.View layout={morph} style={styles.controls}>
                        {kind === 'counter' && !complete && (
                            <View style={styles.quickRow}>
                                {/* A static style, deliberately: a Pressable whose style is a
                                    function does not lay out with flex on this
                                    React Native, and these must share the row. */}
                                {quickAmounts.map(amount => <Pressable key={amount} onPress={() => onAdd(amount)} disabled={!editable} accessibilityRole="button" accessibilityLabel={`Add ${formatMeasurement(amount)} ${unit}`} style={[styles.quickPress, { opacity: editable ? 1 : 0.5 }]}><MatteSurface radius={Radius.small} level="control" style={styles.quick}><Text style={[Typography.button, { color: colors.textPrimary }]}>+{formatMeasurement(amount)}</Text></MatteSurface></Pressable>)}
                            </View>
                        )}
                        {/* Matte, like every other button; done, its tick turns green. */}
                        <Animated.View style={[pressStyle, !ready && styles.disabled]}>
                            <Pressable onPress={primary} disabled={!ready || complete} accessibilityRole="button" accessibilityLabel={mainLabel} accessibilityState={{ disabled: !ready || complete }} onPressIn={() => press.set(withSpring(0.97))} onPressOut={() => press.set(withSpring(1))}>
                                <MatteSurface radius={Radius.control} level="control" style={styles.primary}>
                                    <AppIcon filled name={live ? (focus.isPaused ? 'play' : 'pause') : complete ? 'checkmark-circle' : kind === 'timer' ? 'play' : kind === 'boolean' ? 'checkmark' : 'add'} color={complete ? colors.success : colors.textPrimary} size={20} />
                                    <Text style={[Typography.button, { color: colors.textPrimary }]}>{mainLabel}</Text>
                                </MatteSurface>
                            </Pressable>
                        </Animated.View>
                        <View style={styles.utilityRow}>
                            {/* Ending keeps only the time actually run; there is no
                                way to type time into a timed habit. */}
                            {live ? <Pressable onPress={finishSession} accessibilityRole="button" accessibilityHint="Saves the time you have run so far" style={styles.textButton}><AppIcon name="stop-outline" size={16} color={colors.textSecondary} /><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>End session</Text></Pressable>
                                : kind === 'counter' ? <Pressable disabled={!editable} onPress={beginEditing} accessibilityRole="button" style={styles.textButton}><AppIcon name="create-outline" size={16} color={colors.textSecondary} /><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Set exact total</Text></Pressable> : null}
                            {health && !live ? (
                                <Pressable disabled={asking} onPress={() => void askHealth(true)} accessibilityRole="button"
                                    accessibilityLabel={`Read ${healthLabel(health)} from Apple Health`} style={styles.textButton}>
                                    <AppIcon name={asking ? 'sync-outline' : 'heart-outline'} size={16} color={colors.textSecondary} />
                                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                                        {asking ? 'Asking Health…' : 'Read from Health'}
                                    </Text>
                                </Pressable>
                            ) : null}
                            {!live && (canUndo || complete || value > 0) && <Pressable disabled={!editable} onPress={canUndo ? onUndo : () => onChange(0)} accessibilityRole="button" style={styles.textButton}><AppIcon name="arrow-undo-outline" size={15} color={colors.textSecondary} /><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{canUndo || complete ? 'Undo' : 'Reset'}</Text></Pressable>}
                        </View>
                    </Animated.View>
                )}
                {error ? <Text accessibilityRole="alert" style={[Typography.caption, styles.center, { color: colors.error }]}>{error}</Text>
                    : saving ? <Text accessibilityLiveRegion="polite" style={[styles.saveNote, { color: colors.textTertiary }]}>{note}</Text> : null}
            </VoidCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: { padding: 18, gap: 4 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    datePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, flexDirection: 'row', gap: 6, alignItems: 'center' },
    dot: { width: 5, height: 5, borderRadius: 3 },
    dial: { width: 156, height: 156, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
    dialIcon: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 1 },
    value: { fontFamily: FontFamily.bold, lineHeight: 42, letterSpacing: -1.2, maxWidth: 122, fontVariant: ['tabular-nums'] },
    center: { textAlign: 'center' },
    status: { textAlign: 'center', marginBottom: 10, paddingHorizontal: 4 },
    controls: { alignSelf: 'stretch', gap: 8 },
    quickRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 8 },
    quickPress: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    quick: { minHeight: Control.hitTarget, alignItems: 'center', justifyContent: 'center' },
    gap: { height: 10 },
    primary: { minHeight: Control.height, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    secondary: { minHeight: Control.height, borderRadius: Radius.control, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
    utilityRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, flexWrap: 'wrap' },
    textButton: { minHeight: Control.hitTarget, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    saveNote: { fontFamily: FontFamily.regular, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 1 },
    editor: { gap: 8 },
    entryRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minHeight: Control.height, fontFamily: FontFamily.display, fontSize: 26, borderWidth: 1, borderRadius: Radius.small, paddingHorizontal: 16 },
    save: { width: 54, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.small },
    disabled: { opacity: 0.5 },
});
