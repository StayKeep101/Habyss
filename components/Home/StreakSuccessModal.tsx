import { FontFamily } from '@/theme/designSystem';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import Animated, {
    Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue,
    runOnJS, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { useHaptics } from '@/hooks/useHaptics';
import { localDateKey } from '@/lib/habitSchedule';

const FLAME = '#FF9D23';
const CLOSE = { duration: 200, easing: Easing.in(Easing.cubic) };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The streak, as a card that rises from the bottom.
 *
 * It used to take the whole screen for one sentence and a week strip, which
 * made finishing a day feel like an interruption. Now it sits over the list
 * you were looking at: the flame badge breaks out of the top edge, the days
 * fill in one after another, and the card leaves the way it came.
 */
export const StreakSuccessModal = ({ visible, streak, onClose, completedDates = [] }: {
    visible: boolean; streak: number; onClose: () => void; completedDates?: string[];
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const insets = useSafeAreaInsets();
    const { successFeedback, lightFeedback } = useHaptics();
    const reduceMotion = useReducedMotion();

    const [mounted, setMounted] = useState(visible);
    const progress = useSharedValue(0);
    const flicker = useSharedValue(0);

    // Mounted as soon as it is asked for, and unmounted by the closing
    // animation itself, so the card is never cut off mid-exit.
    if (visible && !mounted) setMounted(true);

    useEffect(() => {
        if (visible) {
            successFeedback();
            progress.value = withSpring(1, { damping: 18, stiffness: 180, mass: 0.7 });
            return;
        }
        progress.value = withTiming(0, CLOSE, finished => {
            if (finished) runOnJS(setMounted)(false);
        });
    }, [visible]);

    // A flame that sits perfectly still looks like a sticker. It breathes,
    // barely, and leans a degree either way. Reduced motion keeps it still.
    useEffect(() => {
        if (!visible || reduceMotion) { flicker.value = 0; return; }
        flicker.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            false,
        );
    }, [visible, reduceMotion]);

    const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
    const card = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.35, 1], [0, 1, 1]),
        transform: [{ translateY: interpolate(progress.value, [0, 1], [420, 0]) }],
    }));
    // Leans a few degrees each way and breathes, the way a flame moves.
    const badge = useAnimatedStyle(() => ({
        transform: [
            { scale: interpolate(progress.value, [0, 0.6, 1], [0.4, 1.08, 1]) + flicker.value * 0.04 },
            { rotateZ: `${interpolate(flicker.value, [0, 1], [-3.5, 3.5])}deg` },
            { translateY: flicker.value * -1.5 },
        ],
    }));

    const today = new Date();
    const week = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - today.getDay() + index);
        return { date, key: localDateKey(date) };
    });

    if (!mounted) return null;

    const close = () => { lightFeedback(); onClose(); };

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <View style={styles.root}>
                <AnimatedPressable
                    testID="streak-scrim"
                    accessibilityLabel="Close"
                    onPress={close}
                    style={[StyleSheet.absoluteFill, scrim, { backgroundColor: '#000' }]}
                />

                <Animated.View style={[styles.card, card, {
                    paddingBottom: Math.max(insets.bottom, 14) + 6,
                    backgroundColor: isLight ? '#FFFFFF' : '#0E1116',
                    borderColor: colors.border,
                }]}>
                    <BlurView intensity={isLight ? 0 : 18} tint="dark" style={StyleSheet.absoluteFill} />

                    {/* Just the flame, half out of the card's top edge: a badge
                        around it made it look like an app icon stuck on. */}
                    <Animated.View style={[styles.badgeWrap, badge]}>
                        <Ionicons name="flame" size={58} color={FLAME} />
                    </Animated.View>

                    <Text style={[styles.title, { color: colors.textPrimary }]}>{streak}-day streak</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>Today counts. One thing tomorrow keeps it going.</Text>

                    <View style={styles.week}>
                        {week.map(({ date, key }, index) => (
                            <Day
                                key={key}
                                label={date.toLocaleDateString('en', { weekday: 'narrow' })}
                                done={completedDates.includes(key)}
                                isToday={key === localDateKey(today)}
                                index={index}
                                progress={progress}
                                colors={colors}
                            />
                        ))}
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Keep going"
                        onPress={close}
                        // Static, not a function: a Pressable whose style is a function
                        // does not lay out with flex on this React Native, and this
                        // button has to stretch the width of the card.
                        style={[styles.button, { backgroundColor: colors.primary }]}
                    >
                        <Text style={styles.buttonText}>Keep going</Text>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
};

/** One day of the week strip, filling in after the card has arrived. */
const Day = ({ label, done, isToday, index, progress, colors }: {
    label: string; done: boolean; isToday: boolean; index: number;
    progress: SharedValue<number>; colors: typeof Colors.light;
}) => {
    const start = 0.35 + index * 0.06;
    const style = useAnimatedStyle(() => {
        const t = Math.min(1, Math.max(0, (progress.value - start) / (1 - start)));
        return {
            opacity: interpolate(t, [0, 1], [0.35, 1]),
            transform: [{ scale: interpolate(t, [0, 0.7, 1], [0.7, 1.06, 1]) }],
        };
    });

    return (
        <View style={styles.day}>
            <Text style={[styles.dayLabel, { color: colors.textTertiary }]}>{label}</Text>
            <Animated.View style={[styles.dayDot, style, {
                backgroundColor: done ? FLAME : colors.surfaceSecondary,
                borderColor: isToday ? FLAME : 'transparent',
                borderWidth: isToday ? 2 : 0,
            }]}>
                <Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={18} color={done ? '#fff' : colors.textTertiary} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    card: {
        marginHorizontal: 10, marginBottom: 10, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth,
        paddingTop: 58, paddingHorizontal: 24, alignItems: 'center', gap: 8,
        shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 14,
    },
    badgeWrap: {
        position: 'absolute', top: -40, alignItems: 'center', justifyContent: 'center',
        shadowColor: FLAME, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    },
    title: { fontSize: 25, fontFamily: FontFamily.bold, letterSpacing: -0.4 },
    body: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular, textAlign: 'center' },
    week: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 20, marginBottom: 22 },
    day: { alignItems: 'center', gap: 9 },
    dayLabel: { fontSize: 12, fontFamily: FontFamily.regular },
    dayDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    button: { alignSelf: 'stretch', paddingVertical: 16, borderRadius: 18, alignItems: 'center' },
    buttonText: { color: '#fff', fontFamily: FontFamily.semibold, fontSize: 16 },
});
