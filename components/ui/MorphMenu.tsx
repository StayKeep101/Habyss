import React, { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { Control, FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

export interface MorphMenuItem {
    label: string;
    icon: IconName;
    onPress: () => void;
    destructive?: boolean;
}

const WIDTH = 248;
const ROW = 48;
const HEAD = 52;
const OPEN = { damping: 20, stiffness: 240, mass: 0.8, reduceMotion: ReduceMotion.System };
const CLOSE = { duration: 170, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * A "⋯" button that grows into its own menu.
 *
 * The round button stretches, from where it sits, into a matte window with a
 * small title and one row per option — icon and label, destructive ones in
 * red — then folds back into the button. Replaces the system action sheet so
 * menus look like the rest of the app. An option runs after the menu has
 * closed, so an alert it raises is never hidden behind it.
 */
export function MorphMenu({ items, title, titleIcon = 'ellipsis-horizontal', label = 'More options', diameter = Control.hitTarget, style }: {
    items: MorphMenuItem[];
    title?: string;
    titleIcon?: IconName;
    label?: string;
    diameter?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();
    const trigger = useRef<View>(null);
    const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null);
    const progress = useSharedValue(0);
    const height = HEAD + items.length * ROW + Spacing.sm;

    const open = () => {
        lightFeedback();
        trigger.current?.measureInWindow((x, y, width) => {
            setAnchor({ x, y, width: width || diameter });
            progress.value = 0;
            progress.value = withSpring(1, OPEN);
        });
    };

    const close = (then?: () => void) => {
        progress.value = withTiming(0, CLOSE, finished => {
            if (finished) runOnJS(finish)(then);
        });
    };
    const finish = (then?: () => void) => {
        setAnchor(null);
        then?.();
    };

    const screen = Dimensions.get('window');
    const right = anchor ? screen.width - (anchor.x + anchor.width) : 0;

    const windowStyle = useAnimatedStyle(() => ({
        width: interpolate(progress.value, [0, 1], [diameter, WIDTH]),
        height: interpolate(progress.value, [0, 1], [diameter, height]),
        borderRadius: interpolate(progress.value, [0, 1], [diameter / 2, Radius.card]),
    }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.5, 1], [0, 1], 'clamp') }));
    const dotsStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.4], [1, 0], 'clamp'),
        transform: [{ rotate: `${progress.value * 90}deg` }],
    }));
    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.35 }));

    return (
        <>
            <Pressable ref={trigger} onPress={open} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={style}>
                <MatteSurface radius={diameter / 2} level="control" style={[styles.disc, { width: diameter, height: diameter, opacity: anchor ? 0 : 1 }]}>
                    <AppIcon name="ellipsis-horizontal" size={Control.icon} color={colors.textPrimary} />
                </MatteSurface>
            </Pressable>

            <Modal visible={!!anchor} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close menu">
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, scrimStyle]} />
                </Pressable>
                {anchor ? (
                    <Animated.View style={[styles.window, { top: anchor.y, right }, windowStyle]} accessibilityViewIsModal>
                        <MatteSurface radius={Radius.card} elevation="floating" style={StyleSheet.absoluteFill}>
                            <Animated.View style={[styles.dots, { width: diameter, height: diameter }, dotsStyle]} pointerEvents="none">
                                <AppIcon name="ellipsis-horizontal" size={Control.icon} color={colors.textPrimary} />
                            </Animated.View>
                            <Animated.View style={[styles.content, contentStyle]}>
                                <View style={[styles.head, { height: HEAD }]}>
                                    <View style={[styles.logo, { backgroundColor: primary }]}>
                                        <AppIcon name={titleIcon} size={13} color={colors.background} />
                                    </View>
                                    <Text numberOfLines={1} style={[styles.title, { color: colors.textSecondary }]}>{title ?? 'Options'}</Text>
                                    <Pressable onPress={() => close()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close menu">
                                        <AppIcon name="close" size={18} color={colors.textTertiary} />
                                    </Pressable>
                                </View>
                                {items.map((item, index) => (
                                    <TouchableOpacity
                                        key={item.label}
                                        accessibilityRole="button"
                                        onPress={() => { selectionFeedback(); close(item.onPress); }}
                                        activeOpacity={0.6}
                                        style={[styles.row, { height: ROW, borderTopColor: colors.border }]}
                                    >
                                        <AppIcon name={item.icon} size={18} color={item.destructive ? colors.error : colors.textPrimary} />
                                        <Text style={[styles.rowLabel, { color: item.destructive ? colors.error : colors.textPrimary }]}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </Animated.View>
                        </MatteSurface>
                    </Animated.View>
                ) : null}
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    disc: { alignItems: 'center', justifyContent: 'center' },
    window: { position: 'absolute', overflow: 'hidden' },
    dots: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1, width: WIDTH },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    logo: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
    rowLabel: { fontFamily: FontFamily.medium, fontSize: 15 },
});
