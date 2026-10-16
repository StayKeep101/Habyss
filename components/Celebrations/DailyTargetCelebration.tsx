import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, interpolate, ReduceMotion, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing, elevationFor, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useTasks } from '@/hooks/useTasks';
import { on } from '@/lib/appEvents';
import { localDateKey } from '@/lib/habitSchedule';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const CLOSE = { duration: 200, easing: Easing.in(Easing.cubic) };
const RING = 112;
const STROKE = 9;
const GAP_DEG = 10;

/**
 * Today's tasks, all done: the daily target kept (3 or 5, as set).
 *
 * The same shape as the streak popup — a matte card rising from the bottom,
 * its mark half out of the top edge — so the app's celebrations read as one
 * family. The mark is a ring cut into one segment per task, lighting up one
 * after another in the accent gradient around a check, and the card names
 * the tasks that did it.
 */
export function DailyTargetCelebration() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { colors: gradient } = useAccentGradient();
    const insets = useSafeAreaInsets();
    const { successFeedback, lightFeedback } = useHaptics();
    const tasks = useTasks();

    const [target, setTarget] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    const progress = useSharedValue(0);
    const fill = useSharedValue(0);

    useEffect(() => {
        const subscription = on('daily_target_reached', payload => setTarget(payload?.target ?? 3));
        return () => subscription.remove();
    }, []);

    const visible = target !== null;
    if (visible && !mounted) setMounted(true);

    useEffect(() => {
        if (visible) {
            successFeedback();
            progress.value = withSpring(1, { damping: 18, stiffness: 180, mass: 0.7 });
            fill.value = 0;
            fill.value = withDelay(300, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
            return;
        }
        progress.value = withTiming(0, CLOSE, finished => { if (finished) runOnJS(setMounted)(false); });
    }, [visible, progress, fill, successFeedback]);

    const close = useCallback(() => { lightFeedback(); setTarget(null); }, [lightFeedback]);

    // The tasks finished today, newest first: what kept the promise.
    const done = useMemo(() => {
        const today = localDateKey(new Date());
        return tasks
            .filter(task => task.status === 'done' && task.completedAt && localDateKey(new Date(task.completedAt)) === today)
            .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
            .slice(0, target ?? 3);
    }, [tasks, target]);

    const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
    const card = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.35, 1], [0, 1, 1]),
        transform: [{ translateY: interpolate(progress.value, [0, 1], [420, 0]) }],
    }));
    const mark = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress.value, [0, 0.6, 1], [0.4, 1.08, 1]) }] }));
    const check = useAnimatedStyle(() => ({
        opacity: interpolate(fill.value, [0.75, 1], [0, 1], 'clamp'),
        transform: [{ scale: interpolate(fill.value, [0.75, 0.92, 1], [0.5, 1.15, 1], 'clamp') }],
    }));

    if (!mounted) return null;
    const count = target ?? 3;

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <View style={styles.root}>
                <AnimatedPressable accessibilityLabel="Close" onPress={close} style={[StyleSheet.absoluteFill, scrim, { backgroundColor: colors.background }]} />
                <Animated.View style={[styles.card, card, elevationFor(theme, 'floating'), { paddingBottom: Math.max(insets.bottom, 14) + 6, backgroundColor: tone.fill }]}>
                    <View pointerEvents="none" style={styles.material}>
                        <LinearGradient colors={[tone.top, tone.fill, tone.bottom]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                    </View>

                    {/* The ring: one segment per task, lighting up in turn. */}
                    <Animated.View style={[styles.markWrap, mark]}>
                        <View style={[styles.markDisc, { backgroundColor: tone.fill }]}>
                            <Svg width={RING} height={RING}>
                                <Defs>
                                    <SvgGradient id="target-ring" x1="0" y1="0" x2="1" y2="1">
                                        <Stop offset="0" stopColor={gradient[0]} />
                                        <Stop offset="1" stopColor={gradient[1]} />
                                    </SvgGradient>
                                </Defs>
                                {Array.from({ length: count }, (_, index) => (
                                    <Segment key={index} index={index} count={count} fill={fill} track={tone.raised} />
                                ))}
                            </Svg>
                            <Animated.View style={[styles.check, check]}>
                                <AppIcon name="checkmark" size={40} color={gradient[1]} />
                            </Animated.View>
                        </View>
                    </Animated.View>

                    <Text style={[styles.kicker, { color: colors.textSecondary }]}>Today’s tasks</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{count} for {count}</Text>
                    <Text style={[styles.line, { color: colors.textSecondary }]}>Today’s promise, kept.</Text>

                    {done.length ? (
                        <View style={styles.list}>
                            {done.map(task => (
                                <View key={task.id} style={styles.row}>
                                    <View style={[styles.tick, { backgroundColor: colors.success }]}>
                                        <AppIcon name="checkmark" size={11} color={colors.background} />
                                    </View>
                                    <Text numberOfLines={1} style={[styles.rowText, { color: colors.textPrimary }]}>{task.title}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    <Pressable accessibilityRole="button" accessibilityLabel="Keep going" onPress={close} style={styles.buttonWrap}>
                        <MatteSurface radius={Radius.control} level="control" style={styles.button}>
                            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Keep going</Text>
                        </MatteSurface>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
}

/** One task's arc of the ring: grey track, then the gradient sweeping in. */
function Segment({ index, count, fill, track }: { index: number; count: number; fill: SharedValue<number>; track: string }) {
    const radius = (RING - STROKE) / 2;
    const circumference = 2 * Math.PI * radius;
    const span = 360 / count - GAP_DEG;
    const length = (span / 360) * circumference;
    const rotation = -90 + index * (360 / count) + GAP_DEG / 2;
    const start = index / count;
    const end = (index + 1) / count;
    const props = useAnimatedProps(() => {
        const local = Math.max(0, Math.min(1, (fill.value - start) / (end - start)));
        return { strokeDashoffset: length * (1 - local) };
    });
    const common = { cx: RING / 2, cy: RING / 2, r: radius, strokeWidth: STROKE, fill: 'none', strokeLinecap: 'round' as const, rotation, origin: `${RING / 2}, ${RING / 2}` };
    return (
        <>
            <Circle {...common} stroke={track} strokeDasharray={`${length} ${circumference}`} />
            <AnimatedCircle {...common} stroke="url(#target-ring)" strokeDasharray={`${length} ${circumference}`} animatedProps={props} />
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    card: { marginHorizontal: 10, marginBottom: 10, borderRadius: 30, paddingTop: RING / 2 + Spacing.lg, paddingHorizontal: 24, alignItems: 'center', gap: Spacing.xs + 2 },
    material: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, overflow: 'hidden' },
    markWrap: { position: 'absolute', top: -RING / 2 },
    markDisc: { width: RING + 12, height: RING + 12, borderRadius: (RING + 12) / 2, alignItems: 'center', justifyContent: 'center' },
    check: { position: 'absolute' },
    kicker: { fontFamily: FontFamily.medium, fontSize: 14 },
    title: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
    line: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
    list: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    tick: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    buttonWrap: { alignSelf: 'stretch', marginTop: Spacing.md },
    button: { paddingVertical: 16, alignItems: 'center' },
    buttonText: { fontSize: 16, fontFamily: FontFamily.semibold },
});
