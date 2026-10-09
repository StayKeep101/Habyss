import { FontFamily } from '@/constants/DesignSystem';
import { useEffect, useRef, useState } from 'react';
import {Dimensions, Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
    Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { emit, on } from '@/lib/appEvents';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Where the plus button is on screen, as it measured itself. */
interface Anchor { x: number; y: number; size: number }

const OPEN = { duration: 260, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 180, easing: Easing.in(Easing.cubic) };

/**
 * The menu behind the plus button.
 *
 * It opens exactly where the button is, because the button measures itself and
 * sends its position: the same plus, in the same place, turning 45 degrees into
 * a close button rather than being replaced by one somewhere nearby. The three
 * options rise out of it one after another and fall back into it on the way
 * out, so the button and the menu read as one object.
 */
export const CreationModal = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary, buttonColors, shadowColor } = useAccentGradient();
    const { horizontalPadding, floatingButtonSize, tabBarBottomOffset } = useResponsiveLayout();
    const { mediumFeedback, lightFeedback } = useHaptics();

    const [visible, setVisible] = useState(false);
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const progress = useSharedValue(0);
    const pending = useRef<'habit' | 'goal' | 'task' | null>(null);
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
    };

    const choose = (selection: 'habit' | 'goal' | 'task') => {
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

    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
    const plusStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
    }));

    const items = [
        { id: 'goal', label: 'Goal', icon: 'flag-outline', color: primary, hint: 'Where you are heading' },
        { id: 'habit', label: 'Habit', icon: 'repeat', color: '#10B981', hint: 'Something you repeat' },
        { id: 'task', label: 'Task', icon: 'checkmark-circle-outline', color: '#F59E0B', hint: 'Done once, by a date' },
    ] as const;

    return (
        visible ? <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1 }}>
                <AnimatedPressable
                    accessibilityLabel="Close creation menu"
                    onPress={dismiss}
                    style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: isLight ? 'rgba(15,23,42,0.28)' : 'rgba(0,0,0,0.5)' }]}
                />

                <View accessibilityViewIsModal pointerEvents="box-none" style={[styles.stack, { right, bottom }]}>
                    {items.map((item, index) => (
                        <MenuRow
                            key={item.id}
                            item={item}
                            index={index}
                            count={items.length}
                            progress={progress}
                            size={size}
                            colors={colors}
                            isLight={isLight}
                            onPress={() => choose(item.id)}
                        />
                    ))}

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

/** One option, rising out of the button and settling above it. */
const MenuRow = ({ item, index, count, progress, size, colors, isLight, onPress }: any) => {
    // Last in the list leaves first, so they unfold upward from the button.
    const start = 0.12 * (count - 1 - index);
    const style = useAnimatedStyle(() => {
        const local = Math.min(1, Math.max(0, (progress.value - start) / (1 - start)));
        return {
            opacity: local,
            transform: [
                { translateY: interpolate(local, [0, 1], [size * 0.7, 0]) },
                { scale: interpolate(local, [0, 1], [0.82, 1]) },
            ],
        };
    });

    return (
        <Animated.View style={style}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Create ${item.label.toLowerCase()}`}
                onPress={onPress}
                // Static, not a function: see ViewSwitcher — a function style
                // loses the layout on this React Native.
                style={styles.row}
            >
                <BlurView
                    intensity={isLight ? 40 : 60}
                    tint={isLight ? 'light' : 'dark'}
                    style={[styles.pill, { borderColor: colors.border, backgroundColor: isLight ? 'rgba(255,255,255,0.86)' : 'rgba(20,24,30,0.72)' }]}
                >
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
                        <Text style={[styles.hint, { color: colors.textTertiary }]}>{item.hint}</Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: item.color + '24', borderColor: item.color + '55' }]}>
                        <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                </BlurView>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    stack: { position: 'absolute', alignItems: 'flex-end', gap: 12 },
    orb: {
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    orbFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    row: { alignItems: 'flex-end' },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingLeft: 18, paddingRight: 8, paddingVertical: 8,
        borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    },
    label: { fontSize: 15, fontFamily: FontFamily.semibold },
    hint: { fontSize: 11, fontFamily: FontFamily.regular, marginTop: 1 },
    chip: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
