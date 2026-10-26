import { FontFamily } from '@/theme/designSystem';
import { useEffect, useRef, useState } from 'react';
import {Dimensions, Pressable, StyleSheet, Text, View} from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconTile } from '@/components/ui/IconTile';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import Animated, {
    Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/** Where the plus button is on screen, as it measured itself. */
interface Anchor { x: number; y: number; size: number }

const OPEN = { duration: 260, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 180, easing: Easing.in(Easing.cubic) };

/**
 * The menu behind the plus button.
 *
 * It opens exactly where the button is, because the button measures itself and
 * sends its position: the same plus, in the same place, turning 45 degrees into
 * a close button rather than being replaced by one somewhere nearby. The
 * choices are one card above it, like an iOS menu: each row the same width,
 * its kind's icon in the colour it has across the app, the name and a line
 * on what it is for. It settles up out of the button, eased, with no bounce.
 */
export const CreationModal = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary, secondary, buttonColors, shadowColor } = useAccentGradient();
    const { horizontalPadding, floatingButtonSize, tabBarBottomOffset } = useResponsiveLayout();
    const { mediumFeedback, lightFeedback } = useHaptics();

    const [visible, setVisible] = useState(false);
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const progress = useSharedValue(0);
    const pending = useRef<'habit' | 'goal' | 'task' | 'thought' | null>(null);
    const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const open = on('show_creation_modal', (data?: Partial<Anchor>) => {
            if (closing.current) { clearTimeout(closing.current); closing.current = null; }
            if (typeof data?.x === 'number' && typeof data?.y === 'number') {
                setAnchor({ x: data.x, y: data.y, size: data.size ?? floatingButtonSize });
            }
            setVisible(true);
            progress.value = withTiming(1, OPEN);
        });
        const close = on('close_creation_modal', () => dismiss());
        return () => {
            open.remove();
            close.remove();
            if (fallback.current) clearTimeout(fallback.current);
            if (closing.current) clearTimeout(closing.current);
        };
    }, [floatingButtonSize]);

    /** Plays the menu back into the button before the sheet goes away. */
    const dismiss = () => {
        progress.value = withTiming(0, CLOSE);
        if (closing.current) clearTimeout(closing.current);
        closing.current = setTimeout(() => { setVisible(false); closing.current = null; }, CLOSE.duration);
    };

    const openSelection = () => {
        const selection = pending.current;
        pending.current = null;
        if (fallback.current) clearTimeout(fallback.current);
        // Creating a habit opens quick add; the full form is for editing,
        // reachable from quick add's More options.
        if (selection === 'habit') emit('show_quick_add');
        if (selection === 'goal') emit('show_goal_quick_add');
        if (selection === 'task') emit('show_task_form');
        if (selection === 'thought') require('expo-router').router.push('/brain-dump');
    };

    const choose = (selection: 'habit' | 'goal' | 'task' | 'thought') => {
        if (pending.current) return;
        mediumFeedback();
        pending.current = selection;
        // The composer opens now, while the menu folds away behind it. It
        // used to wait for this menu's native modal to finish dismissing —
        // animation, iOS dismissal, then a safety timeout — which was most of a
        // second between the tap and a keyboard. The menu is a plain overlay
        // now, so nothing has to wait.
        openSelection();
        dismiss();
    };

    const screen = Dimensions.get('window');
    const size = anchor?.size ?? floatingButtonSize;
    // Falls back to where the button normally sits, if it never reported in.
    const right = anchor ? Math.max(0, screen.width - (anchor.x + size)) : horizontalPadding;
    const bottom = anchor ? Math.max(0, screen.height - (anchor.y + size)) : tabBarBottomOffset;

    const blurProps = useAnimatedProps(() => ({ intensity: progress.value * 25 }));
    const plusStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
    }));

    // Each kind in the colour it wears everywhere else in the app.
    const items = [
        { id: 'goal', label: 'Goal', icon: 'flag', color: colors.success, hint: 'Where you are heading' },
        { id: 'habit', label: 'Habit', icon: 'repeat', color: primary, hint: 'Something you repeat' },
        { id: 'task', label: 'Task', icon: 'checkmark-circle', color: TASK_COLOR, hint: 'Done once, by a date' },
        { id: 'thought', label: 'Thought', icon: 'bulb', color: secondary || primary, hint: 'Get it out of your head' },
    ] as const;
    // One card, settling up out of the button: eased, no bounce.
    const cardStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ translateY: interpolate(progress.value, [0, 1], [12, 0]) }, { scale: interpolate(progress.value, [0, 1], [0.97, 1]) }],
    }));
    const cardWidth = Math.min(300, screen.width - horizontalPadding * 2);

    return (
        visible ? <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1 }}>
                {/* Just a blur over the page — no darkening — so the three
                    choices are the only sharp things on screen. The blur's own
                    strength is animated: fading a blur through its parent's
                    opacity makes iOS draw it as a black sheet. */}
                <Pressable accessibilityLabel="Close creation menu" onPress={dismiss} style={StyleSheet.absoluteFill}>
                    <AnimatedBlurView tint="default" animatedProps={blurProps} style={StyleSheet.absoluteFill} />
                </Pressable>

                <View accessibilityViewIsModal pointerEvents="box-none" style={[styles.stack, { right, bottom }]}>
                    {/* One card, like an iOS menu: every row the same width, an
                        icon in its kind's colour, the name, and what it is for. */}
                    <Animated.View style={[{ width: cardWidth }, cardStyle]}>
                        <MatteSurface radius={22} elevation="floating" style={styles.card}>
                            {items.map((item, index) => (
                                <View key={item.id}>
                                    {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                                    <Pressable accessibilityRole="button" accessibilityLabel={`Create ${item.label.toLowerCase()}`} accessibilityHint={item.hint}
                                        onPress={() => choose(item.id)} style={styles.row}>
                                        <IconTile icon={item.icon} color={item.color} size={36} shape="square" />
                                        <View style={styles.words}>
                                            <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
                                            <Text numberOfLines={1} style={[styles.hint, { color: colors.textSecondary }]}>{item.hint}</Text>
                                        </View>
                                    </Pressable>
                                </View>
                            ))}
                        </MatteSurface>
                    </Animated.View>

                    {/* The same button, turned: 45 degrees is a close button. */}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Close creation menu"
                        onPress={() => { lightFeedback(); dismiss(); }}
                        style={[styles.orb, { width: size, height: size, borderRadius: size / 2, shadowColor }]}
                    >
                        <LinearGradient
                            colors={buttonColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.orbFill, { borderRadius: size / 2 }]}
                        >
                            <Animated.View style={plusStyle}>
                                <Ionicons name="add" size={size * 0.5} color="#fff" />
                            </Animated.View>
                        </LinearGradient>
                    </Pressable>
                </View>
            </View>
        </View> : null
    );
};

const styles = StyleSheet.create({
    stack: { position: 'absolute', alignItems: 'flex-end', gap: 14 },
    orb: {
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    orbFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    card: { paddingVertical: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 60 },
    words: { flex: 1, gap: 2 },
    label: { fontSize: 17, fontFamily: FontFamily.semibold },
    hint: { fontSize: 13, fontFamily: FontFamily.regular },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
});
