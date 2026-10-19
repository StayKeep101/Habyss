import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { textOn } from '@/theme/tokens';
import { AppButton } from '@/components/ui/AppButton';
import Animated, {
    Easing, FadeIn, FadeOut, ReduceMotion, interpolate,
    useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';

const MOTION = { duration: 520, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const RAYS = 12;

type Milestone =
    | { kind: 'goal'; title: string; line: string }
    | { kind: 'daily'; title: string; line: string };

/**
 * A finished goal, the biggest moment the app stops for. (The day's tasks
 * kept have their own card: DailyTargetCelebration.)
 *
 * A finished goal and a kept daily promise are not the same size, and drawing
 * them the same way would make the larger one feel cheap. A goal gets the
 * full burst — rays, a struck ring, the goal's own name — while the day's
 * promise gets a quieter version of the same shape, so the two read as
 * relatives rather than as one thing reused.
 *
 * It lives at the root of the app: a habit can be ticked from the roadmap, a
 * goal, a notification or a widget, and the moment it finishes something is
 * the moment worth marking, wherever you happen to be.
 */
export const MilestoneCelebration: React.FC = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary } = useAccentGradient();
    const { successFeedback, lightFeedback } = useHaptics();

    const [shown, setShown] = useState<Milestone | null>(null);
    const burst = useSharedValue(0);
    const ring = useSharedValue(0);

    const close = useCallback(() => setShown(null), []);

    useEffect(() => {
        const subs = [
            on('goal_complete', payload => setShown({
                kind: 'goal',
                title: payload?.name ?? 'Goal complete',
                line: 'You set out to do this, and you did it.',
            })),
        ];
        return () => subs.forEach(sub => sub.remove());
    }, []);

    useEffect(() => {
        if (!shown) { burst.value = 0; ring.value = 0; return; }
        // The bigger moment gets the heavier tap.
        if (shown.kind === 'goal') successFeedback(); else lightFeedback();
        burst.value = withTiming(1, MOTION);
        ring.value = withDelay(90, withSequence(
            withTiming(1.06, { ...MOTION, duration: 360 }),
            withTiming(1, { ...MOTION, duration: 220 }),
        ));
    }, [shown, burst, ring, successFeedback, lightFeedback]);

    const big = shown?.kind === 'goal';

    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ring.value || 0.8 }],
        opacity: interpolate(burst.value, [0, 0.4, 1], [0, 1, 1], 'clamp'),
    }));

    const cardStyle = useAnimatedStyle(() => ({
        opacity: burst.value,
        transform: [{ translateY: interpolate(burst.value, [0, 1], [18, 0]) }],
    }));

    if (!shown) return null;

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.fill}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    onPress={close}
                    style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(0,0,0,0.76)' }]}
                />

                <View pointerEvents="none" style={styles.centre}>
                    {/* Rays, only for the larger moment. */}
                    {big ? (
                        <View style={styles.rays}>
                            {Array.from({ length: RAYS }, (_, index) => (
                                <Ray key={index} index={index} burst={burst} tint={primary} />
                            ))}
                        </View>
                    ) : null}

                    <Animated.View
                        style={[styles.ring, ringStyle, {
                            width: big ? s(118) : s(92),
                            height: big ? s(118) : s(92),
                            borderRadius: big ? s(59) : s(46),
                            borderColor: 'transparent',
                            backgroundColor: primary,
                        }]}
                    >
                        <Ionicons
                            name={big ? 'trophy' : 'checkmark-done'}
                            size={big ? s(48) : s(36)}
                            color={textOn(primary)}
                        />
                    </Animated.View>
                </View>

                <Animated.View style={[styles.card, cardStyle]} pointerEvents="box-none">
                    <Text style={[styles.kicker, { color: colors.textTertiary }]}>
                        {big ? 'Goal complete' : 'Day kept'}
                    </Text>
                    <Text numberOfLines={3} style={[styles.title, { color: colors.textPrimary, fontSize: big ? ms(28) : ms(23) }]}>
                        {shown.title}
                    </Text>
                    <Text style={[styles.line, { color: colors.textSecondary }]}>{shown.line}</Text>

                    <AppButton label={big ? 'Take it in' : 'Good'} onPress={close} />
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

/** One spoke of the burst, thrown out and fading as it goes. */
const Ray: React.FC<{ index: number; burst: SharedValue<number>; tint: string }> = ({ index, burst, tint }) => {
    const angle = (index / RAYS) * 360;
    // Worked out here: a worklet cannot call s() (a plain function) on the UI thread.
    const near = -s(52);
    const far = -s(104);
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(burst.value, [0, 0.25, 0.7, 1], [0, 0.9, 0.5, 0], 'clamp'),
        transform: [
            { rotate: `${angle}deg` },
            { translateY: interpolate(burst.value, [0, 1], [near, far]) },
            { scaleY: interpolate(burst.value, [0, 0.5, 1], [0.4, 1, 0.6]) },
        ],
    }));
    return <Animated.View style={[styles.ray, style, { backgroundColor: tint }]} />;
};

const styles = StyleSheet.create({
    fill: { flex: 1, justifyContent: 'center' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    centre: { alignItems: 'center', justifyContent: 'center' },
    rays: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    ray: { position: 'absolute', width: s(3), height: s(22), borderRadius: s(2) },
    ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    card: { alignItems: 'center', paddingHorizontal: s(34), marginTop: vs(26), gap: vs(8) },
    kicker: { fontSize: ms(13), fontFamily: FontFamily.medium },
    title: { fontFamily: FontFamily.bold, textAlign: 'center', lineHeight: ms(34) },
    line: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.regular, textAlign: 'center' },
    button: { marginTop: vs(18), paddingHorizontal: s(28), paddingVertical: vs(12), borderRadius: 999 },
    buttonText: { color: '#fff', fontSize: ms(15), fontFamily: FontFamily.semibold },
});
