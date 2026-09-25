import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion, interpolateColor, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '@/components/Common/AppIcon';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { Control, FontFamily, Radius, Typography } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useFocusTime } from '@/constants/FocusTimeContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Habit } from '@/lib/habitsSQLite';
import { formatMeasurement, localHabitDate, measurementFor, parseMeasurement } from '@/lib/habitMeasurement';
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
    const successInk = readableAccent(colors.success, colors.surfaceSecondary);
    const { kind, target, unit, step, quickAmounts, secondsPerUnit } = measurementFor(habit);
    const focus = useFocusTime();
    const { selectionFeedback, mediumFeedback } = useHaptics();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [inputError, setInputError] = useState<string | null>(null);
    const isToday = date === localHabitDate();
    const active = focus.activeHabitId === habit.id && (focus.isRunning || focus.isPaused);
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
    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: press.value }],
        borderRadius: 18 + done.value * 9,
        backgroundColor: interpolateColor(done.value, [0, 1], [accent, colors.success]),
    }));
    const iconStyle = useAnimatedStyle(() => ({ borderRadius: 11 + done.value * 7, transform: [{ rotate: `${done.value * 360}deg` }] }));
    const foreground = readableAccent('#FFFFFF', complete ? colors.success : accent);
    const status = !isToday ? 'Daily record' : live ? (focus.isPaused ? 'Take your time' : 'In your element')
        : complete ? (habit.type === 'quit' ? 'You kept your promise' : 'A little better, every day') : value > 0 ? 'You’re making progress' : 'One small step starts here';
    // Only worth a line when something is happening, or cannot: "progress
    // saves as you go" on every visit is furniture, not information.
    const note = saving ? 'Saving your progress…' : !ready ? 'Loading your progress…'
        : live ? 'Your timer keeps going when you leave this screen'
        : !isToday ? 'Past days are read-only' : null;

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
    const mainLabel = live ? (focus.isPaused ? 'Resume session' : 'Pause session') : complete ? 'Completed'
        : kind === 'timer' ? 'Start focus session' : kind === 'boolean' ? (habit.type === 'quit' ? 'I stayed on track' : 'Mark as done') : `Add ${formatMeasurement(step)} ${unit}`;
    const seconds = live ? focus.timeLeft : 0;
    const clock = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

    return (
        <Animated.View layout={morph}>
            <VoidCard style={[styles.card, { borderColor: complete ? colors.success + '55' : colors.border }]}>
                <LinearGradient pointerEvents="none" colors={[accent + '12', 'transparent']} style={StyleSheet.absoluteFill} />
                <View style={styles.cardTop}>
                    <View style={[styles.datePill, { backgroundColor: colors.surfaceTertiary }]}>
                        <View style={[styles.dot, { backgroundColor: complete ? colors.success : accent }]} />
                        <Text style={[Typography.caption, { color: colors.textPrimary }]}>{isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                    </View>
                    <Text style={[Typography.caption, { color: colors.textSecondary }]}>{kind === 'boolean' ? 'Daily check-in' : `Goal · ${formatMeasurement(target)} ${unit}`}</Text>
                </View>
                <View style={styles.dial} accessible accessibilityRole="progressbar" accessibilityLabel={`${habit.name} progress`} accessibilityValue={{ min: 0, max: target, now: Math.min(displayValue, target), text: `${formatMeasurement(displayValue)} of ${formatMeasurement(target)} ${unit}` }}>
                    <Svg width={156} height={156} style={StyleSheet.absoluteFill}>
                        <Circle cx={78} cy={78} r={76} stroke={accent + '12'} strokeWidth={1} fill="none" />
                        <Circle cx={78} cy={78} r={RING} stroke={colors.surfaceTertiary} strokeWidth={6} fill="none" />
                        <AnimatedCircle cx={78} cy={78} r={RING} stroke={complete ? colors.success : accent} strokeWidth={6} strokeLinecap="round" fill="none" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} animatedProps={ringProps} rotation={-90} origin="78,78" opacity={progress > 0 ? 1 : 0} />
                    </Svg>
                    <Animated.View style={[styles.dialIcon, { backgroundColor: (complete ? colors.success : accent) + '18' }, iconStyle]}>
                        <AppIcon name={complete ? 'checkmark' : habit.icon || 'sparkles-outline'} size={17} color={complete ? successInk : ink} />
                    </Animated.View>
                    <Animated.Text key={live ? 'clock' : kind === 'boolean' ? String(complete) : String(value)} entering={enter} style={[styles.value, { color: colors.textPrimary, fontSize: live ? 30 : kind === 'boolean' ? 27 : 34 }]} numberOfLines={1} adjustsFontSizeToFit>
                        {!ready ? '—' : live ? clock : kind === 'boolean' ? (complete ? 'Done' : 'Ready') : formatMeasurement(value)}
                    </Animated.Text>
                    <Text style={[Typography.caption, { color: complete ? successInk : colors.textSecondary }]}>
                        {live ? (focus.isPaused ? 'PAUSED' : focus.activeMode === 'flow' ? 'ELAPSED' : 'REMAINING') : kind === 'boolean' ? (complete ? 'you showed up' : 'when you are') : `${unit} ${complete ? 'logged' : 'so far'}`}
                    </Text>
                </View>
                <Text accessibilityLiveRegion="polite" style={[Typography.heading, styles.status, { color: complete ? successInk : colors.textPrimary }]}>{status}</Text>

                {!isToday ? (
                    <Pressable onPress={onToday} accessibilityRole="button" style={[styles.secondary, { backgroundColor: colors.surfaceTertiary }]}>
                        <AppIcon name="arrow-forward-outline" color={ink} size={18} />
                        <Text style={[Typography.button, { color: ink }]}>Back to today</Text>
                    </Pressable>
                ) : editing ? (
                    <Animated.View entering={enter} exiting={exit} layout={morph} style={styles.editor}>
                        <Text style={[Typography.caption, { color: colors.textSecondary }]}>Total for today · {unit}</Text>
                        <View style={styles.entryRow}>
                            <TextInput autoFocus value={draft} onChangeText={text => { setDraft(text); setInputError(null); }} keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={saveDraft} selectTextOnFocus accessibilityLabel={`Total ${unit} for today`} style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceTertiary, borderColor: inputError ? colors.error : colors.border }]} />
                            <Pressable onPress={saveDraft} accessibilityRole="button" accessibilityLabel="Save total" style={[styles.save, { backgroundColor: accent }]}><AppIcon name="checkmark" color={readableAccent('#FFFFFF', accent)} /></Pressable>
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
                                {quickAmounts.map(amount => <Pressable key={amount} onPress={() => onAdd(amount)} disabled={!editable} accessibilityRole="button" accessibilityLabel={`Add ${formatMeasurement(amount)} ${unit}`} style={[styles.quick, { backgroundColor: accent + '1c', borderColor: accent + '3d', opacity: editable ? 1 : 0.5 }]}><Text style={[Typography.button, { color: ink }]}>+{formatMeasurement(amount)}</Text></Pressable>)}
                            </View>
                        )}
                        <Animated.View style={[buttonStyle, !ready && styles.disabled]}>
                            <Pressable onPress={primary} disabled={!ready || complete} accessibilityRole="button" accessibilityLabel={mainLabel} accessibilityState={{ disabled: !ready || complete }} onPressIn={() => press.set(withSpring(0.97))} onPressOut={() => press.set(withSpring(1))} style={styles.primary}>
                                <AppIcon name={live ? (focus.isPaused ? 'play' : 'pause') : complete ? 'checkmark-circle' : kind === 'timer' ? 'play' : kind === 'boolean' ? 'checkmark' : 'add'} color={foreground} size={20} />
                                <Text style={[Typography.button, { color: foreground }]}>{mainLabel}</Text>
                            </Pressable>
                        </Animated.View>
                        <View style={styles.utilityRow}>
                            {live ? <Pressable onPress={finishSession} accessibilityRole="button" style={styles.textButton}><AppIcon name="stop-outline" size={16} color={colors.textSecondary} /><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Finish & save time</Text></Pressable>
                                : kind !== 'boolean' ? <Pressable disabled={!editable} onPress={beginEditing} accessibilityRole="button" style={styles.textButton}><AppIcon name="create-outline" size={16} color={colors.textSecondary} /><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{kind === 'timer' ? 'Log time manually' : 'Set exact total'}</Text></Pressable> : null}
                            {!live && (canUndo || complete || value > 0) && <Pressable disabled={!editable} onPress={canUndo ? onUndo : () => onChange(0)} accessibilityRole="button" style={styles.textButton}><AppIcon name="arrow-undo-outline" size={15} color={colors.textSecondary} /><Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{canUndo || complete ? 'Undo' : 'Reset'}</Text></Pressable>}
                        </View>
                    </Animated.View>
                )}
                {error ? <Text accessibilityRole="alert" style={[Typography.caption, styles.center, { color: colors.error }]}>{error}</Text>
                    : note ? <Text accessibilityLiveRegion="polite" style={[styles.saveNote, { color: colors.textTertiary }]}>{note}</Text> : null}
            </VoidCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: { padding: 16, gap: 4 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    datePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, flexDirection: 'row', gap: 6, alignItems: 'center' },
    dot: { width: 5, height: 5, borderRadius: 3 },
    dial: { width: 156, height: 156, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
    dialIcon: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 1 },
    value: { fontFamily: FontFamily.display, lineHeight: 42, letterSpacing: -1.2, maxWidth: 122, fontVariant: ['tabular-nums'] },
    center: { textAlign: 'center' },
    status: { textAlign: 'center', marginBottom: 10, paddingHorizontal: 4 },
    controls: { alignSelf: 'stretch', gap: 8 },
    quickRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 8 },
    quick: {
        flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
        minHeight: Control.hitTarget, alignItems: 'center', justifyContent: 'center',
        borderRadius: Radius.small, borderWidth: 1,
    },
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
