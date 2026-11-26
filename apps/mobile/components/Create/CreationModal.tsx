import { FontFamily } from '@/theme/designSystem';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {Dimensions, Pressable, StyleSheet, Text, View} from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
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
import { useCoachTarget } from '@/hooks/useCoachTarget';
import { useTokens } from '@/hooks/useTokens';
import { getTour } from '@/lib/coachMarks';
import { PLUS_ACTIONS, currentPlus, loadPlus, runPlus, subscribePlus, type PlusActionId, type PlusTab } from '@/lib/plusActions';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/** Where the plus button is on screen, as it measured itself. */
interface Anchor { x: number; y: number; size: number }

const OPEN = { duration: 260, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 180, easing: Easing.in(Easing.cubic) };

/**
 * The menu behind the plus button: what this tab's + offers
 * (lib/plusActions.ts, changeable in Settings → Plus button).
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
    const t = useTokens();
    const [tab, setTab] = useState<PlusTab>('roadmap');
    const plus = useSyncExternalStore(subscribePlus, currentPlus, currentPlus);
    useEffect(() => { void loadPlus(); }, []);
    const pending = useRef<PlusActionId | null>(null);
    const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const open = on('show_creation_modal', (data?: Partial<Anchor> & { tab?: PlusTab }) => {
            if (closing.current) { clearTimeout(closing.current); closing.current = null; }
            // The tour teaches making a goal from Home, so while it runs the + makes things.
            setTab(getTour().active ? 'roadmap' : data?.tab ?? 'roadmap');
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
            if (closing.current) clearTimeout(closing.current);
        };
    }, [floatingButtonSize]);

    /** Plays the menu back into the button before the sheet goes away. */
    const dismiss = () => {
        progress.value = withTiming(0, CLOSE);
        if (closing.current) clearTimeout(closing.current);
        closing.current = setTimeout(() => { setVisible(false); closing.current = null; }, CLOSE.duration);
    };

    const choose = (selection: PlusActionId) => {
        if (pending.current) return;
        mediumFeedback();
        pending.current = selection;
        // What was chosen opens now, while the menu folds away behind it: the
        // menu is a plain overlay, so nothing waits for it to leave.
        runPlus(selection);
        dismiss();
        setTimeout(() => { pending.current = null; }, CLOSE.duration);
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

    const tone = { accent: primary, success: t.color.success, warning: t.color.warning, danger: t.color.danger };
    const items = plus[tab].map(id => ({ id, label: PLUS_ACTIONS[id].label, icon: PLUS_ACTIONS[id].icon, color: tone[PLUS_ACTIONS[id].tone] }));

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
    // The tour points at "Goal" when it walks you through making one.
    const pill = useCoachTarget<View>(`create-${item.id}`);

    return (
        <Animated.View style={style}>
            <Pressable
                ref={pill}
                accessibilityRole="button"
                accessibilityLabel={['habit', 'task', 'thought'].includes(item.id) ? `Create ${item.label.toLowerCase()}` : item.label}
                onPress={onPress}
                // Static, not a function: see ViewSwitcher — a function style
                // loses the layout on this React Native.
                style={styles.row}
            >
                {/* A matte pill, floating on its shadow: just the word and a
                    matte disc with the filled icon in its colour. */}
                <MatteSurface radius={999} elevation="floating" style={styles.pill}>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
                    <MatteSurface radius={24} level="control" style={styles.chip}>
                        <Ionicons filled name={item.icon} size={23} color={item.color} />
                    </MatteSurface>
                </MatteSurface>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    stack: { position: 'absolute', alignItems: 'flex-end', gap: 14 },
    orb: {
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    orbFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    row: { alignItems: 'flex-end' },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingLeft: 24, paddingRight: 9, paddingVertical: 9,
    },
    label: { fontSize: 17, fontFamily: FontFamily.semibold },
    chip: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
